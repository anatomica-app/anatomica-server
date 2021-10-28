const express = require('express');
const router = express.Router();

const Joi = require('joi');
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const checkAuth = require('../middleware/check-auth');
const checkPrivilege = require('../middleware/check-privilege');

const pool = require('../database');
const constants = require('./constants');
const errorCodes = require('./errors');
const privileges = require('../privileges');

// Login user with credentials.
router.post("/login", (req, res) => {
    const schema = Joi.object({
        username: Joi.string().min(3).max(64).required(),
        password: Joi.string().max(128).required(),
    });

    const result = schema.validate(req.body);
    if (result.error)
        return res.json({ error: true, message: result.error.details[0].message });

    const hashedPassword = crypto
        .createHash("md5")
        .update(req.body.password)
        .digest("hex");

    const sql = "SELECT * FROM admin_accounts WHERE username = ? AND password = ? LIMIT 1";

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [req.body.username, hashedPassword], (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            if (!rows[0])
                return res.json({
                    error: true,
                    message: "The username or the password was incorrect.",
                });
            else {
                const user = rows[0];

                if (user['active'] === 1) {
                    const token = jwt.sign(
                        {
                            id: rows[0]['id'],
                            username: req.body.username
                        },
                        process.env.JWT_PRIVATE_KEY,
                        {
                            expiresIn: "1h"
                        }
                        );
                        
                    user['token'] = token;
                }

                return res.json({error: false, data: user});
            }
        });
    });
});

// Get all admins.
router.post("/users", checkPrivilege(privileges['anatomica.list.users']), (req, res) => {
    const sql = "SELECT * FROM admin_accounts";

    pool.getConnection(function (err, conn){
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            return res.json({
                error: false,
                data: rows
            })
        });
    })
});

// Get users privileges.
router.post("/users/privilege", checkAuth, (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required()
    });

    const result = schema.validate(req.body);
    if (result.error)
        return res.json({ error: true, message: result.error.details[0].message });

    const sql = "SELECT privileges.description FROM admin_privileges INNER JOIN admin_accounts ON admin_privileges.user = admin_accounts.id INNER JOIN privileges ON admin_privileges.privilege = privileges.id WHERE admin_accounts.id = ?";

    pool.getConnection(function (err, conn){
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [req.body.id], (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            if (!rows[0]) {
                return res.json({
                    error: true,
                    message: 'There is no record'
                });
            }else {
                return res.json({
                    error: false,
                    data: rows
                });
            }
        });
    })
});

// Create an admin account.
router.post("/users/create", checkPrivilege(privileges['anatomica.add.admin']), (req, res) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(64).required(),
        username: Joi.string().max(128).required(),
        password: Joi.string().min(6).required(),
        perms: Joi.array()
    });

    const result = schema.validate(req.body);
    if (result.error)
        return res.json({ error: true, message: result.error.details[0].message });

    const hashedPassword = crypto
        .createHash("md5")
        .update(req.body.password)
        .digest("hex");

    const sql = "INSERT INTO admin_accounts (name, username, password, active) VALUES (?,?,?,1)";
    pool.getConnection(function(err, conn) {
        if (err) return res.json({error: true, message: err.message});

        conn.query(sql, [req.body.name, req.body.username, hashedPassword], (error, rows) => {
            if (error) return res.json({error: true, message: error.message});

            if (rows['insertId'] !== 0) {
                if (req.body.perms) {
                    let array = req.body.perms;
                    for (var i = 0; i < array.length; i++) {
                        const sql2 = "INSERT INTO admin_privileges (user, privilege) VALUES (?,?)";
                        conn.query(sql2, [rows['insertId'], array[i]]);
                    }
                }
                return res.json({error: false, message: 'The admin account has been successfully created.'});
            }else {
                return res.json({
                    error: true,
                    code: errorCodes.ADMIN_CANNOT_BE_CREATED,
                    message: 'The admin account can not be created.'
                })
            }
        });
    });
});

// Get info for dashboard.
router.get("/dashboard", checkAuth, (req, res) => {
    const sql = "SELECT (SELECT COUNT(1) FROM quiz_questions_classic WHERE lang = 1) + (SELECT COUNT(1) FROM quiz_questions_image WHERE lang = 1) AS questions, (SELECT COUNT(1) FROM quiz_category WHERE lang = 1) AS category, (SELECT COUNT(1) FROM quiz_subcategory WHERE lang = 1) AS subcategory, (SELECT COUNT(1) FROM users) AS users";

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message});

            if (!rows[0]){
                return res.json({error: true, message: 'No data found on the server.'});
            }else {
                return res.json({error: false, data: rows[0]});
            }
        });
    });

});

module.exports = router