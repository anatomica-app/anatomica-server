const express = require('express');
const router = express.Router();

const Joi = require('joi');

const checkAuth = require('../middleware/check-auth');

const pool = require('../database');

// Fetching all the topics.
router.get('/', checkAuth, (req, res) => {
    const sql = "SELECT id, subcategory, name, classic as isClassic, image as isPictured, date_added as dateAdded FROM quiz_topic";

    pool.getConnection(function (err, conn) {
        if (err) return res.status(500).json({ message: err.message });
        conn.query(sql, (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({ message: error.message });;

            res.send(rows);
        });
    });
});

// Fetching all the topics with the given subcategory.
router.post('/withSubcategory', checkAuth, (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required(),
        lang: Joi.number().integer().default(1) // Default language is Turkish --> 1
    });

    // Change the language if there is a lang variable in request body.
    let lang = 1 // Default language is Turkish --> 1
    if (req.body.lang) lang = req.body.lang;

    const result = schema.validate(req.body);
    if (result.error) return res.status(400).json({ message: result.error.details[0].message });

    const sql = "SELECT id, subcategory, name, classic as isClassic, image as isPictured, date_added as dateAdded FROM quiz_topic WHERE subcategory = ? AND lang = ?";

    pool.getConnection(function (err, conn) {
        if (err) return res.status(500).json({ message: err.message });
        conn.query(sql, [req.body.id, lang], (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({ message: error.message });

            return res.send(rows);
        });
    });
});

module.exports = router