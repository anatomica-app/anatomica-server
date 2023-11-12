const express = require('express');
const router = express.Router();

const Joi = require('joi');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const smtp = require('nodemailer-smtp-transport');
const { Storage } = require('@google-cloud/storage');
const { OAuth2Client } = require('google-auth-library');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const pool = require('../database');
const constants = require('./constants');
const responseMessages = require('./responseMessages');
const userInfo = require('../authenticatedUserService');
const logger = require('../logger');
const { error } = require('winston');

// ***** Google Cloud Storage *****
const storage = new Storage();
const defaultBucket = storage.bucket('anatomica-storage');

const apiPrefix = `https://api.${process.env.DOMAIN}/`;
const apiVersion = 'v1';

// ***** Google OAuth2 Client *****
const client = new OAuth2Client(process.env.GOOGLE_OAUTH2_CLIENT_ID);

// Login user with credentials.
router.post('/login', async (req, res) => {
  const schema = Joi.object({
    email: Joi.string().min(3).max(64).required(),
    password: Joi.string().max(128).required(),
  });

  const result = schema.validate(req.body);
  if (result.error) {
    logger.logValidationError(req, result.error);
    return res.status(400).json({ message: result.error.details[0].message });
  }

  const sql = 'CALL fetch_user_by_email(?);';

  pool.getConnection(function (err, conn) {
    if (err) {
      logger.logDatabaseError(req, err);
      return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
    }
    conn.query(sql, [req.body.email], (error, rows) => {
      conn.release();
      if (error) {
        logger.logDatabaseError(req, error);
        return res
          .status(500)
          .json({ message: responseMessages.DATABASE_ERROR });
      }

      if (!rows[0][0]) {
        logger.logger.warning("Login Error", {
          request: {
            email: req.body.email,
          }
        });
        return res.status(404).json({
          message: responseMessages.EMAIL_OR_PASSWORD_INCORRECT,
        });
      }
      else {
        // We should check whether the user authenticated with default authentication or not.
        let user = rows[0][0];

        if (user.accountType === constants.ACCOUNT_DEFAULT) {
          // User authenticated with default authentication.
          // Compare passwords before.
          bcrypt.compare(
            req.body.password,
            user.password,
            function (err, result) {
              if (err) {
                logger.logDatabaseError(req, err);
                return res
                  .status(500)
                  .json({ message: responseMessages.DATABASE_ERROR });
              }

              if (result) {
                if (user.isActive === 1) {
                  const token = jwt.sign(
                    {
                      id: user.id,
                      email: req.body.email,
                    },
                    process.env.JWT_PRIVATE_KEY,
                    {
                      expiresIn: '1h',
                    }
                  );

                  user.token = token;
                }
                logger.logger.info("Successful Login", {
                  request: {
                    id: user.id,
                    email: req.body.email,
                  }
                });
                return res.send(user);
              } else {
                logger.logger.warning("Login Error", {
                  request: {
                    email: req.body.email,
                  }
                });
                return res.status(404).json({
                  message: responseMessages.EMAIL_OR_PASSWORD_INCORRECT,
                });
              }
            }
          );
        } else {
          logger.logger.warning("Login Error (Wrong Provider)", {
            request: {
              email: req.body.email,
            }
          });
          return res.status(400).json({
            message: responseMessages.EMAIL_REGISTERED_ANOTHER_PROVIDER,
          });
        }
      }
    });
  });
});

// Login user with Google.
router.post('/google', async (req, res) => {
  const schema = Joi.object({
    idToken: Joi.string().required(),
  });

  const result = schema.validate(req.body);
  if (result.error) {
    logger.logValidationError(req, result.error);
    return res.status(400).json({ message: result.error.details[0].message });
  }

  const verifyGoogleAccountResponse = await verifyGoogleAccount(
    req.body.idToken
  );
  if (!verifyGoogleAccountResponse) {
    logger.logger.error("GOOGLE VERIFY ERROR");
    return res
      .status(500)
      .json({ message: responseMessages.GOOGLE_AUTH_FAILED });
  }

  // Id token has been verified successfully.
  // Now check if there is a valid user that has been logged in before.

  const name = verifyGoogleAccountResponse.given_name;
  const lastName = verifyGoogleAccountResponse.family_name;
  const email = verifyGoogleAccountResponse.email;
  const picture = verifyGoogleAccountResponse.picture;
  const googleId = verifyGoogleAccountResponse.sub;

  // Begin the process with the collected user info.
  const sql = 'CALL fetch_user_by_email(?);';

  pool.getConnection(function (err, conn) {
    if (err) {
      logger.logDatabaseError(req, err);
      return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
    }
    conn.query(sql, [email], (error, rows) => {
      conn.release();
      if (error) {
        logger.logDatabaseError(req, error);
        return res
          .status(500)
          .json({ message: responseMessages.DATABASE_ERROR });
      }

      if (!rows[0][0]) {
        // The user with the same email address was not
        // found on the server. Create a new record.
        createGoogleUser(name, lastName, email, picture, googleId, req, res);
      } else {
        // We got a record with the same email address.
        // Let's check whether it's google_account or not.
        let user = rows[0][0];

        if (user.accountType === constants.ACCOUNT_GOOGLE) {
          // The user is google_account.
          // Approve the login process.
          const token = jwt.sign(
            {
              id: user.id,
              email: email,
            },
            process.env.JWT_PRIVATE_KEY,
            {
              expiresIn: '1h',
            }
          );

          user.token = token;
          logger.logger.info("Successful Login (Google)", {
            requestInfo: {
              name: verifyGoogleAccountResponse.given_name,
              lastName: verifyGoogleAccountResponse.family_name,
              email: verifyGoogleAccountResponse.email,
            }
          });
          return res.send(user);
        } else {
          // The email address was registered with
          // non-google account before. Deny the process.
          logger.logger.warning("Login Error (Wrong Provider)", {
            request: {
              email: verifyGoogleAccountResponse.email,
            }
          });
          return res.status(409).json({
            message: responseMessages.EMAIL_REGISTERED_ANOTHER_PROVIDER,
          });
        }
      }
    });
  });
});

