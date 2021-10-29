const express = require("express");
const router = express.Router();

const Joi = require("joi");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const smtp = require('nodemailer-smtp-transport');
const { Storage } = require('@google-cloud/storage');
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const checkPrivilege = require('../middleware/check-privilege');

const pool = require('../database');
const constants = require('./constants');
const errorCodes = require('./errors');
const privileges = require('../privileges');

// ***** Google Cloud Storage *****
const gcs = new Storage({
    keyFilename: path.join(__dirname, '../anatomica-ec2cd-a8621075b43a.json'),
    projectId: 'anatomica-ec2cd'
});

const defaultBucket = gcs.bucket('anatomica-ec2cd.appspot.com');

// Fetch all users.
router.post("/", checkPrivilege(privileges['anatomica.list.users']), (req, res) => {
    const sql = "SELECT id, name, surname, email, password, UNIX_TIMESTAMP(date_joined) as date_joined, UNIX_TIMESTAMP(name_last_changed) as name_last_changed, pp, active, hash, account_type, google_id, apple_id FROM users";

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            if (!rows[0])
                return res.json({
                    error: true,
                    code: errorCodes.USER_NOT_FOUND,
                    message: "No user found in the database.",
                });
            else res.json({ error: false, data: rows });
        });
    });
});

// Fetch user from id.
router.get("/id/:id", (req, res) => {
    const sql = "SELECT id, name, surname, email, password, UNIX_TIMESTAMP(date_joined) as date_joined, UNIX_TIMESTAMP(name_last_changed) as name_last_changed, pp, active, hash, account_type, google_id, apple_id FROM users WHERE id = ? LIMIT 1";

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [req.params.id], (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            if (!rows[0])
                return res.json({
                    error: true,
                    code: errorCodes.USER_NOT_FOUND,
                    message: "The user with the given id was not found.",
                });
            else res.json({ error: false, data: rows[0] });
        });
    });
});

// Fetch user from email.
router.get("/email/:email", (req, res) => {
    const sql = "SELECT id, name, surname, email, password, UNIX_TIMESTAMP(date_joined) as date_joined, UNIX_TIMESTAMP(name_last_changed) as name_last_changed, pp, active, hash, account_type, google_id, apple_id FROM users WHERE email = ? LIMIT 1";

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [req.params.email], (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            if (!rows[0])
                return res.json({
                    error: true,
                    code: errorCodes.USER_NOT_FOUND,
                    message: "The user with the given email address was not found.",
                });
            else res.json({ error: false, data: rows[0] });
        });
    });
});

// Login user with credentials.
router.post("/login", (req, res) => {
    const schema = Joi.object({
        email: Joi.string().min(3).max(64).required(),
        password: Joi.string().max(128).required(),
    });

    const result = schema.validate(req.body);
    if (result.error)
        return res.json({ error: true, message: result.error.details[0].message });

    const sql = "SELECT * FROM users WHERE email = ? LIMIT 1";

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [req.body.email], (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            if (!rows[0])
                return res.json({
                    error: true,
                    code: errorCodes.WRONG_EMAIL_OR_PASSWORD,
                    message: "The email or the password was incorrect.",
                });
            else {
                // We should check whether the user authenticated with default authentication or not.
                const user = rows[0];

                if (user['account_type'] === constants.ACCOUNT_DEFAULT) {
                    // User authenticated with default authentication.
                    // Compare passwords before.
                    bcrypt.compare(req.body.password, user['password'], function (err, result) {
                        if (err) return res.json({ error: true, message: err.message })

                        if (result) {
                            if (user['active'] === 1) {
                                const token = jwt.sign(
                                    {
                                        id: rows[0]['id'],
                                        email: req.body.email
                                    },
                                    process.env.JWT_PRIVATE_KEY,
                                    {
                                        expiresIn: "1h"
                                    }
                                );

                                user['token'] = token;
                            }

                            return res.json({ error: false, data: user });
                        } else {
                            return res.json({
                                error: true,
                                code: errorCodes.WRONG_EMAIL_OR_PASSWORD,
                                message: "The email or the password was incorrect.",
                            });
                        }
                    });
                } else {
                    return res.json({
                        error: true,
                        code: errorCodes.USER_REGISTERED_WITH_ANOTHER_PROVIDER,
                        message: "The email address is registered with another service. (Google or Apple)",
                    });
                }
            }
        });
    });
});

