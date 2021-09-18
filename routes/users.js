const express = require('express');
const router = express.Router();

const mysql = require('mysql');
const Joi = require('joi');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// ***** MySQL Connection *****
const pool = mysql.createPool({
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DATABASE,
    socketPath: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`
});

// Fetch user from id.
router.get('/id/:id', (req, res) => {
    const sql = "SELECT * FROM users WHERE id = ? LIMIT 1";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.params.id], (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({error: true, message: error.message});;

            if (!rows[0]) return res.status(404).json({error: true, message: 'The user with the given id was not found.'});
            else res.json({error: false, data: rows[0]});
        });
    });
});

// Fetch user from email.
router.get('/email/:email', (req, res) => {
    const sql = "SELECT * FROM users WHERE email = ? LIMIT 1";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.params.email], (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({error: true, message: error.message});;

            if (!rows[0]) return res.status(404).json({error: true, message: 'The user with the given email address was not found.'});
            else res.json({error: false, data: rows[0]});
        });
    });
});

// Login user with credentials.
router.post('/login', (req, res) => {
    const schema = Joi.object({
        email: Joi.string().min(3).max(64).required(),
        password: Joi.string().max(128).required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.status(400).send(result.error.details[0].message);

    const sql = "SELECT * FROM users WHERE email = ? AND password = ? LIMIT 1";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.email, req.body.password], (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({error: true, message: error.message});;

            if (!rows[0]) return res.status(404).json({error: true, message: 'The email or the password was incorrect.'});
            else return res.json({error: false, data: rows[0]}); 
        });
    });
});

// Login user with Google.
router.post('/login/google', (req, res) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(64).required(),
        email: Joi.string().min(3).max(64).required(),
        pp: Joi.string().max(1024).allow(null).required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.status(400).send(result.error.details[0].message);

    const sql = "SELECT * FROM users WHERE email = ? LIMIT 1";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.email, req.body.password], (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({error: true, message: error.message});;

            if (!rows[0]){
                // The user with the same email address was not
                // found on the server. Create a new record.
                createGoogleUser(req.body.name, req.body.email, req.body.pp, res);
            }else {
                // We got a record with the same email address.
                // Let's check whether it's google_account or not.
                let user = rows[0];
    
                if (user['account_google']) {
                    // The user is google_account.
                    // Approve the login process.
                    return res.json({error: false, data: user});
                }else {
                    // The email address was registered with
                    // non-google account before. Deny the process.
                    return res.status(403).json({error: true, message: 'The email address was registered with non-google account. Please use your password in order to login.'});
                }
            }
        });
    });
});

// Create a user with default configuration.
router.post('/', (req, res) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(64).required(),
        email: Joi.string().min(3).max(64).required(),
        password: Joi.string().max(128).required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.status(400).send(result.error.details[0].message);

    const sql = "SELECT * FROM users WHERE email = ? LIMIT 1";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.email], (error, rows) => {
            if (error){
                conn.release();
                return res.status(500).json({error: true, message: error.message});
            }

            if (!rows[0]) {
                // There was no record with the same email address.
                // Create the user.
                const sql2 = "INSERT INTO users (name, email, password, hash) VALUES (?,?,?,?)";
                const hash = crypto.createHash('md5').update(req.body.email).digest("hex");
            
                conn.query(sql2, [req.body.name, req.body.email, req.body.password, hash], (error2, rows2) => {
                    conn.release();
                    if (error2) return res.status(500).json({error: true, message: error2.message});

                    if (rows2['insertId'] === 0) {
                        return res.json({error: true, message: 'The user can not be created.'});
                    }else {
                        sendRegisterMail(req.body.name, req.body.email, rows2['insertId'], hash);
                        return res.json({error: false, data: rows2['insertId']});
                    }
                });
            }else {
                // The user was already exists with this email address.
                return res.json({error: true, message: 'The user already exists with this email address.'});
            }
        });
    });
});

// Create user with Google account.
router.post('/google', (req, res) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(64).required(),
        email: Joi.string().min(3).max(64).required(),
        pp: Joi.string().max(1024).allow(null).required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.status(400).send(result.error.details[0].message);

    createGoogleUser(req.body.name, req.body.email, req.body.pp, res);
});

// Change user name.
router.put('/changeUserName/', async (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required(),
        name: Joi.string().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.status(400).send(result.error.details[0].message);

    await canChangeUserName(req.body.id, req.body.name, res);
});

// Verify mail address.
router.get('/verify/:id/:hash', (req, res) => {
    const sql = "UPDATE users SET active = 1 WHERE id = ? AND hash = ?";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.params.id, req.params.hash], (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({error: true, message: error.message});

            if (rows['affectedRows'] === 0) {
                return res.json({error: true, message: 'The user with the given information can not be updated.'});
            }else {
                return res.json({error: false, data: 'Your account has been verified. You can now login to the application.'});
            }
        });
    });
});

// ***** Helper Functions *****
async function sendRegisterMail(name, email, id, hash) {

    let mailPath = path.join(__dirname, '../mail_templates/register.html');

    // Prepare the HTML with replacing the placeholder strings.
    fs.readFile(mailPath, 'utf8', async function(err, data) {
        if (err) return err.message;

        let verifyUrl = `localhost:8080/v1/users/verify/${id}/${hash}`;

        let result = data.replace(/{NAME}/g, name);
        result = result.replace(/{EMAIL}/g, email);
        result = result.replace(/{VERIFY_URL}/g, verifyUrl);

        // Send the mail.
        let transporter = nodemailer.createTransport({
            host: 'mail.anatomica-app.com',
            port: 465,
            secure: true,
            auth: {
                user: 'support@anatomica-app.com',
                pass: 'Bilgisayar-5'
            }
        });
    
        await transporter.sendMail({
            from: 'Anatomica <support@anatomica-app.com>',
            to: email,
            subject: 'Anatomica | Üyelik Aktivasyonu',
            html: result
        });
    });
}

async function sendWelcomeMail(name, email) {

    let mailPath = path.join(__dirname, '../mail_templates/register_google.html');

    // Prepare the HTML with replacing the placeholder strings.
    fs.readFile(mailPath, 'utf8', async function(err, data) {
        if (err) return err.message;

        let result = data.replace(/{NAME}/g, name);
        result = result.replace(/{EMAIL}/g, email);

        // Send the mail.
        let transporter = nodemailer.createTransport({
            host: 'mail.anatomica-app.com',
            port: 465,
            secure: true,
            auth: {
                user: 'support@anatomica-app.com',
                pass: 'Bilgisayar-5'
            }
        });
    
        await transporter.sendMail({
            from: 'Anatomica <support@anatomica-app.com>',
            to: email,
            subject: 'Anatomica | Hoşgeldiniz',
            html: result
        });
    });
}

function createGoogleUser(name, email, pp, res) {
    const sql = "INSERT INTO users (name, email, pp, hash, active, account_google) VALUES (?,?,?,?, 1, 1)";
    const hash = crypto.createHash('md5').update(email).digest("hex");

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [name, email, pp, hash], (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({error: true, message: error.message});;

            sendWelcomeMail(name, email);

            return res.json({error: false, id: rows['insertId']});
        });
    });
}

async function canChangeUserName(id, name, res) {
    const sql = "SELECT IF(TIMESTAMPDIFF(DAY,name_last_changed,CURRENT_TIMESTAMP()) >= 30 OR users.name_last_changed IS NULL, true, false) AS canChangeName FROM users WHERE id = ?";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [id], (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({error: true, message: error.message});

            if (!rows[0]){
                // The user with the given id was not found.
                return res.json({error: true, message: 'The user with the given id was not found on the server.'});
            }else {
                if (!rows[0]['canChangeName']){
                    // User can't change his/her name.
                    return res.json({error: true, message: 'User name can not be changed more than once in a month.'});
                }else {
                    changeUserName(id, name, res)
                }
            }
        });
    });
}

async function changeUserName(id, name, res) {
    const sql = "UPDATE users SET name = ? WHERE id = ?";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [name, id], (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({error: true, message: error.message});;

            return res.json({error: false, name: name});
        });
    });
}

module.exports = router