// Login user with Apple.
router.post('/apple', (req, res) => {
  const schema = Joi.object({
    name: Joi.string().min(3).max(64).allow(null),
    lastName: Joi.string().max(64).allow(null),
    email: Joi.string().min(3).max(64).allow(null),
    appleId: Joi.string().required(),
  });

  const result = schema.validate(req.body);
  if (result.error) {
    logger.logValidationError(result.error);
    return res.status(400).json({ message: result.error.details[0].message });
  }

  const sql = 'CALL fetch_user_by_apple_id(?);';

  pool.getConnection(function (err, conn) {
    if (err) {
      logger.logDatabaseError(req, err);
      return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
    }
    conn.query(sql, [req.body.appleId], (error, rows) => {
      conn.release();
      if (error) {
        logger.logDatabaseError(req, error);
        return res
          .status(500)
          .json({ message: responseMessages.DATABASE_ERROR });
      }

      if (!rows[0][0]) {
        // The user with the same email address was not
        // found on the server. Create a new record.
        if (req.body.name && req.body.lastName && req.body.email) {
          createAppleUser(
            req.body.name,
            req.body.lastName,
            req.body.email,
            req.body.appleId,
            req,
            res
          );
        } else {
          logger.logger.error("Login Error (AppleID Not Found)");
          return res.status(404).json({
            message: responseMessages.APPLE_ID_NOT_FOUND,
          });
        }
      } else {
        let user = rows[0][0];

        const token = jwt.sign(
          {
            id: user.id,
            email: req.body.email,
          },
          process.env.JWT_PRIVATE_KEY,
          {
            expiresIn: '1h',
          }
        );

        user.token = token;
        logger.logger.info("Successful Login (Apple)", {
          name: req.body.name,
          lastName: req.body.lastName,
          email: req.body.email,
        });
        return res.send(user);
      }
    });
  });
});

// Create a user with default configuration.
router.post('/', (req, res) => {
  const schema = Joi.object({
    name: Joi.string().min(3).max(64).required(),
    lastName: Joi.string().max(64).required(),
    email: Joi.string().min(3).max(64).required(),
    password: Joi.string().max(128).required(),
  });

  const result = schema.validate(req.body);
  if (result.error) {
    logger.logValidationError(req, result.error);
    return res.json({ message: result.error.details[0].message });
  }

  const sql = 'CALL fetch_user_by_email(?);';

  pool.getConnection(function (err, conn) {
    if (err) {
      logger.logDatabaseError(req, err);
      return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
    }
    conn.query(sql, [req.body.email], (error, rows) => {
      if (error) {
        conn.release();
        logger.logDatabaseError(req, error);
        return res
          .status(500)
          .json({ message: responseMessages.DATABASE_ERROR });
      }

      if (!rows[0][0]) {
        // There was no record with the same email address.
        // Create the user.
        const sql2 = 'CALL create_user(?,?,?,?,?);';

        bcrypt.hash(req.body.password, 10, function (err, hashedPassword) {
          if (err) {
            logger.logger.error("HASH ERROR", err);
            return res.status(500).json({ message: err.message });
          }

          // Create a new JWT.
          const token = jwt.sign(
            {
              email: req.body.email,
            },
            process.env.JWT_PRIVATE_KEY,
            {
              expiresIn: '1h',
            }
          );

          conn.query(
            sql2,
            [
              req.body.name,
              req.body.lastName,
              req.body.email,
              hashedPassword,
              token,
            ],
            (error2, rows2) => {
              conn.release();
              if (error2) {
                logger.logDatabaseError(req, error2);
                return res
                  .status(500)
                  .json({ message: responseMessages.DATABASE_ERROR });
              }

              let result = rows2[0][0];

              if (result.insertId === 0) {
                logger.logger.error("User Cannot Be Created", {
                  requestInfo: {
                    name: req.body.name,
                    lastName: req.body.lastName,
                    email: req.body.email,
                  },
                });
                return res.status(500).json({
                  message: responseMessages.USER_CANNOT_BE_CREATED,
                });
              } else {
                logger.logger.info("Successful Register", {
                  requestInfo: {
                    name: req.body.name,
                    lastName: req.body.lastName,
                    email: req.body.email,
                  }
                });
                sendRegisterMail(
                  req.body.name,
                  req.body.email,
                  result.insertId,
                  token,
                  req
                );
                return res.send({ id: result.insertId });
              }
            }
          );
        });
      } else {
        // The user was already exists with this email address.
        logger.logger.warning("Register Error (User Already Exists)", {
          requestInfo: {
            name: req.body.name,
            lastName: req.body.lastName,
            email: req.body.email,
          }
        });
        return res.status(409).json({
          message: responseMessages.USER_ALREADY_EXISTS,
        });
      }
    });
  });
});