// Login user with Google.
router.post("/login/google", (req, res) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(64).required(),
        surname: Joi.string().max(64).required(),
        email: Joi.string().min(3).max(64).required(),
        pp: Joi.string().max(1024).allow(null).required(),
        google_id: Joi.string().required()
    });

    const result = schema.validate(req.body);
    if (result.error)
        return res.json({ error: true, message: result.error.details[0].message });

    const sql = "SELECT * FROM users WHERE email = ? LIMIT 1";

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [req.body.email, req.body.password], (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            if (!rows[0]) {
                // The user with the same email address was not
                // found on the server. Create a new record.
                createGoogleUser(req.body.name, req.body.surname, req.body.email, req.body.pp, req.body.google_id, res);
            } else {
                // We got a record with the same email address.
                // Let's check whether it's google_account or not.
                let user = rows[0];

                if (user['account_type'] === constants.ACCOUNT_GOOGLE) {
                    // The user is google_account.
                    // Approve the login process.
                    const token = jwt.sign(
                        {
                            id: user['id'],
                            email: req.body.email
                        },
                        process.env.JWT_PRIVATE_KEY,
                        {
                            expiresIn: "1h"
                        }
                    );

                    user['token'] = token;
                    return res.json({ error: false, data: user });
                } else {
                    // The email address was registered with
                    // non-google account before. Deny the process.
                    return res.json({
                        error: true,
                        code: errorCodes.USER_REGISTERED_WITH_ANOTHER_PROVIDER,
                        message:
                            "The email address was registered with another provider. (Password or Apple)",
                    });
                }
            }
        });
    });
});

// Login user with Apple.
router.post("/login/apple", (req, res) => {
    const schema = Joi.object({
        apple_id: Joi.string().required()
    });

    const result = schema.validate(req.body);
    if (result.error)
        return res.json({ error: true, message: result.error.details[0].message });

    const sql = "SELECT * FROM users WHERE apple_id = ? LIMIT 1";

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [req.body.apple_id], (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            if (!rows[0]) {
                return res.json({
                    error: true,
                    code: errorCodes.USER_NOT_FOUND,
                    message: "The user with the given Apple ID was not found on the server.",
                });
            } else {
                const user = rows[0];

                const token = jwt.sign(
                    {
                        id: rows[0]['id'],
                        email: req.body.email
                    },
                    process.env.JWT_PRIVATE_KEY,
                    {
                        expiresIn: "1h"
                    }
                );

                user['token'] = token;

                return res.json({ error: false, data: user });
            }
        });
    });
});

// Create a user with default configuration.
router.post("/", (req, res) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(64).required(),
        surname: Joi.string().max(64).required(),
        email: Joi.string().min(3).max(64).required(),
        password: Joi.string().max(128).required(),
    });

    const result = schema.validate(req.body);
    if (result.error)
        return res.json({ error: true, message: result.error.details[0].message });

    const sql = "SELECT * FROM users WHERE email = ? LIMIT 1";

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [req.body.email], (error, rows) => {
            if (error) {
                conn.release();
                return res.json({ error: true, message: error.message });
            }

            if (!rows[0]) {
                // There was no record with the same email address.
                // Create the user.
                const sql2 =
                    "INSERT INTO users (name, surname, email, password, hash) VALUES (?,?,?,?,?)";

                bcrypt.hash(req.body.password, 10, function (err, hashedPassword) {
                    if (err) return res.json({ error: true, message: err.message });

                    const hashedEmail = crypto
                        .createHash("md5")
                        .update(req.body.email)
                        .digest("hex");

                    conn.query(sql2, [req.body.name, req.body.surname, req.body.email, hashedPassword, hashedEmail], (error2, rows2) => {
                        conn.release();
                        if (error2)
                            return res.json({ error: true, message: error2.message });

                        if (rows2['insertId'] === 0) {
                            return res.json({
                                error: true,
                                code: errorCodes.USER_CAN_NOT_BE_CREATED,
                                message: 'The user can not be created.',
                            });
                        } else {
                            sendRegisterMail(
                                req.body.name,
                                req.body.email,
                                rows2['insertId'],
                                hashedEmail
                            );
                            return res.json({ error: false, data: rows2['insertId'] });
                        }
                    });
                });
            } else {
                // The user was already exists with this email address.
                return res.json({
                    error: true,
                    code: errorCodes.USER_ALREADY_EXISTS,
                    message: 'The user already exists with this email address.',
                });
            }
        });
    });
});

