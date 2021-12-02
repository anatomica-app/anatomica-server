const express = require('express');
const router = express.Router();

const Joi = require('joi');

const checkAuth = require('../middleware/check-auth');
const checkPrivilege = require('../middleware/check-privilege');

const pool = require('../database');
const constants = require('./constants');
const errorCodes = require('./errors');

router.post('/', checkAuth, async (req, res) => {
    const schema = Joi.object({
        lang: Joi.number().integer()
    });

    // Change the language if there is a lang variable in request body.
    let lang = 1 // Default language is Turkish --> 1
    if (req.body.lang) lang = req.body.lang;

    const result = schema.validate(req.body);
    if (result.error) return res.json({ error: true, message: result.error.details[0].message });

    const sql = "SELECT * FROM products WHERE lang = ?";

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [lang], (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            return res.json({ error: false, data: rows });
        });
    });
});

router.post('/withSku', checkAuth, async (req, res) => {
    const schema = Joi.object({
        sku: Joi.string().required(),
        lang: Joi.number().integer()
    });

    // Change the language if there is a lang variable in request body.
    let lang = 1 // Default language is Turkish --> 1
    if (req.body.lang) lang = req.body.lang;

    const result = schema.validate(req.body);
    if (result.error) return res.json({ error: true, message: result.error.details[0].message });

    const sql = "SELECT * FROM products WHERE sku = ? AND lang = ?";

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [req.body.sku, lang], (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            return res.json({ error: false, data: rows[0] });
        });
    });
});

module.exports = router;