// Change profile picture.
router.put('/changeProfilePicture', async (req, res) => {
  const schema = Joi.object({
    id: Joi.number().integer().required(),
    image: Joi.string().base64().required(),
  });

  const result = schema.validate(req.body);
  if (result.error) {
    logger.logValidationError(req, result.error);
    return res.status(500).json({ message: result.error.details[0].message });
  }

  let sql = '';
  let data = [];

  // First we need to check if there is a user and
  // user previously have a profile picture.
  // If so we delete the profile picture and upload the new one.
  sql =
    'SELECT account_type, profile_photo FROM users WHERE user_id = ? LIMIT 1';
  pool.getConnection(function (err, conn) {
    if (err) {
      logger.logDatabaseError(req, err);
      return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
    }
    conn.query(sql, [req.body.id], (error, rows) => {
      conn.release();
      if (error) {
        logger.logDatabaseError(req, error);
        return res
          .status(500)
          .json({ message: responseMessages.DATABASE_ERROR });
      }

      if (!rows[0]) {
        logger.logger.warning("Profile Photo Update Error (User Not Found)", {
          request: userInfo(req),
        });
        return res
          .status(404)
          .json({ message: responseMessages.USER_NOT_FOUND });
      } else {
        const user = rows[0];
        if (
          user.accountType === constants.ACCOUNT_DEFAULT &&
          user.pp !== null &&
          user.pp !== undefined
        ) {
          // There was a profile picture before.
          // Delete the file. We need to strip the url
          // in order to get the bucket file path.
          // Let's strip down before /quiz_question_images/..
          // https://storage.googleapis.com/anatomica-storage/user_profile_images/1631631802266.jpg

          let image = user.pp;
          let imageUrl = image.split('anatomica-storage/')[1];

          if (imageUrl !== null || imageUrl !== undefined) {
            if (defaultBucket.file(imageUrl).exists()) {
              async function deleteFile() {
                await defaultBucket.file(imageUrl).delete();
              }
            }
          }
        }

        // Image processing part.
        const imageBuffer = Buffer.from(req.body.image, 'base64');
        const byteArray = new Uint8Array(imageBuffer);
        const fileURL = `user_profile_images/${new Date().getTime()}.jpg`;
        const file = defaultBucket.file(fileURL);

        file.save(byteArray).then(async () => {
          file.makePublic();

          const url = `https://storage.googleapis.com/anatomica-storage/${fileURL}`;

          data = [url, req.body.id];

          sql = 'UPDATE users SET profile_photo = ? WHERE user_id = ?';

          pool.getConnection(function (err, conn) {
            if (err) {
              logger.logDatabaseError(req, err);
              return res
                .status(500)
                .json({ message: responseMessages.DATABASE_ERROR });
            }
            conn.query(sql, data, (error, rows) => {
              conn.release();
              if (error) {
                logger.logDatabaseError(req, error);
                return res.json({
                  error: true,
                  message: responseMessages.DATABASE_ERROR,
                });
              }

              if (rows.affectedRows === 0) {
                logger.logger.error("Profile Photo Update Error (Cannot Be Updated)", {
                  request: userInfo(req),
                });
                return res.json({
                  message: responseMessages.USER_CANNOT_UPDATED,
                });
              } else {
                logger.logger.info("Successfully Updated Profile Photo", {
                  request: userInfo(req),
                });
                return res.json({ data: data });
              }
            });
          });
        });
      }
    });
  });
});