// Create user with Google account.
router.post("/google", (req, res) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(64).required(),
        surname: Joi.string().max(64).required(),
        email: Joi.string().min(3).max(64).required(),
        pp: Joi.string().max(1024).allow(null).required(),
    });

    const result = schema.validate(req.body);
    if (result.error)
        return res.json({ error: true, message: result.error.details[0].message });

    createGoogleUser(req.body.name, req.body.surname, req.body.email, req.body.pp, res);
});

// Create a user with Apple account.
router.post("/apple/create", (req, res) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(64).required(),
        surname: Joi.string().max(64).required(),
        email: Joi.string().min(3).max(64).required(),
        apple_id: Joi.string().required()
    });

    const result = schema.validate(req.body);
    if (result.error)
        return res.json({ error: true, message: result.error.details[0].message });

    const sql = "SELECT * FROM users WHERE email = ? LIMIT 1";

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [req.body.email], (error, rows) => {
            if (error) {
                conn.release();
                return res.json({ error: true, message: error.message });
            }

            if (!rows[0]) {
                const sql2 = "INSERT INTO users (name, surname, email, hash, active, account_type, apple_id) VALUES (?,?,?,?,1,?,?)";
                const hash = crypto.createHash("md5").update(req.body.email).digest("hex");

                conn.query(sql2, [req.body.name, req.body.surname, req.body.email, hash, constants.ACCOUNT_APPLE, req.body.apple_id], (error2, rows2) => {
                    if (error2) {
                        conn.release();
                        return res.json({ error: true, message: error2.message });
                    }

                    if (rows2['insertId'] !== 0) {
                        const token = jwt.sign(
                            {
                                id: rows2['insertId'],
                                email: req.body.email
                            },
                            process.env.JWT_PRIVATE_KEY,
                            {
                                expiresIn: "1h"
                            }
                        );

                        sendWelcomeMail(req.body.name, req.body.email);

                        return res.json({ error: false, id: rows2["insertId"], token: token });
                    } else {
                        return res.json({
                            error: true,
                            code: errorCodes.USER_CAN_NOT_BE_CREATED,
                            message: 'The user can not be created.'
                        });
                    }
                });
            } else {
                // The user was already exists with this email address.
                return res.json({
                    error: true,
                    code: errorCodes.USER_ALREADY_EXISTS,
                    message: 'The user already exists with this email address.',
                });
            }
        });
    });

});

// Change user name.
router.put("/changeUserName/", async (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required(),
        name: Joi.string().required(),
    });

    const result = schema.validate(req.body);
    if (result.error)
        return res.json({ error: true, message: result.error.details[0].message });

    await canChangeUserName(req.body.id, req.body.name, res);
});

