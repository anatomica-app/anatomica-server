const express = require('express');
const router = express.Router();

const Joi = require('joi');
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const checkAuth = require('../middleware/check-auth');

const pool = require('../database');
const constants = require('./constants');
const errorCodes = require('./errors');

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

// Get info for dashboard.
router.get("/dashboard", checkAuth, (req, res) => {
    const sql = "SELECT (SELECT COUNT(1) FROM quiz_questions_classic) + (SELECT COUNT(1) FROM quiz_questions_image) AS questions, (SELECT COUNT(1) FROM quiz_category) AS category, (SELECT COUNT(1) FROM quiz_subcategory) AS subcategory, (SELECT COUNT(1) FROM users) AS users";

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