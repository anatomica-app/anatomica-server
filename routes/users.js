const express = require("express");
const router = express.Router();

const Joi = require("joi");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const smtp = require('nodemailer-smtp-transport');
const { Storage } = require('@google-cloud/storage');
const {OAuth2Client} = require('google-auth-library');
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const pool = require('../database');
const constants = require('./constants');
const errorCodes = require('./errors');

// ***** Google Cloud Storage *****
const storage = new Storage();
const defaultBucket = storage.bucket('anatomica-storage');

const apiPrefix = 'https://quiz.debug.api.anatomica-app.com/';
const apiVersion = 'v1';

// ***** Google OAuth2 Client *****
const client = new OAuth2Client(process.env.GOOGLE_OAUTH2_CLIENT_ID);

// Login user with credentials.
router.post("/login", async (req, res) => {
    const schema = Joi.object({
        email: Joi.string().min(3).max(64).required(),
        password: Joi.string().max(128).required(),
    });

    const result = schema.validate(req.body);
    if (result.error)
        return res.status(400).json({ message: result.error.details[0].message });

    const sql = "CALL fetch_user_by_email(?);";

    pool.getConnection(function (err, conn) {
        if (err) return res.status(500).json({ message: err.message });
        conn.query(sql, [req.body.email], (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({ message: error.message });

            if (!rows[0][0])
                return res.status(404).json({
                    message: "The email or the password was incorrect.",
                });
            else {
                // We should check whether the user authenticated with default authentication or not.
                let user = rows[0][0];

                if (user.accountType === constants.ACCOUNT_DEFAULT) {
                    // User authenticated with default authentication.
                    // Compare passwords before.
                    bcrypt.compare(req.body.password, user.password, function (err, result) {
                        if (err) return res.status(500).json({ message: err.message })

                        if (result) {
                            if (user.isActive === 1) {
                                const token = jwt.sign(
                                    {
                                        id: user.id,
                                        email: req.body.email
                                    },
                                    process.env.JWT_PRIVATE_KEY,
                                    {
                                        expiresIn: "1h"
                                    }
                                );

                                user.token = token;
                            }

                            return res.send(user);
                        } else {
                            return res.status(404).json({
                                message: "The email or the password was incorrect.",
                            });
                        }
                    });
                } else {
                    return res.status(400).json({
                        message: "The email address is registered with another service. (Google or Apple)",
                    });
                }
            }
        });
    });
});

// Login user with Google.
router.post("/google", async (req, res) => {
    const schema = Joi.object({
        idToken: Joi.string().required()
    });

    const result = schema.validate(req.body);
    if (result.error)
        return res.status(400).json({ message: result.error.details[0].message });

    const verifyGoogleAccountResponse = await verifyGoogleAccount(req.body.idToken);
    if (!verifyGoogleAccountResponse) {
        console.error('Verify Google Account Response: ' + verifyGoogleAccountResponse);
        return res.status(500).json({message: 'Failed to authenticate with Google.'});
    }

    // Id token has been verified successfully.
    // Now check if there is a valid user that has been logged in before.

    const name = verifyGoogleAccountResponse.given_name;
    const lastName = verifyGoogleAccountResponse.family_name;
    const email = verifyGoogleAccountResponse.email;
    const picture = verifyGoogleAccountResponse.picture;
    const googleId = verifyGoogleAccountResponse.sub;

    // Begin the process with the collected user info.
    const sql = "CALL fetch_user_by_email(?);";

    pool.getConnection(function (err, conn) {
        if (err) return res.status(500).json({ message: err.message });
        conn.query(sql, [email], (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({ message: error.message });

            if (!rows[0][0]) {
                // The user with the same email address was not
                // found on the server. Create a new record.
                createGoogleUser(name, lastName,email, picture, googleId, res);
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
                            email: email
                        },
                        process.env.JWT_PRIVATE_KEY,
                        {
                            expiresIn: "1h"
                        }
                    );

                    user.token = token;
                    return res.send(user);
                } else {
                    // The email address was registered with
                    // non-google account before. Deny the process.
                    return res.status(409).json({
                        message:
                            "The email address was registered with another provider. (Password or Apple)",
                    });
                }
            }
        });
    });
});