// Change profile picture.
router.put("/changeProfilePicture", async (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required(),
        image: Joi.string().base64().required(),
    });

    const result = schema.validate(req.body);
    if (result.error)
        return res.json({ error: true, message: result.error.details[0].message });

    let sql = "";
    let data = [];

    // First we need to check if there is a user and
    // user previously have a profile picture.
    // If so we delete the profile picture and upload the new one.
    sql = "SELECT account_type, pp FROM users WHERE id = ? LIMIT 1";
    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [req.body.id], (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            if (!rows[0]) {
                return res.json({ error: true, message: 'The user with the given id was not found on the server.' });
            } else {
                if (rows[0]['account_type'] === constants.ACCOUNT_DEFAULT && rows[0]['pp'] !== null && rows[0]['pp'] !== undefined) {
                    // There was a profile picture before.
                    // Delete the file. We need to strip the url
                    // in order to get the bucket file path.
                    // Let's strip down before /quiz_question_images/..
                    // https://storage.googleapis.com/anatomica-ec2cd.appspot.com/user_profile_images/1631631802266.jpg

                    let image = rows[0]['pp'];
                    let imageUrl = image.split("anatomica-ec2cd.appspot.com/")[1];

                    if (defaultBucket.file(imageUrl).exists()) {
                        async function deleteFile() {
                            await defaultBucket.file(imageUrl).delete();
                        }
                    }
                }

                // Image processing part.
                const imageBuffer = Buffer.from(req.body.image, "base64");
                const byteArray = new Uint8Array(imageBuffer);
                const fileURL = `user_profile_images/${new Date().getTime()}.jpg`;
                const file = defaultBucket.file(fileURL);

                file.save(byteArray).then(async () => {
                    file.makePublic();

                    const url = `https://storage.googleapis.com/anatomica-ec2cd.appspot.com/${fileURL}`;

                    data = [url, req.body.id];

                    sql = "UPDATE users SET pp = ? WHERE id = ?";

                    pool.getConnection(function (err, conn) {
                        if (err) return res.json({ error: true, message: err.message });
                        conn.query(sql, data, (error, rows) => {
                            conn.release();
                            if (error) return res.json({ error: true, message: error.message });

                            if (rows['affectedRows'] === 0) {
                                return res.json({
                                    error: true,
                                    code: errorCodes.PROFILE_PICTURE_CAN_NOT_BE_CHANGED,
                                    message: 'The user with the given id can not be updated.',
                                });
                            } else {
                                return res.json({ error: false, data: data });
                            }
                        });
                    });
                });
            }
        });
    });
});

// Send verify email again.
router.post("/sendVerificationEmail", (req, res) => {
    const schema = Joi.object({
        email: Joi.string().min(3).max(64).required(),
        password: Joi.string().max(128).required(),
    });

    const result = schema.validate(req.body);
    if (result.error)
        return res.json({ error: true, message: result.error.details[0].message });

    const sql = "SELECT * FROM users WHERE email = ? AND password = ?";

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [req.body.email, req.body.password], (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            if (!rows[0]) {
                return res.json({
                    error: true,
                    code: errorCodes.USER_NOT_FOUND,
                    message: 'The user with the given information was not found on the server.'
                });
            } else {
                const user = rows[0];

                // Let's check if the user authenticated with password or any
                // other provider. If default send, if not deny.
                if (user['account_type'] === constants.ACCOUNT_DEFAULT) {
                    // Also we should check if the user activated his/her account before.
                    // We shouldn't send redundant mails.
                    if (user['active'] === 0) {
                        // User hasn't activated his/her account yet.
                        const hash = crypto
                            .createHash("md5")
                            .update(req.body.email)
                            .digest("hex");

                        sendRegisterMail(rows[0]['name'], req.body.email, rows[0]['id'], hash);

                        return res.json({
                            error: false,
                            data: "A verification email has been sent."
                        });
                    } else {
                        return res.json({
                            error: true,
                            code: errorCodes.ACCOUNT_ALREADY_ACTIVATED,
                            data: "The user with the given id already activated his/her account. No need to verify mail address."
                        });
                    }
                } else {
                    return res.json({
                        error: true,
                        code: errorCodes.NO_NEED_TO_VERIFY,
                        data: "The user with the given id authenticated with other providers. No need to verify mail address."
                    });
                }
            }
        });
    });
});

// Verify mail address.
router.get("/verify/:id/:hash", (req, res) => {
    const sql = "UPDATE users SET active = 1 WHERE id = ? AND hash = ?";

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [req.params.id, req.params.hash], (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            if (rows['affectedRows'] === 0) {
                return res.json({
                    error: true,
                    code: errorCodes.USER_CAN_NOT_BE_VERIFIED,
                    message: "The user with the given information can not be updated.",
                });
            } else {
                let pagePath = path.join(__dirname, "../page_templates/verify_mail.html");

                fs.readFile(pagePath, function (err, data) {
                    if (err) return res.json({ error: true, message: err.message });

                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.write(data);
                    return res.end();
                });
            }
        });
    });
});

