const express = require('express');
const router = express.Router();

const Joi = require('joi');

const checkAuth = require('../middleware/check-auth');

const pool = require('../database');
const responseMessages = require('./responseMessages');

// Fetching all the subcategories.
router.get('/', checkAuth, (req, res) => {
    const sql = "CALL fetch_all_subcategories();";

    pool.getConnection(function (err, conn) {
        if (err) return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
        conn.query(sql, (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({ message: responseMessages.DATABASE_ERROR });;

            return res.send(rows[0]);
        });
    });
});

// Fetching all the subcategories with language.
router.post('/', checkAuth, (req, res) => {
    const schema = Joi.object({
        lang: Joi.number().integer().default(1) // Default language is Turkish --> 1
    });

    // Change the language if there is a lang variable in request body.
    let lang = 1 // Default language is Turkish --> 1
    if (req.body.lang) lang = req.body.lang;

    const result = schema.validate(req.body);
    if (result.error) return res.status(400).json({ message: result.error.details[0].message });

    const sql = "CALL fetch_subcategories_with_lang(?);";
    pool.getConnection(function (err, conn) {
        if (err) return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
        conn.query(sql, [lang], (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({ message: responseMessages.DATABASE_ERROR });;

            return res.send(rows[0]);
        });
    });
});

// Fetching all the subcategories with the given category.
router.post('/withCategory', checkAuth, (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required(),
        lang: Joi.number().integer().default(1) // Default language is Turkish --> 1
    });

    // Change the language if there is a lang variable in request body.
    let lang = 1 // Default language is Turkish --> 1
    if (req.body.lang) lang = req.body.lang;

    const result = schema.validate(req.body);
    if (result.error) return res.status(400).json({ message: result.error.details[0].message });

    const sql = "CALL fetch_subcategories_by_category(?, ?);";

    pool.getConnection(function (err, conn) {
        if (err) return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
        conn.query(sql, [lang, req.body.id], (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({ message: responseMessages.DATABASE_ERROR });

            return res.send(rows[0]);
        });
    });
});

// Fetching all the subcategories with category and the relevant topics to it.
router.post('/withCategory/withTopics', checkAuth, (req, res) => {
    const schema = Joi.object({
        user: Joi.number().integer(), // User ID
        sku: Joi.string(), // SKU of the category
        category: Joi.number().integer().required(),
        type: Joi.number().integer().valid(1, 2).required(), // 1 -> pictured, 2 -> classic
        lang: Joi.number().integer().default(1) // Default language is Turkish --> 1
    });

    // Change the language if there is a lang variable in request body.
    let lang = 1 // Default language is Turkish --> 1
    if (req.body.lang) lang = req.body.lang;

    const result = schema.validate(req.body);
    if (result.error) return res.status(400).json({ message: result.error.details[0].message });

    let sql = "";

    switch (req.body.type) {
        case 1:
            // Pictured questions.
            sql = "CALL fetch_subcategories_by_category_for_pictured(?, ?);";
            break;
        case 2:
            // Classic questions.
            sql = "CALL fetch_subcategories_by_category_for_classic(?, ?);";
            break;
    }

    pool.getConnection(function (err, conn) {
        if (err) return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
        conn.query(sql, [lang, req.body.category], (error, rows) => {
            if (error) return res.status(500).json({ message: responseMessages.DATABASE_ERROR});

            if (rows[0][0]) {
                // We should loop through the subcategories.
                let subcategoryArray = [];
                let subcategoryResults = rows[0];

                for (let i = 0; i < subcategoryResults.length; i++) {
                    subcategoryArray[i] = {
                        id: subcategoryResults[i].id,
                        name: subcategoryResults[i].name,
                        topics: [],
                        isPictured: subcategoryResults[i].isPictured,
                        isClassic: subcategoryResults[i].isClassic,
                        dateAdded: subcategoryResults[i].dateAdded,
                    };
                }

                let sql2 = "CALL fetch_topics_by_category(?, ?);";

                conn.query(sql2, [lang, req.body.category], (error2, rows2) => {
                    conn.release();
                    if (error2) return res.json({ message: responseMessages.DATABASE_ERROR });

                    if (rows2[0][0]) {
                        // We should loop through the topics.
                        let topicResults = rows2[0];
                        for (let i = 0; i < topicResults.length; i++) {
                            for (let j = 0; j < subcategoryArray.length; j++) {
                                if (subcategoryArray[j].id == topicResults[i].subcategory) {
                                    subcategoryArray[j].topics.push({
                                        id: topicResults[i].id,
                                        subcategory: topicResults[i].subcategory,
                                        name: topicResults[i].name,
                                        isClassic: topicResults[i].isClassic,
                                        isPictured: topicResults[i].isPictured,
                                        dateAdded: topicResults[i].dateAdded,
                                    })
                                }
                            }
                        }
                    }
                    return res.send(subcategoryArray);
                });
            } else {
                return res.status(404).json({
                    message: responseMessages.NO_SUBCATEGORIES
                });
            }
        });
    });
});

// Fetching all the subcategories and the relevant topics to it.
router.post('/withTopics', checkAuth, (req, res) => {
    const schema = Joi.object({
        lang: Joi.number().integer().default(1) // Default language is Turkish --> 1
    });

    // Change the language if there is a lang variable in request body.
    let lang = 1 // Default language is Turkish --> 1
    if (req.body.lang) lang = req.body.lang;

    const result = schema.validate(req.body);
    if (result.error) return res.status(400).json({ message: result.error.details[0].message });

    const sql = "CALL fetch_subcategories_with_lang(?);";

    pool.getConnection(function (err, conn) {
        if (err) return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
        conn.query(sql, [lang], (error, rows) => {
            if (error) return res.status(500).json({ message: responseMessages.DATABASE_ERROR });

            if (rows[0][0]) {
                // We should loop through the subcategories.
                let subcategoryArray = [];
                let subcategoryResults = rows[0];

                for (let i = 0; i < subcategoryResults.length; i++) {
                    subcategoryArray[i] = {
                        id: subcategoryResults[i].id,
                        name: subcategoryResults[i].name,
                        topics: [],
                        dateAdded: subcategoryResults[i].dateAdded,
                    };
                }

                const sql2 = "CALL fetch_all_topics(?);";

                conn.query(sql2, [lang], (error2, rows2) => {
                    conn.release();
                    if (error2) return res.status(500).json({ message: responseMessages.DATABASE_ERROR });

                    if (rows2[0][0]) {
                        // We should loop through the topics.
                        let topicResults = rows2[0];
                        for (let i = 0; i < topicResults.length; i++) {
                            for (let j = 0; j < subcategoryArray.length; j++) {
                                if (subcategoryArray[j].id == topicResults[i].subcategory) {
                                    subcategoryArray[j].topics.push({
                                        id: topicResults[i].id,
                                        subcategory: topicResults[i].subcategory,
                                        name: topicResults[i].name,
                                        isClassic: topicResults[i].isClassic,
                                        isPictured: topicResults[i].isPictured,
                                        dateAdded: topicResults[i].dateAddeds,
                                    })
                                }
                            }
                        }

                        return res.send(subcategoryArray);

                    } else {
                        return res.status(404).json({
                            message: responseMessages.NO_TOPICS_IN_SUBCATEGORY
                        });
                    }
                });
            } else {
                return res.status(404).json({
                    message: responseMessages.NO_SUBCATEGORIES
                });
            }
        });
    });
});

module.exports = router