// Send verify email again.
router.post('/sendVerificationEmail', (req, res) => {
  const schema = Joi.object({
    email: Joi.string().min(3).max(64).required(),
  });

  const result = schema.validate(req.body);
  if (result.error) {
    logger.logValidationError(req, result.error);
    return res.status(500).json({ message: result.error.details[0].message });
  }

  const sql = 'CALL fetch_user_by_email(?);';

  pool.getConnection(function (err, conn) {
    if (err) {
      logger.logDatabaseError(req, err);
    }
    conn.query(sql, [req.body.email], (error, rows) => {
      if (error) {
        logger.logDatabaseError(req, error);
      }

      if (!rows[0]) {
        logger.logger.error("Send Verification Mail Error (User Not Found)", {
          requestInfo: {
            email: req.body.email,
          }
        });
        return res.status(404).json({
          message: responseMessages.USER_NOT_FOUND,
        });
      } else {
        const user = rows[0][0];

        // Let's check if the user authenticated with password or any
        // other provider. If default send, if not deny.
        if (user.accountType === constants.ACCOUNT_DEFAULT) {
          // Also we should check if the user activated his/her account before.
          // We shouldn't send redundant mails.
          if (user.isActive === 0) {
            // User hasn't activated his/her account yet.

            // Create a new JWT.
            const token = jwt.sign(
              {
                email: req.body.email,
              },
              process.env.JWT_PRIVATE_KEY,
              {
                expiresIn: '1h',
              }
            );

            const sql2 = 'CALL update_user_verification_hash();';

            conn.query(sql2, [token, req.body.email], (error2, rows2) => {
              if (error) {
                logger.logDatabaseError(req, error);
                return res
                  .status(500)
                  .json({ message: responseMessages.DATABASE_ERROR });
              }

              logger.logger.info("Successfully Send Verification Mail", {
                request: {
                  id: user.id,
                  email: req.body.email,
                },
                requestInfo: {
                  id: user.id,
                  name: user.name,
                  lastName: user.last_name,
                  email: req.body.email,
                }
              });
              sendRegisterMail(user.name, req.body.email, user.id, token, req);

              return res.send({
                message: responseMessages.VERIFICATION_MAIL_SENT,
              });
            });
          } else {
            logger.logger.error("Send Verification Mail Error (Already Activated)", {
              requestInfo: {
                email: req.body.email,
              }
            });
            return res.status(409).json({
              message: responseMessages.USER_ALREADY_ACTIVATED_ACCOUNT,
            });
          }
        } else {
          logger.logger.error("Send Verification Mail Error (Already Activated)", {
            requestInfo: {
              email: req.body.email,
            }
          });
          return res.status(409).json({
            message: responseMessages.USER_ALREADY_ACTIVATED_ACCOUNT,
          });
        }
      }
    });
  });
});