// Send password reset request.
router.post("/password/resetMail/", (req, res) => {
    const schema = Joi.object({
        email: Joi.string().min(3).max(64).required()
    });

    const result = schema.validate(req.body);
    if (result.error)
        return res.json({ error: true, message: result.error.details[0].message });

    const sql = "SELECT * FROM users WHERE email = ?";

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [req.body.email], (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            if (!rows[0]) {
                return res.json({
                    error: true,
                    code: errorCodes.USER_NOT_FOUND,
                    message: 'The user with the given information was not found on the server.'
                });
            } else {
                const user = rows[0];

                // Let's check whether or not the user authenticated with email and password.

                if (user['account_type'] === constants.ACCOUNT_DEFAULT) {
                    // Create a JWT for sending link to the user.
                    const token = jwt.sign(
                        {
                            id: user['id'],
                            email: req.body.email
                        },
                        process.env.JWT_PRIVATE_KEY_RESET,
                        {
                            expiresIn: "1h"
                        }
                    );

                    // Hash this token in order to save it in the database.
                    bcrypt.hash(token, 10, function (err, hashedToken) {
                        if (err) return res.json({ error: true, message: err.message });

                        // We got the hashed token.
                        // Let's save it to the database.
                        const sql2 = "UPDATE users SET reset_token = ? WHERE id = ?";

                        conn.query(sql2, [hashedToken, user['id']], (error2, rows2) => {
                            if (error2) return res.json({ error: true, message: error2.message });

                            if (rows2['affectedRows'] !== 0) {
                                // Everything is awesome! Let's send the email.

                                sendPasswordResetMail(user['id'], req.body.email, token);

                                return res.json({
                                    error: false,
                                    message: 'The password reset mail has been successfully sent.'
                                });
                            } else {
                                return res.json({
                                    error: true,
                                    code: errorCodes.PASSWORD_RESET_TOKEN_CANNOT_BE_CREATED,
                                    message: 'There was an error while trying to create the reset password token.'
                                });
                            }
                        });
                    });
                }else {
                    return res.json({
                        error: true,
                        code: errorCodes.USER_REGISTERED_WITH_ANOTHER_PROVIDER,
                        message: 'The user registered with another provider. (Google or Apple)'
                    });
                }
            }
        });
    });
});

// Reset password page.
router.get("/password/reset/:id/:token", (req, res) => {
    // Let's first check if the token is valid.
    try {
        const decoded = jwt.verify(req.params.token, process.env.JWT_PRIVATE_KEY_RESET);

        const sql = "SELECT * FROM users WHERE id = ?";

        pool.getConnection(function (err, conn) {
            if (err) return res.json({ error: true, message: err.message });
            conn.query(sql, [req.params.id], (error, rows) => {
                conn.release();
                if (error) return res.json({ error: true, message: error.message });

                if (!rows[0]) {
                    fs.readFile(path.join(__dirname, "../page_templates/expired_token.html"), function (err, data) {
                        if (err) return res.json({ error: true, message: err.message });

                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.write(data);
                        return res.end();
                    });
                } else {
                    const user = rows[0];
                    // Let's check if the reset_token is NULL.

                    if (!user.reset_token) {
                        // Reset token is NULL.
                        fs.readFile(path.join(__dirname, "../page_templates/expired_token.html"), function (err, data) {
                            if (err) return res.json({ error: true, message: err.message });

                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.write(data);
                            return res.end();
                        });
                    } else {
                        // Let's compare the JWT and hashed token.
                        bcrypt.compare(req.params.token, user.reset_token, function (err, result) {
                            if (err) return res.json({ error: true, message: err.message })

                            if (result) {
                                // The reset token is valid. Show the HTML.
                                let pagePath = path.join(__dirname, "../page_templates/reset_password.html");

                                fs.readFile(pagePath, function (err, data) {
                                    if (err) return res.json({ error: true, message: err.message });

                                    res.writeHead(200, { 'Content-Type': 'text/html' });
                                    res.write(data);
                                    return res.end();
                                });
                            } else {
                                // Reset token is invalid or expired.
                                fs.readFile(path.join(__dirname, "../page_templates/expired_token.html"), function (err, data) {
                                    if (err) return res.json({ error: true, message: err.message });

                                    res.writeHead(200, { 'Content-Type': 'text/html' });
                                    res.write(data);
                                    return res.end();
                                });
                            }
                        });
                    }
                }
            });
        });
    } catch (error) {
        fs.readFile(path.join(__dirname, "../page_templates/expired_token.html"), function (err, data) {
            if (err) return res.json({ error: true, message: err.message });

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.write(data);
            return res.end();
        });
    }
});