// Login user with Apple.
router.post("/apple", (req, res) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(64).allow(null),
        lastName: Joi.string().max(64).allow(null),
        email: Joi.string().min(3).max(64).allow(null),
        appleId: Joi.string().required()
    });

    const result = schema.validate(req.body);
    if (result.error)
        return res.status(400).json({ message: result.error.details[0].message });

    const sql = "SELECT * FROM users WHERE apple_id = ? LIMIT 1";

    pool.getConnection(function (err, conn) {
        if (err) return res.status(500).json({ message: err.message });
        conn.query(sql, [req.body.appleId], (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({ message: error.message });

            if (!rows[0][0]) {
                // The user with the same email address was not
                // found on the server. Create a new record.
                if (req.body.name && req.body.lastName && req.body.email) {
                    createAppleUser(req.body.name, req.body.lastName, req.body.email, req.body.appleId, res);
                } else {
                    return res.status(404).json({
                        message: "The user with the given Apple ID was not found on the server.",
                    });
                }
            } else {
                let user = rows[0];

                const token = jwt.sign(
                    {
                        id: user.id,
                        email: req.body.email
                    },
                    process.env.JWT_PRIVATE_KEY,
                    {
                        expiresIn: "1h"
                    }
                );

                user.token = token;

                return res.send(user);
            }
        });
    });
});