// Verify mail address.
router.get('/verify/:id/:hash', (req, res) => {
  try {
    const token = req.params.hash;
    const decoded = jwt.verify(token, process.env.JWT_PRIVATE_KEY);
    req.userData = decoded;

    const sql = 'CALL update_user_active_status(?, ?);';

    pool.getConnection(function (err, conn) {
      if (err) {
        logger.logDatabaseError(req, err);
        return res
          .status(500)
          .json({ message: responseMessages.DATABASE_ERROR });
      }
      conn.query(sql, [req.params.id, req.params.hash], (error, rows) => {
        conn.release();
        if (error) {
          logger.logDatabaseError(req, error);
          return res
            .status(500)
            .json({ message: responseMessages.DATABASE_ERROR });
        }

        if (rows.affectedRows === 0) {
          logger.logger.error("User Activation Error (Cannot Be Updated)", {
            requestInfo: {
              id: req.params.id,
              hash: req.params.hash,
            }
          });
          return res.status(500).json({
            message: responseMessages.USER_CANNOT_UPDATED,
          });
        } else {
          let pagePath = path.join(
            __dirname,
            '../page_templates/verify_mail.html'
          );

          fs.readFile(pagePath, function (err, data) {
            if (err) {
              logger.logDatabaseError(req, err);
              return res.json({ message: responseMessages.DATABASE_ERROR });
            }

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.write(data);
            return res.end();
          });
        }
      });
    });
  } catch (error) {
    let pagePath = path.join(__dirname, '../page_templates/expired_token.html');

    fs.readFile(pagePath, function (err, data) {
      if (err) {
        logger.logDatabaseError(req, err);
        return res.json({ message: responseMessages.DATABASE_ERROR });
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.write(data);
      return res.end();
    });
  }
});

// Send password reset request.
router.post('/password/resetMail/', (req, res) => {
  const schema = Joi.object({
    email: Joi.string().min(3).max(64).required(),
  });

  const result = schema.validate(req.body);
  if (result.error) {
    logger.logValidationError(req, result.error);
    return res.status(400).json({ message: result.error.details[0].message });
  }

  const sql = 'CALL fetch_user_by_email(?)';

  pool.getConnection(function (err, conn) {
    if (err) {
      logger.logDatabaseError(req, err);
      return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
    }
    conn.query(sql, [req.body.email], (error, rows) => {
      conn.release();
      if (error) {
        logger.logDatabaseError(req, error);
        return res
          .status(500)
          .json({ message: responseMessages.DATABASE_ERROR });
      }

      if (!rows[0][0]) {
        logger.logger.error("Reset Password Mail Send Error (User Not Found)", {
          requestInfo: {
            email: req.body.email
          }
        });
        return res.status(404).json({
          message: responseMessages.USER_NOT_FOUND,
        });
      } else {
        const user = rows[0][0];

        // Let's check whether or not the user authenticated with email and password.

        if (user.accountType === constants.ACCOUNT_DEFAULT) {
          // Create a JWT for sending link to the user.
          const token = jwt.sign(
            {
              id: user.id,
              email: req.body.email,
            },
            process.env.JWT_PRIVATE_KEY_RESET,
            {
              expiresIn: '1h',
            }
          );

          // Hash this token in order to save it in the database.
          bcrypt.hash(token, 10, function (err, hashedToken) {
            if (err) {
              logger.logger.error("HASH ERROR", err);
              return res.json({ message: responseMessages.DATABASE_ERROR });
            }

            // We got the hashed token.
            // Let's save it to the database.
            const sql2 = 'CALL update_password_reset_token(?, ?)';

            conn.query(sql2, [user.id, hashedToken], (error2, rows2) => {
              if (error2) {
                logger.logDatabaseError(req, error2);
                return res.json({ message: responseMessages.DATABASE_ERROR });
              }

              if (rows2.affectedRows !== 0) {
                // Everything is awesome! Let's send the email.
                logger.logger.info("Successfully Sent Reset Password Mail", {
                  request: {
                    id: user.id,
                    email: req.body.email
                  },
                  requestInfo: {
                    name: user.name,
                    lastName: user.last_name,
                    email: req.body.email,
                  }
                });

                sendPasswordResetMail(
                  user.id,
                  user.name,
                  req.body.email,
                  token,
                  req
                );

                return res.send({
                  message: responseMessages.PASSWORD_RESET_MAIL_SENT,
                });
              } else {
                logger.logger.error("PASSWORD RESET TOKEN GENERATION ERROR", {
                  request: {
                    id: user.id,
                    email: req.body.email
                  },
                  requestInfo: {
                    name: user.name,
                    lastName: user.last_name,
                    email: req.body.email,
                  }
                });
                return res.status(500).json({
                  message: responseMessages.PASSWORD_RESET_TOKEN_CANNOT_CREATED,
                });
              }
            });
          });
        } else {
          logger.logger.warning("Password Reset Mail Send Error (Wrong Provider)", {
            requestInfo: {
              email: req.body.email,
            }
          });
          return res.status(409).json({
            message: responseMessages.EMAIL_REGISTERED_ANOTHER_PROVIDER,
          });
        }
      }
    });
  });
});

// Reset password page.
router.get('/password/reset/:id/:token', (req, res) => {
  // Let's first check if the token is valid.
  try {
    const decoded = jwt.verify(
      req.params.token,
      process.env.JWT_PRIVATE_KEY_RESET
    );

    const sql = 'CALL fetch_user_by_id(?);';

    pool.getConnection(function (err, conn) {
      if (err) {
        logger.logDatabaseError(req, err);
        return res
          .status(500)
          .json({ message: responseMessages.DATABASE_ERROR });
      }
      conn.query(sql, [req.params.id], (error, rows) => {
        conn.release();
        if (error) {
          logger.logDatabaseError(req, error);
          return res
            .status(500)
            .json({ message: responseMessages.DATABASE_ERROR });
        }

        if (!rows[0][0]) {
          fs.readFile(
            path.join(__dirname, '../page_templates/expired_token.html'),
            function (err, data) {
              if (err) {
                logger.logDatabaseError(req, err);
                return res
                  .status(500)
                  .json({ message: responseMessages.DATABASE_ERROR });
              }

              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.write(data);
              return res.end();
            }
          );
        } else {
          const user = rows[0][0];
          // Let's check if the reset_token is NULL.

          if (!user.resetToken) {
            // Reset token is NULL.
            fs.readFile(
              path.join(__dirname, '../page_templates/expired_token.html'),
              function (err, data) {
                if (err) {
                  logger.logDatabaseError(req, err);
                  return res
                    .status(500)
                    .json({ message: responseMessages.DATABASE_ERROR });

                }
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.write(data);
                return res.end();
              }
            );
          } else {
            // Let's compare the JWT and hashed token.
            bcrypt.compare(
              req.params.token,
              user.resetToken,
              function (err, result) {
                if (err) {
                  logger.logger.error("HASH ERROR", err);
                  return res
                    .status(500)
                    .json({ message: responseMessages.DATABASE_ERROR });
                }

                if (result) {
                  // The reset token is valid. Show the HTML.
                  let pagePath = path.join(
                    __dirname,
                    '../page_templates/reset_password.html'
                  );

                  fs.readFile(pagePath, function (err, data) {
                    if (err) {
                      logger.logDatabaseError(req, err);
                      return res
                        .status(500)
                        .json({ message: responseMessages.DATABASE_ERROR });
                    }

                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.write(data);
                    return res.end();
                  });
                } else {
                  // Reset token is invalid or expired.
                  fs.readFile(
                    path.join(
                      __dirname,
                      '../page_templates/expired_token.html'
                    ),
                    function (err, data) {
                      if (err) {
                        logger.logDatabaseError(req, err);
                        return res
                          .status(500)
                          .json({ message: responseMessages.DATABASE_ERROR });
                      }

                      res.writeHead(200, { 'Content-Type': 'text/html' });
                      res.write(data);
                      return res.end();
                    }
                  );
                }
              }
            );
          }
        }
      });
    });
  } catch (error) {
    fs.readFile(
      path.join(__dirname, '../page_templates/expired_token.html'),
      function (err, data) {
        if (err) {
          logger.logDatabaseError(req, err);
          return res
            .status(500)
            .json({ message: responseMessages.DATABASE_ERROR });
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write(data);
        return res.end();
      }
    );
  }
});

// Reset password.
router.put('/password/update', (req, res) => {
  const schema = Joi.object({
    id: Joi.number().required(),
    token: Joi.string().required(),
    password: Joi.string().required(),
  });

  const result = schema.validate(req.body);
  if (result.error) {
    logger.logValidationError(req, result.error);
    return res.status(500).json({ message: result.error.details[0].message });
  }

  const sql = 'CALL fetch_user_by_id(?);';

  pool.getConnection(function (err, conn) {
    if (err) {
      logger.logDatabaseError(req, err);
      return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
    }
    conn.query(sql, [req.body.id], (error, rows) => {
      if (error) {
        logger.logDatabaseError(req, error);
        return res
          .status(500)
          .json({ message: responseMessages.DATABASE_ERROR });
      }
      if (!rows[0][0]) {
        logger.logger.warning("Password Update Error (User Not Found)", {
          requestInfo: {
            id: req.body.id,
            token: req.body.token,
          }
        });
        return res.status(404).json({
          message: responseMessages.USER_NOT_FOUND,
        });
      } else {
        const user = rows[0][0];
        // Let's check if the reset_token is NULL.

        if (!user.resetToken) {
          // Reset token is NULL.
          logger.logger.warning("Password Update Error (Invalid Token)", {
            requestInfo: {
              id: req.body.id,
              token: req.body.token,
            }
          });
          return res.status(401).json({
            message: 'Invalid or expired reset token.',
          });
        } else {
          // Let's compare the JWT and hashed token.
          bcrypt.compare(
            req.body.token,
            user.resetToken,
            function (err, result) {
              if (err) {
                logger.logger.error("HASH ERROR", err);
                return res
                  .status(500)
                  .json({ message: responseMessages.DATABASE_ERROR });
              }

              if (result) {
                // The reset token is valid. Show the HTML.

                bcrypt.hash(
                  req.body.password,
                  10,
                  function (err, hashedPassword) {
                    if (err) {
                      logger.logger.error("HASH ERROR", err);
                      return res
                        .status(500)
                        .json({ message: responseMessages.DATABASE_ERROR });
                    }

                    if (user.password === hashedPassword) {
                      // New password is same as old password.
                      logger.logger.warning("Password Update Error (Previous Password Identical)", {
                        request: {
                          id: user.id,
                          email: user.email,
                        },
                        requestInfo: {
                          id: req.body.id,
                          token: req.body.token,
                        }
                      })
                      return res.status(400).json({
                        message: responseMessages.PASSWORD_CANNOT_BE_SAME,
                      });
                    } else {
                      const sql2 = 'CALL update_password(?,?,?);';

                      conn.query(
                        sql2,
                        [req.body.id, user.resetToken, hashedPassword],
                        (error2, rows2) => {
                          conn.release();
                          if (error2) {
                            logger.logDatabaseError(req, error2);
                            return res
                              .status(500)
                              .json({
                                message: responseMessages.DATABASE_ERROR,
                              });
                          }

                          if (rows2.affectedRows !== 0) {
                            // Password changed successfully.
                            logger.logger.info("Successfully Changed Password", {
                              request: {
                                id: user.id,
                                email: user.email,
                              },
                              requestInfo: {
                                id: req.body.id,
                                token: req.body.token,
                              }
                            })
                            return res.json({
                              message:
                                responseMessages.PASSWORD_CHANGED_SUCCESSFULLY,
                            });
                          } else {
                            logger.logger.error("PASSWORD CHANGE ERROR", {
                              request: {
                                id: user.id,
                                email: user.email,
                              },
                              requestInfo: {
                                id: req.body.id,
                                token: req.body.token,
                              }
                            })
                            return res.status(500).json({
                              message: responseMessages.PASSWORD_CANNOT_CHANGED,
                            });
                          }
                        }
                      );
                    }
                  }
                );
              } else {
                // Reset token is invalid or expired.
                logger.logger.warning("Password Change Error (Invalid or Expired Token)", {
                  request: {
                    id: user.id,
                    email: user.email,
                  },
                  requestInfo: {
                    id: req.body.id,
                    token: req.body.token,
                  }
                });
                return res.status(401).json({
                  message: responseMessages.INVALID_OR_EXPIRED_TOKEN,
                });
              }
            }
          );
        }
      }
    });
  });
});

// Delete account.
router.delete('/', (req, res) => {
  const schema = Joi.object({
    id: Joi.number().integer().required(),
    email: Joi.string().min(3).max(64).required(),
  });

  const result = schema.validate(req.body);
  if (result.error) {
    logger.logValidationError(req, result.error);
    return res.status(500).json({ message: result.error.details[0].message });
  }

  const sql = 'CALL delete_user(?, ?);';

  pool.getConnection(function (err, conn) {
    if (err) {
      logger.logDatabaseError(req, err);
      return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
    }
    conn.query(sql, [req.body.id, req.body.email], (error, rows) => {
      conn.release();
      if (error) {
        logger.logDatabaseError(req, err);
        return res
          .status(500)
          .json({ message: responseMessages.DATABASE_ERROR });
      }

      if (rows.affectedRows !== 0) {
        // User deleted successfully.
        logger.logger.info("Successfully Deleted User", {
          request: {
            id: req.body.id,
            email: req.body.email,
          }
        })

        // Send an email to the user.
        sendAccountDeletedMail(req.body.email, req);

        return res.json({
          message: responseMessages.ACCOUNT_DELETED_SUCCESSFULLT,
        });
      }

      logger.logger.warning("Delete User Error (User Not Found)", {
        request: {
          id: req.body.id,
          email: req.body.email,
        }
      })
      return res.status(404).json({
        message: responseMessages.USER_NOT_FOUND,
      });
    });
  });
});

// ***** Helper Functions *****
async function sendRegisterMail(name, email, id, hash, req) {
  let mailPath = path.join(__dirname, '../mail_templates/register.html');

  // Prepare the HTML with replacing the placeholder strings.
  fs.readFile(mailPath, 'utf8', async function (err, data) {
    if (err) {
      logger.logDatabaseError(req, err);
      return err.message;
    }

    let verifyUrl = `${apiPrefix}${apiVersion}/users/verify/${id}/${hash}`;

    let result = data.replace(/{NAME}/g, name);
    result = result.replace(/{EMAIL}/g, email);
    result = result.replace(/{VERIFY_URL}/g, verifyUrl);
    result = result.replace(/{DOMAIN}/g, process.env.DOMAIN);

    // Send the mail.
    const transport = nodemailer.createTransport(
      smtp({
        host: process.env.MAILJET_SMTP_SERVER,
        port: 2525,
        auth: {
          user: process.env.MAILJET_API_KEY,
          pass: process.env.MAILJET_SECRET_KEY,
        },
      })
    );

    await transport.sendMail({
      from: 'Anatomica <' + process.env.MAIL_USER + '>',
      to: email,
      subject: 'Anatomica | Üyelik Aktivasyonu',
      html: result,
    });

    logger.logger.info("Succesfully Sent Activation Mail", {
      requestInfo: {
        name: name,
        email: email,
      }
    });
  });
}

async function sendWelcomeMail(name, email, req) {
  let mailPath = path.join(__dirname, '../mail_templates/register_google.html');

  // Prepare the HTML with replacing the placeholder strings.
  fs.readFile(mailPath, 'utf8', async function (err, data) {
    if (err) {
      logger.logDatabaseError(req, err);
      return err.message;
    }

    let result = data.replace(/{NAME}/g, name);
    result = result.replace(/{EMAIL}/g, email);
    result = result.replace(/{DOMAIN}/g, process.env.DOMAIN);

    // Send the mail.
    const transport = nodemailer.createTransport(
      smtp({
        host: process.env.MAILJET_SMTP_SERVER,
        port: 2525,
        auth: {
          user: process.env.MAILJET_API_KEY,
          pass: process.env.MAILJET_SECRET_KEY,
        },
      })
    );

    await transport.sendMail({
      from: 'Anatomica <' + process.env.MAIL_USER + '>',
      to: email,
      subject: 'Anatomica | Hoş Geldiniz',
      html: result,
    });

    logger.logger.info("Successfully Sent Welcome Mail", {
      requestInfo: {
        name: name,
        email: email,
      }
    })
  });
}

async function sendAccountDeletedMail(email, req) {
  let mailPath = path.join(__dirname, '../mail_templates/account_deleted.html');

  // Prepare the HTML with replacing the placeholder strings.
  fs.readFile(mailPath, 'utf8', async function (err, data) {
    if (err) {
      logger.logDatabaseError(req, err);
      return err.message;
    }

    let result = data.replace(/{EMAIL}/g, email);
    result = result.replace(/{DOMAIN}/g, process.env.DOMAIN);

    // Send the mail.
    const transport = nodemailer.createTransport(
      smtp({
        host: process.env.MAILJET_SMTP_SERVER,
        port: 2525,
        auth: {
          user: process.env.MAILJET_API_KEY,
          pass: process.env.MAILJET_SECRET_KEY,
        },
      })
    );

    await transport.sendMail({
      from: 'Anatomica <' + process.env.MAIL_USER + '>',
      to: email,
      subject: 'Anatomica | Hesabınız Silindi',
      html: result,
    });

    logger.logger.info("Successfully Send Account Deleted Mail", {
      requestInfo: {
        email: email
      }
    });
  });
}

async function sendPasswordResetMail(id, name, email, token, req) {
  let mailPath = path.join(__dirname, '../mail_templates/reset_password.html');
  let resetURL =
    apiPrefix + apiVersion + '/users/password/reset/' + id + '/' + token;

  // Prepare the HTML with replacing the placeholder strings.
  fs.readFile(mailPath, 'utf8', async function (err, data) {
    if (err) {
      logger.logDatabaseError(req, err);
      return err.message;
    }

    let result = data.replace(/{RESET_URL}/g, resetURL);
    result = result.replace(/{USER}/g, name);
    result = result.replace(/{EMAIL}/g, email);
    result = result.replace(/{DOMAIN}/g, process.env.DOMAIN);

    // Send the mail.
    const transport = nodemailer.createTransport(
      smtp({
        host: process.env.MAILJET_SMTP_SERVER,
        port: 2525,
        auth: {
          user: process.env.MAILJET_API_KEY,
          pass: process.env.MAILJET_SECRET_KEY,
        },
      })
    );

    await transport.sendMail({
      from: 'Anatomica <' + process.env.MAIL_USER + '>',
      to: email,
      subject: 'Anatomica | Parola Sıfırlama Talebi',
      html: result,
    });

    logger.logger.info("Successfully Sent Password Reset Mail", {
      requestInfo: {
        name: name,
        email: email,
      }
    });
  });
}

async function verifyGoogleAccount(idToken) {
  const ticket = await client.verifyIdToken({
    idToken: idToken,
    requiredAudience: process.env.GOOGLE_OAUTH2_AUDIENCE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  if (!payload) {
    return null;
  }

  return payload;
}

function createGoogleUser(name, lastName, email, pp, googleId, req, res) {
  const sql = 'CALL create_google_user(?,?,?,?,?,1,?,?)';
  const hash = crypto.createHash('md5').update(email).digest('hex');

  pool.getConnection(function (err, conn) {
    if (err) {
      logger.logDatabaseError(req, err);
      return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
    }
    conn.query(
      sql,
      [name, lastName, email, pp, hash, constants.ACCOUNT_GOOGLE, googleId],
      (error, rows) => {
        if (error) {
          logger.logDatabaseError(req, error);
          return res
            .status(500)
            .json({ message: responseMessages.DATABASE_ERROR });
        }
        const result = rows[0][0];

        if (result.insertId !== 0) {
          const token = jwt.sign(
            {
              id: result.insertId,
              email: email,
            },
            process.env.JWT_PRIVATE_KEY,
            {
              expiresIn: '1h',
            }
          );

          sendWelcomeMail(name, email, req);

          const fetchUserSql = 'CALL fetch_user_by_email(?);';

          pool.getConnection(function (err2, conn2) {
            if (err2) {
              logger.logDatabaseError(req, err2);
              return res
                .status(500)
                .json({ message: responseMessages.DATABASE_ERROR });
            }
            conn2.query(fetchUserSql, [email], (error2, rows2) => {
              conn2.release();
              if (error2) {
                logger.logDatabaseError(req, error2);
                return res
                  .status(500)
                  .json({ message: responseMessages.DATABASE_ERROR });
              }

              const user = rows2[0][0];

              if (!user) {
                logger.logger.error("GET USER INFO ERROR", {
                  requestInfo: {
                    name: name,
                    lastName, lastName,
                    email: email,
                  }
                });
                return res
                  .status(500)
                  .json({
                    message: responseMessages.USER_INFO_CANNOT_RETRIEVED,
                  });
              }

              user.token = token;
              logger.logger.info("Successfully Registered (Google)", {
                requestInfo: {
                  name: name,
                  lastName, lastName,
                  email: email,
                }
              });
              return res.send(user);
            });
          })
        } else {
          logger.logger.error("REGISTER USER ERROR (GOOGLE)", {
            requestInfo: {
              name: name,
              lastName, lastName,
              email: email,
            }
          });
          return res.status(500).json({
            message: responseMessages.USER_CANNOT_BE_CREATED,
          });
        }
      }
    );
  });
}

function createAppleUser(name, lastName, email, apple_id, req, res) {
  const sql = 'CALL create_apple_user(?,?,?,?,1,?,?);';
  const hash = crypto.createHash('md5').update(email).digest('hex');

  pool.getConnection(function (err, conn) {
    if (err) {
      logger.logDatabaseError(req, err);
      return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
    }
    conn.query(
      sql,
      [name, lastName, email, hash, constants.ACCOUNT_APPLE, apple_id],
      (error, rows) => {
        conn.release();
        if (error)
          return res
            .status(500)
            .json({ message: responseMessages.DATABASE_ERROR });
        const result = rows[0][0];

        if (result.insertId !== 0) {
          const token = jwt.sign(
            {
              id: result.insertId,
              email: email,
            },
            process.env.JWT_PRIVATE_KEY,
            {
              expiresIn: '1h',
            }
          );

          sendWelcomeMail(name, email, req);

          const fetchUserSql = 'CALL fetch_user_by_email(?);';

          pool.getConnection(function (err2, conn2) {
            if (err2)
              return res
                .status(500)
                .json({ message: responseMessages.DATABASE_ERROR });
            conn2.query(fetchUserSql, [email], (error2, rows2) => {
              conn2.release();
              if (error2)
                return res
                  .status(500)
                  .json({ message: responseMessages.DATABASE_ERROR });

              const user = rows2[0][0];

              if (!user) {
                return res
                  .status(500)
                  .json({
                    message: responseMessages.USER_INFO_CANNOT_RETRIEVED,
                  });
              }

              user.token = token;
              return res.send(user);
            });
          });
        } else {
          return res.status(500).json({
            message: responseMessages.USER_CANNOT_BE_CREATED,
          });
        }
      }
    );
  });
}

module.exports = router;