// Reset password.
router.put("/password/update", (req, res) => {
    const schema = Joi.object({
        id: Joi.number().required(),
        token: Joi.string().required(),
        password: Joi.string().required()
    });

    console.log('Reset password body: ' + req.body);

    const result = schema.validate(req.body);
    if (result.error)
        return res.json({ error: true, message: result.error.details[0].message });

    const sql = "SELECT * FROM users WHERE id = ?";

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [req.body.id], (error, rows) => {
            if (error) return res.json({ error: true, message: error.message });

            console.log('Reset password user: ' + rows);

            if (!rows[0]) {
                return res.json({
                    error: true,
                    code: errorCodes.USER_NOT_FOUND,
                    message: "The user with the given information can not be found.",
                });
            } else {
                const user = rows[0];
                // Let's check if the reset_token is NULL.

                if (!user['reset_token']) {
                    // Reset token is NULL.
                    return res.json({
                        error: true,
                        code: errorCodes.INVALID_RESET_TOKEN,
                        message: "Invalid or expired reset token.",
                    });
                } else {
                    // Let's compare the JWT and hashed token.
                    bcrypt.compare(req.body.token, user['reset_token'], function (err, result) {
                        if (err) return res.json({ error: true, message: err.message })

                        if (result) {
                            // The reset token is valid. Show the HTML.

                            bcrypt.hash(req.body.password, 10, function (err, hashedPassword) {
                                if (err) return res.json({ error: true, message: err.message });

                                if (user['password'] === hashedPassword) {
                                    // New password is same as old password.
                                    return res.json({
                                        error: true,
                                        code: errorCodes.NEW_PASSWORD_CANNOT_BE_SAME_AS_OLD,
                                        message: 'Your new password can not be the same as your old one.'
                                    })
                                } else {
                                    const sql2 = "UPDATE users SET password = ?, reset_token = ? WHERE id = ?";

                                    conn.query(sql2, [hashedPassword, null, req.body.id], (error2, rows2) => {
                                        conn.release();
                                        if (error2) return res.json({ error: true, message: error2.message });

                                        if (rows2['affectedRows'] !== 0) {
                                            // Password changed successfully.
                                            return res.json({
                                                error: false,
                                                message: "Your password was changed successfully.",
                                            });
                                        } else {
                                            return res.json({
                                                error: true,
                                                code: errorCodes.PASSWORD_CANNOT_BE_CHANGED,
                                                message: "The password can not be changed. Please try again later.",
                                            });
                                        }
                                    });
                                }
                            });
                        } else {
                            // Reset token is invalid or expired.
                            return res.json({
                                error: true,
                                code: errorCodes.INVALID_RESET_TOKEN,
                                message: "Invalid or expired reset token.",
                            });
                        }
                    });
                }
            }
        });
    });
});

// ***** Helper Functions *****
async function sendRegisterMail(name, email, id, hash) {
    let mailPath = path.join(__dirname, "../mail_templates/register.html");

    // Prepare the HTML with replacing the placeholder strings.
    fs.readFile(mailPath, "utf8", async function (err, data) {
        if (err) return err.message;

        let verifyUrl = `https://anatomica-scx43dzaka-ew.a.run.app/v1/users/verify/${id}/${hash}`;

        let result = data.replace(/{NAME}/g, name);
        result = result.replace(/{EMAIL}/g, email);
        result = result.replace(/{VERIFY_URL}/g, verifyUrl);

        // Send the mail.
        const transport = nodemailer.createTransport(
            smtp({
                host: process.env.MAILJET_SMTP_SERVER,
                port: 2525,
                auth: {
                    user: process.env.MAILJET_API_KEY,
                    pass: process.env.MAILJET_SECRET_KEY
                }
            })
        );

        const json = await transport.sendMail({
            from: "Anatomica <" + process.env.MAIL_USER + ">",
            to: email,
            subject: "Anatomica | Üyelik Aktivasyonu",
            html: result,
        });

        console.log(json);
    });
}