// Create a user with default configuration.
router.post("/", (req, res) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(64).required(),
        lastName: Joi.string().max(64).required(),
        email: Joi.string().min(3).max(64).required(),
        password: Joi.string().max(128).required(),
    });

    const result = schema.validate(req.body);
    if (result.error)
        return res.json({ message: result.error.details[0].message });

    const sql = "CALL fetch_user_by_email(?);";

    pool.getConnection(function (err, conn) {
        if (err) return res.status(500).json({ message: err.message });
        conn.query(sql, [req.body.email], (error, rows) => {
            if (error) {
                conn.release();
                return res.status(500).json({ message: error.message });
            }

            if (!rows[0][0]) {
                // There was no record with the same email address.
                // Create the user.
                const sql2 =
                    "CALL create_user(?,?,?,?,?);";

                bcrypt.hash(req.body.password, 10, function (err, hashedPassword) {
                    if (err) return res.status(500).json({ message: err.message });

                    // Create a new JWT.
                    const token = jwt.sign(
                        {
                            email: req.body.email
                        },
                        process.env.JWT_PRIVATE_KEY,
                        {
                            expiresIn: "1h"
                        }
                    );

                    conn.query(sql2, [req.body.name, req.body.lastName, req.body.email, hashedPassword, token], (error2, rows2) => {
                        conn.release();
                        if (error2)
                            return res.status(500).json({ message: error2.message });

                        let result = rows2[0][0];

                        if (result.insertId === 0) {
                            return res.status(500).json({
                                message: 'The user can not be created.',
                            });
                        } else {
                            sendRegisterMail(
                                req.body.name,
                                req.body.email,
                                result.insertId,
                                token
                            );
                            return res.send({ id: result.insertId });
                        }
                    });
                });
            } else {
                // The user was already exists with this email address.
                return res.status(409).json({
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
        return res.status(500).json({ message: result.error.details[0].message });

    let sql = "";
    let data = [];

    // First we need to check if there is a user and
    // user previously have a profile picture.
    // If so we delete the profile picture and upload the new one.
    sql = "SELECT account_type, profile_photo FROM users WHERE user_id = ? LIMIT 1";
    pool.getConnection(function (err, conn) {
        if (err) return res.status(500).json({ message: err.message });
        conn.query(sql, [req.body.id], (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({ message: error.message });

            if (!rows[0]) {
                return res.status(404).json({ message: 'The user with the given id was not found on the server.' });
            } else {
                const user = rows[0];
                if (user.accountType === constants.ACCOUNT_DEFAULT && user.pp !== null && user.pp !== undefined) {
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
                const imageBuffer = Buffer.from(req.body.image, "base64");
                const byteArray = new Uint8Array(imageBuffer);
                const fileURL = `user_profile_images/${new Date().getTime()}.jpg`;
                const file = defaultBucket.file(fileURL);

                file.save(byteArray).then(async () => {
                    file.makePublic();

                    const url = `https://storage.googleapis.com/anatomica-storage/${fileURL}`;

                    data = [url, req.body.id];

                    sql = "UPDATE users SET profile_photo = ? WHERE user_id = ?";

                    pool.getConnection(function (err, conn) {
                        if (err) return res.status(500).json({ message: err.message });
                        conn.query(sql, data, (error, rows) => {
                            conn.release();
                            if (error) return res.json({ error: true, message: error.message });

                            if (rows.affectedRows === 0) {
                                return res.json({
                                    message: 'The user with the given id can not be updated.',
                                });
                            } else {
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
router.post("/sendVerificationEmail", (req, res) => {
    const schema = Joi.object({
        email: Joi.string().min(3).max(64).required()
    });

    const result = schema.validate(req.body);
    if (result.error)
        return res.status(500).json({ message: result.error.details[0].message });

    const sql = "CALL fetch_user_by_email(?);";

    pool.getConnection(function (err, conn) {
        if (err) return res.status(500).json({ message: err.message });
        conn.query(sql, [req.body.email], (error, rows) => {
            if (error) return res.status(500).json({ message: error.message });

            if (!rows[0]) {
                return res.status(404).json({
                    message: 'The user with the given information was not found on the server.'
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
                                email: req.body.email
                            },
                            process.env.JWT_PRIVATE_KEY,
                            {
                                expiresIn: "1h"
                            }
                        );

                        const sql2 = "CALL update_user_verification_hash();";

                        conn.query(sql2, [token, req.body.email], (error2, rows2) => {
                            if (error) return res.status(500).json({ message: error2.message });

                            sendRegisterMail(user.name, req.body.email, user.id, token);

                            return res.send({
                                data: "A verification email has been sent."
                            });
                        });
                    } else {
                        return res.status(409).json({
                            data: "The user with the given id already activated his/her account. No need to verify mail address."
                        });
                    }
                } else {
                    return res.status(409).json({
                        data: "The user with the given id authenticated with other providers. No need to verify mail address."
                    });
                }
            }
        });
    });
});

// Verify mail address.
router.get("/verify/:id/:hash", (req, res) => {

    try {
        const token = req.params.hash
        const decoded = jwt.verify(token, process.env.JWT_PRIVATE_KEY);
        req.userData = decoded;

        const sql = "CALL update_user_active_status(?, ?);";

        pool.getConnection(function (err, conn) {
            if (err) return res.status(500).json({ message: err.message });
            conn.query(sql, [req.params.id, req.params.hash], (error, rows) => {
                conn.release();
                if (error) return res.status(500).json({ message: error.message });

                if (rows.affectedRows === 0) {
                    return res.status(500).json({
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
    } catch (error) {
        let pagePath = path.join(__dirname, "../page_templates/expired_token.html");

        fs.readFile(pagePath, function (err, data) {
            if (err) return res.json({ error: true, message: err.message });

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.write(data);
            return res.end();
        });
    }
});

// Send password reset request.
router.post("/password/resetMail/", (req, res) => {
    const schema = Joi.object({
        email: Joi.string().min(3).max(64).required()
    });

    const result = schema.validate(req.body);
    if (result.error)
        return res.status(400).json({ message: result.error.details[0].message });

    const sql = "CALL fetch_user_by_email(?)";

    pool.getConnection(function (err, conn) {
        if (err) return res.status(500).json({ message: err.message });
        conn.query(sql, [req.body.email], (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({ message: error.message });

            if (!rows[0][0]) {
                return res.status(404).json({
                    message: 'The user with the given information was not found on the server.'
                });
            } else {
                const user = rows[0][0];

                // Let's check whether or not the user authenticated with email and password.

                if (user.accountType === constants.ACCOUNT_DEFAULT) {
                    // Create a JWT for sending link to the user.
                    const token = jwt.sign(
                        {
                            id: user.id,
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
                        const sql2 = "CALL update_password_reset_token(?, ?)";

                        conn.query(sql2, [user.id, hashedToken], (error2, rows2) => {
                            if (error2) return res.json({ error: true, message: error2.message });

                            if (rows2.affectedRows !== 0) {
                                // Everything is awesome! Let's send the email.

                                sendPasswordResetMail(user.id, user.name, req.body.email, token);

                                return res.send({
                                    message: 'The password reset mail has been successfully sent.'
                                });
                            } else {
                                return res.status(500).json({
                                    message: 'There was an error while trying to create the reset password token.'
                                });
                            }
                        });
                    });
                } else {
                    return res.status(409).json({
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

        const sql = 'CALL fetch_user_by_id(?);';

        pool.getConnection(function (err, conn) {
            if (err) return res.status(500).json({ message: err.message });
            conn.query(sql, [req.params.id], (error, rows) => {
                conn.release();
                if (error) return res.status(500).json({ message: error.message });

                if (!rows[0][0]) {
                    fs.readFile(path.join(__dirname, "../page_templates/expired_token.html"), function (err, data) {
                        if (err) return res.status(500).json({ message: err.message });

                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.write(data);
                        return res.end();
                    });
                } else {
                    const user = rows[0][0];
                    // Let's check if the reset_token is NULL.

                    if (!user.resetToken) {
                        // Reset token is NULL.
                        fs.readFile(path.join(__dirname, "../page_templates/expired_token.html"), function (err, data) {
                            if (err) return res.status(500).json({ message: err.message });

                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.write(data);
                            return res.end();
                        });
                    } else {
                        // Let's compare the JWT and hashed token.
                        bcrypt.compare(req.params.token, user.resetToken, function (err, result) {
                            if (err) return res.status(500).json({ message: err.message })

                            if (result) {
                                // The reset token is valid. Show the HTML.
                                let pagePath = path.join(__dirname, "../page_templates/reset_password.html");

                                fs.readFile(pagePath, function (err, data) {
                                    if (err) return res.status(500).json({ message: err.message });

                                    res.writeHead(200, { 'Content-Type': 'text/html' });
                                    res.write(data);
                                    return res.end();
                                });
                            } else {
                                // Reset token is invalid or expired.
                                fs.readFile(path.join(__dirname, "../page_templates/expired_token.html"), function (err, data) {
                                    if (err) return res.status(500).json({ message: err.message });

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
            if (err) return res.status(500).json({ message: err.message });

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

    const result = schema.validate(req.body);
    if (result.error)
        return res.status(500).json({ message: result.error.details[0].message });

    const sql = 'CALL fetch_user_by_id(?);';

    pool.getConnection(function (err, conn) {
        if (err) return res.status(500).json({ message: err.message });
        conn.query(sql, [req.body.id], (error, rows) => {
            if (error) return res.status(500).json({ message: error.message });

            if (!rows[0][0]) {
                return res.status(404).json({
                    message: "The user with the given information can not be found.",
                });
            } else {
                const user = rows[0][0];
                // Let's check if the reset_token is NULL.

                if (!user.resetToken) {
                    // Reset token is NULL.
                    return res.status(401).json({
                        message: "Invalid or expired reset token.",
                    });
                } else {
                    // Let's compare the JWT and hashed token.
                    bcrypt.compare(req.body.token, user.resetToken, function (err, result) {
                        if (err) return res.status(500).json({ message: err.message })

                        if (result) {
                            // The reset token is valid. Show the HTML.

                            bcrypt.hash(req.body.password, 10, function (err, hashedPassword) {
                                if (err) return res.status(500).json({ message: err.message });

                                if (user.password === hashedPassword) {
                                    // New password is same as old password.
                                    return res.status(400).json({
                                        message: 'Your new password can not be the same as your old one.'
                                    })
                                } else {
                                    const sql2 = 'CALL update_password(?,?,?);';

                                    conn.query(sql2, [req.body.id, user.resetToken, hashedPassword], (error2, rows2) => {
                                        conn.release();
                                        if (error2) return res.status(500).json({ message: error2.message });

                                        if (rows2.affectedRows !== 0) {
                                            // Password changed successfully.
                                            return res.json({
                                                message: "Your password was changed successfully.",
                                            });
                                        } else {
                                            return res.status(500).json({
                                                message: "The password can not be changed. Please try again later.",
                                            });
                                        }
                                    });
                                }
                            });
                        } else {
                            // Reset token is invalid or expired.
                            return res.status(401).json({
                                message: "Invalid or expired reset token.",
                            });
                        }
                    });
                }
            }
        });
    });
});

// Delete account.
router.delete("/", (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required(),
        email: Joi.string().min(3).max(64).required()
    });

    const result = schema.validate(req.body);
    if (result.error)
        return res.status(500).json({ message: result.error.details[0].message });

    const sql = 'CALL delete_user(?, ?);';
    
    pool.getConnection(function (err, conn) {
        if (err) return res.status(500).json({ message: err.message });
        conn.query(sql, [req.body.id, req.body.email], (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({ message: error.message });

            if (rows.affectedRows !== 0) {
                // User deleted successfully.

                // Send an email to the user.
                sendAccountDeletedMail(req.body.email);

                return res.json({
                    message: "Your account was deleted successfully.",
                });
            }

            return res.status(404).json({
                message: "The user with the given information can not be found.",
            });
        });
    });
});

// ***** Helper Functions *****
async function sendRegisterMail(name, email, id, hash) {
    let mailPath = path.join(__dirname, "../mail_templates/register.html");

    // Prepare the HTML with replacing the placeholder strings.
    fs.readFile(mailPath, "utf8", async function (err, data) {
        if (err) return err.message;

        let verifyUrl = `${apiPrefix}${apiVersion}/users/verify/${id}/${hash}`;

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

async function sendAccountDeletedMail(email) {
    let mailPath = path.join(__dirname, "../mail_templates/account_deleted.html");

    // Prepare the HTML with replacing the placeholder strings.
    fs.readFile(mailPath, "utf8", async function (err, data) {
        if (err) return err.message;

        let result = data.replace(/{EMAIL}/g, email);

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
            subject: "Anatomica | Hesabınız Silindi",
            html: result,
        });

        console.log(json);
    }); 
}

async function sendPasswordResetMail(id, name, email, token) {
    let mailPath = path.join(__dirname, "../mail_templates/reset_password.html");
    let resetURL = apiPrefix + apiVersion + '/users/password/reset/' + id + '/' + token;

    // Prepare the HTML with replacing the placeholder strings.
    fs.readFile(mailPath, "utf8", async function (err, data) {
        if (err) return err.message;

        let result = data.replace(/{RESET_URL}/g, resetURL);
        result = result.replace(/{USER}/g, name);
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

async function verifyGoogleAccount(idToken) {
    const ticket = await client.verifyIdToken({
        idToken: idToken,
        audience: process.env.GOOGLE_OAUTH2_AUDIENCE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload) {
        return null;
    }

    return payload;
}

function createGoogleUser(name, lastName, email, pp, googleId, res) {
    const sql =
        "CALL create_google_user(?,?,?,?,?,1,?,?)";
    const hash = crypto.createHash("md5").update(email).digest("hex");

    pool.getConnection(function (err, conn) {
        if (err) return res.status(500).json({ message: err.message });
        conn.query(sql, [name, lastName, email, pp, hash, constants.ACCOUNT_GOOGLE, googleId], (error, rows) => {
            if (error) return res.status(500).json({ message: error.message });
            const result = rows[0][0];

            if (result.insertId !== 0) {
                const token = jwt.sign(
                    {
                        id: result.insertId,
                        email: email
                    },
                    process.env.JWT_PRIVATE_KEY,
                    {
                        expiresIn: "1h"
                    }
                );

                sendWelcomeMail(name, email);

                const fetchUserSql = 'CALL fetch_user_by_email(?);'

                pool.getConnection(function (err2, conn2) {
                    if (err2) return res.status(500).json({ message: err2.message });
                    conn2.query(fetchUserSql, [email], (error2, rows2) => {
                        conn2.release();
                        if (error2) return res.status(500).json({ message: error2.message });

                        const user = rows2[0][0];

                        if (!user) {
                            return res.status(500).json({message: 'The user information can not be retrieved.'});
                        }

                        user.token = token;
                        return res.send(user);
                    })
                });
            } else {
                return res.status(500).json({
                    message: 'The user can not be created.'
                });
            }
        });
    });
}

function createAppleUser(name, surname, email, apple_id, res) {
    const sql =
        "INSERT INTO users (name, surname, email, hash, active, account_type, apple_id) VALUES (?,?,?,?,1,?,?)";
    const hash = crypto.createHash("md5").update(email).digest("hex");

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [name, surname, email, hash, constants.ACCOUNT_APPLE, apple_id], (error, rows) => {
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
