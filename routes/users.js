const express = require("express");
const router = express.Router();

const mysql = require("mysql");
const Joi = require("joi");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const smtp = require('nodemailer-smtp-transport');
const {Storage} = require('@google-cloud/storage');
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

// ***** MySQL Connection *****
const pool = mysql.createPool({
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DATABASE,
    socketPath: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`,
    dateStrings: true,
});

// ***** Google Cloud Storage *****
const gcs = new Storage({
    keyFilename: path.join(__dirname, '../anatomica-ec2cd-a8621075b43a.json'),
    projectId: 'anatomica-ec2cd'
});

const defaultBucket = gcs.bucket('anatomica-ec2cd.appspot.com');

// Fetch user from id.
router.get("/id/:id", (req, res) => {
    const sql = "SELECT * FROM users WHERE id = ? LIMIT 1";

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [req.params.id], (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            if (!rows[0])
                return res.json({
                    error: true,
                    message: "The user with the given id was not found.",
                });
            else res.json({ error: false, data: rows[0] });
        });
    });
});

// Fetch user from email.
router.get("/email/:email", (req, res) => {
    const sql = "SELECT * FROM users WHERE email = ? LIMIT 1";

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [req.params.email], (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            if (!rows[0])
                return res.json({
                    error: true,
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
                    message: "The email or the password was incorrect.",
                });
            else {
                // Compare passwords before.
                const user = rows[0];

                bcrypt.compare(req.body.password, user['password'], function(err, result) {
                    if (err) return res.json({ error: true, message: err.message})

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
        
                        return res.json({error: false, data: user});
                    }else {
                        return res.json({
                            error: true,
                            message: "The email or the password was incorrect.",
                        });
                    }
                });
            }
        });
    });
});

// Login user with Google.
router.post("/login/google", (req, res) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(64).required(),
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
                createGoogleUser(req.body.name, req.body.email, req.body.pp, req.body.google_id, res);
            } else {
                // We got a record with the same email address.
                // Let's check whether it's google_account or not.
                let user = rows[0];

                if (user["account_google"]) {
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
                        message:
                            "The email address was registered with non-google account. Please use your password in order to login.",
                    });
                }
            }
        });
    });
});

// Create a user with default configuration.
router.post("/", (req, res) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(64).required(),
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
                    "INSERT INTO users (name, email, password, hash) VALUES (?,?,?,?)";

                bcrypt.hash(req.body.password, 10, function(err, hashedPassword) {
                    if (err) return res.json({ error: true, message: err.message});

                    const hashedEmail = crypto
                    .createHash("md5")
                    .update(req.body.email)
                    .digest("hex");

                    conn.query(sql2, [req.body.name, req.body.email, hashedPassword, hashedEmail], (error2, rows2) => {
                        conn.release();
                        if (error2)
                            return res.json({ error: true, message: error2.message });

                        if (rows2["insertId"] === 0) {
                            return res.json({
                                error: true,
                                message: "The user can not be created.",
                            });
                        } else {
                            sendRegisterMail(
                                req.body.name,
                                req.body.email,
                                rows2["insertId"],
                                hashedEmail
                            );
                            return res.json({ error: false, data: rows2["insertId"] });
                        }
                    });
                });
            } else {
                // The user was already exists with this email address.
                return res.json({
                    error: true,
                    message: "The user already exists with this email address.",
                });
            }
        });
    });
});

// Create user with Google account.
router.post("/google", (req, res) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(64).required(),
        email: Joi.string().min(3).max(64).required(),
        pp: Joi.string().max(1024).allow(null).required(),
    });

    const result = schema.validate(req.body);
    if (result.error)
        return res.json({ error: true, message: result.error.details[0].message });

    createGoogleUser(req.body.name, req.body.email, req.body.pp, res);
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
    sql = "SELECT pp FROM users WHERE id = ? LIMIT 1";
    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [req.body.id], (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            if (!rows[0]) {
                return res.json({error: true, message: 'The user with the given id was not found on the server.'});
            } else {
                if (rows[0]['pp'] !== null && rows[0]['pp'] !== undefined) {
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
    
                            if (rows["affectedRows"] === 0) {
                                return res.json({
                                    error: true,
                                    message: "The user with the given id can not be updated.",
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
                return res.json({ error: true, message: 'The user with the given information was not found on the server.'});
            } else {
                const hash = crypto
                        .createHash("md5")
                        .update(req.body.email)
                        .digest("hex");
    
                sendRegisterMail(rows[0]['name'], req.body.email, rows[0]['id'], hash);
                return res.json({
                    error: false,
                    data: "A verification email has been sent."
                });
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

            if (rows["affectedRows"] === 0) {
                return res.json({
                    error: true,
                    message: "The user with the given information can not be updated.",
                });
            } else {
                return res.json({
                    error: false,
                    data: "Your account has been verified. You can now login to the application.",
                });
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

        let verifyUrl = `https://anatomica-ec2cd.ew.r.appspot.com/v1/users/verify/${id}/${hash}`;

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

function createGoogleUser(name, email, pp, google_id, res) {
    const sql =
        "INSERT INTO users (name, email, pp, hash, active, account_google, google_id) VALUES (?,?,?,?,1,1,?)";
    const hash = crypto.createHash("md5").update(email).digest("hex");

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [name, email, pp, google_id, hash], (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            sendWelcomeMail(name, email);

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
    
                return res.json({ error: false, id: rows["insertId"], token: token});
            }else {
                return res.json({error: true, message: 'The use can not be created.'});
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
                    message: "The user with the given id was not found on the server.",
                });
            } else {
                if (!rows[0]["canChangeName"]) {
                    // User can't change his/her name.
                    return res.json({
                        error: true,
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