async function sendWelcomeMail(name, email) {
    let mailPath = path.join(__dirname, "../mail_templates/register_google.html");

    // Prepare the HTML with replacing the placeholder strings.
    fs.readFile(mailPath, "utf8", async function (err, data) {
        if (err) return err.message;

        let result = data.replace(/{NAME}/g, name);
        result = result.replace(/{EMAIL}/g, email);

        // Send the mail.
        const transport = nodemailer.createTransport(
            smtp({
                host: process.env.MAILJET_SMTP_SERVER,
                port: 2525,
                auth: {
                    user: process.env.MAILJET_API_KEY,
                    pass: process.env.MAILJET_SECRET_KEY
                }
            })
        );

        const json = await transport.sendMail({
            from: "Anatomica <" + process.env.MAIL_USER + ">",
            to: email,
            subject: "Anatomica | Hoş Geldiniz",
            html: result,
        });

        console.log(json);
    });
}

async function sendPasswordResetMail(id, email, token) {
    let mailPath = path.join(__dirname, "../mail_templates/reset_password.html");
    let resetURL = 'https://anatomica-scx43dzaka-ew.a.run.app/v1/users/password/reset/' + id + '/' + token;

    // Prepare the HTML with replacing the placeholder strings.
    fs.readFile(mailPath, "utf8", async function (err, data) {
        if (err) return err.message;

        let result = data.replace(/{RESET_URL}/g, resetURL);
        result = result.replace(/{EMAIL}/g, email);

        // Send the mail.
        const transport = nodemailer.createTransport(
            smtp({
                host: process.env.MAILJET_SMTP_SERVER,
                port: 2525,
                auth: {
                    user: process.env.MAILJET_API_KEY,
                    pass: process.env.MAILJET_SECRET_KEY
                }
            })
        );

        const json = await transport.sendMail({
            from: "Anatomica <" + process.env.MAIL_USER + ">",
            to: email,
            subject: "Anatomica | Parola Sıfırlama Talebi",
            html: result,
        });

        console.log(json);
    });
}

function createGoogleUser(name, surname, email, pp, google_id, res) {
    const sql =
        "INSERT INTO users (name, surname, email, pp, hash, active, account_type, google_id) VALUES (?,?,?,?,?,1,?,?)";
    const hash = crypto.createHash("md5").update(email).digest("hex");

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [name, surname, email, pp, hash, constants.ACCOUNT_GOOGLE, google_id], (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            if (rows['insertId'] !== 0) {
                const token = jwt.sign(
                    {
                        id: rows["insertId"],
                        email: email
                    },
                    process.env.JWT_PRIVATE_KEY,
                    {
                        expiresIn: "1h"
                    }
                );

                sendWelcomeMail(name, email);

                return res.json({ error: false, id: rows["insertId"], token: token });
            } else {
                return res.json({
                    error: true,
                    code: errorCodes.USER_CAN_NOT_BE_CREATED,
                    message: 'The user can not be created.'
                });
            }
        });
    });
}

async function canChangeUserName(id, name, res) {
    const sql =
        "SELECT IF(TIMESTAMPDIFF(DAY,name_last_changed,CURRENT_TIMESTAMP()) >= 30 OR users.name_last_changed IS NULL, true, false) AS canChangeName FROM users WHERE id = ?";

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [id], (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            if (!rows[0]) {
                // The user with the given id was not found.
                return res.json({
                    error: true,
                    code: errorCodes.USER_NOT_FOUND,
                    message: "The user with the given id was not found on the server.",
                });
            } else {
                if (!rows[0]["canChangeName"]) {
                    // User can't change his/her name.
                    return res.json({
                        error: true,
                        code: errorCodes.NAME_CAN_NOT_BE_CHANGED_DUE_TO_LIMIT,
                        message: "User name can not be changed more than once in a month.",
                    });
                } else {
                    changeUserName(id, name, res);
                }
            }
        });
    });
}

async function changeUserName(id, name, res) {
    const sql = "UPDATE users SET name = ? WHERE id = ?";

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [name, id], (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            return res.json({ error: false, name: name });
        });
    });
}

module.exports = router;
