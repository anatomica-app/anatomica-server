const express = require('express');
const router = express.Router();

const Joi = require('joi');

const checkAuth = require('../middleware/check-auth');

const pool = require('../database');

router.post('/', checkAuth, async (req, res) => {
    const schema = Joi.object({
        lang: Joi.number().integer()
    });

    // Change the language if there is a lang variable in request body.
    let lang = 1 // Default language is Turkish --> 1
    if (req.body.lang) lang = req.body.lang;

    const result = schema.validate(req.body);
    if (result.error) return res.status(400).json({ message: result.error.details[0].message });

    const sql = `SELECT id, title as name, description, sku FROM products WHERE lang = ${lang}`;

    pool.getConnection(function (err, conn) {
        if (err) return res.status(500).json({ message: err.message });
        conn.query(sql, (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({ message: error.message });

            return res.send(rows);
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
    if (result.error) return res.status(400).json({ message: result.error.details[0].message });

    const sql = `SELECT id, title as name, description, sku FROM products WHERE sku = '${req.body.sku}' AND lang = ${lang}`;

    pool.getConnection(function (err, conn) {
        if (err) return res.status(500).json({ message: err.message });
        conn.query(sql, (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({ message: error.message });

            return res.send(rows[0]);
        });
    });
});

router.post('/preview', checkAuth, async (req, res) => {
    const schema = Joi.object({
        sku: Joi.string().required(),
    });

    const result = schema.validate(req.body);
    if (result.error) return res.status(400).json({ message: result.error.details[0].message });

    const sql = `SELECT * FROM product_images WHERE sku = '${req.body.sku}' AND active = 1`;

    pool.getConnection(function (err, conn) {
        if (err) return res.status(500).json({ message: err.message });
        conn.query(sql, (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({ message: error.message });

            return res.send(rows[0]);
        });
    });
});

module.exports = router;