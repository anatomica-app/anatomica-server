const express = require('express');
const router = express.Router();

const Joi = require('joi');

const checkAuth = require('../middleware/check-auth');
const checkPrivilege = require('../middleware/check-privilege');

const pool = require('../database');
const constants = require('./constants');
const errorCodes = require('./errors');
const privileges = require('../privileges');

// Fetching all the subcategories.
router.get('/', checkAuth, (req, res) => {
    const sql = "SELECT * FROM quiz_subcategory";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});;

            res.json({error: false, data: rows});
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
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    const sql = "SELECT quiz_subcategory.* FROM quiz_category_subcategories INNER JOIN quiz_category ON quiz_category_subcategories.category = quiz_category.id INNER JOIN quiz_subcategory ON quiz_category_subcategories.subcategory = quiz_subcategory.id WHERE quiz_category.id = ? AND quiz_subcategory.lang = ? AND quiz_category.lang = ?";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.id, lang, lang],(error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});

            return res.json({error: false, data: rows});
        });
    });
});

// Fetching all the subcategories with category and the relevant topics to it.
router.post('/withCategory/withTopics', checkAuth, (req, res) => {
    const schema = Joi.object({
        category: Joi.number().integer().required(),
        type: Joi.number().integer().valid(1,2).required(), // 1 -> pictured, 2 -> classic
        lang: Joi.number().integer().default(1) // Default language is Turkish --> 1
    });

    // Change the language if there is a lang variable in request body.
    let lang = 1 // Default language is Turkish --> 1
    if (req.body.lang) lang = req.body.lang;

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    let sql = "";

    switch (req.body.type) {
        case 1:
            // Pictured questions.
            sql = "SELECT quiz_subcategory.* FROM quiz_category_subcategories INNER JOIN quiz_category ON quiz_category_subcategories.category = quiz_category.id INNER JOIN quiz_subcategory ON quiz_category_subcategories.subcategory = quiz_subcategory.id WHERE quiz_category.id = ? AND quiz_subcategory.image = 1 AND quiz_subcategory.image_count > 0 AND quiz_subcategory.lang = ? AND quiz_category.lang = ?";
            break;
        case 2:
            // Classic questions.
            sql = "SELECT quiz_subcategory.* FROM quiz_category_subcategories INNER JOIN quiz_category ON quiz_category_subcategories.category = quiz_category.id INNER JOIN quiz_subcategory ON quiz_category_subcategories.subcategory = quiz_subcategory.id WHERE quiz_category.id = ? AND quiz_subcategory.classic = 1 AND quiz_subcategory.classic_count > 0 AND quiz_subcategory.lang = ? AND quiz_category.lang = ?";
            break;
    }

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.category, lang, lang], (error, rows) => {
            if (error) return res.json({error: true, message: error.message});

            if(rows[0]) {
                // We should loop through the subcategories.

                let subcategoryArray = [];

                for (let i = 0; i < rows.length; i++) {
                    subcategoryArray[i] = {
                        id: rows[i].id,
                        lang: rows[i].lang,
                        name: rows[i].name,
                        topics: [],
                        image: rows[i].image,
                        classic: rows[i].classic,
                        date_added: rows[i].date_added,
                    };
                }

                let sql2 = "";

                switch (req.body.type) {
                    case 1:
                        // Pictured questions.
                        sql2 = "SELECT * FROM quiz_topic WHERE lang = ? AND quiz_topic.image = 1";
                        break;
                    case 2:
                        // Classic questions.
                        sql2 = "SELECT * FROM quiz_topic WHERE lang = ? AND quiz_topic.classic = 1";
                        break;
                }

                conn.query(sql2, [lang], (error2, rows2) => {
                    conn.release();
                    if (error2) return res.json({error: true, message: error2.message});

                    if (rows2[0]) {
                        // We should loop through the topics.
                        let subcategoryId = rows2[0].subcategory;

                        for (let i = 0; i < rows2.length; i++) {
                            for (let j = 0; j < subcategoryArray.length; j++) {
                                if (subcategoryArray[j].id == rows2[i].subcategory) {
                                    subcategoryArray[j].topics.push({
                                        id: rows2[i].id,
                                        lang: rows2[i].lang,
                                        subcategory: rows2[i].subcategory,
                                        name: rows2[i].name,
                                        date_added: rows2[i].date_added,
                                    })
                                }
                            }
                        }

                        return res.json({error: false, data: subcategoryArray});

                    }else {
                        return res.json({
                            error: true,
                            message: 'There is not any topics.'
                        });
                    }
                });

                // return res.json({error: false, data: subcategoryArray});
            }else {
                return res.json({
                    error: true,
                    message: 'There isn\'t any subcategory.'
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
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    const sql = "SELECT * FROM quiz_subcategory WHERE lang = ?";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [lang], (error, rows) => {
            if (error) return res.json({error: true, message: error.message});

            if(rows[0]) {
                // We should loop through the subcategories.

                let subcategoryArray = [];

                for (let i = 0; i < rows.length; i++) {
                    subcategoryArray[i] = {
                        id: rows[i].id,
                        lang: rows[i].lang,
                        name: rows[i].name,
                        topics: [],
                        image: rows[i].image,
                        classic: rows[i].classic,
                        date_added: rows[i].date_added,
                    };
                }

                const sql2 = "SELECT * FROM quiz_topic WHERE lang = ?";

                conn.query(sql2, [lang], (error2, rows2) => {
                    conn.release();
                    if (error2) return res.json({error: true, message: error2.message});

                    if (rows2[0]) {
                        // We should loop through the topics.
                        let subcategoryId = rows2[0].subcategory;

                        for (let i = 0; i < rows2.length; i++) {
                            for (let j = 0; j < subcategoryArray.length; j++) {
                                if (subcategoryArray[j].id == rows2[i].subcategory) {
                                    subcategoryArray[j].topics.push({
                                        id: rows2[i].id,
                                        lang: rows2[i].lang,
                                        subcategory: rows2[i].subcategory,
                                        name: rows2[i].name,
                                        date_added: rows2[i].date_added,
                                    })
                                }
                            }
                        }

                        return res.json({error: false, data: subcategoryArray});

                    }else {
                        return res.json({
                            error: true,
                            message: 'There is not any topics.'
                        });
                    }
                });

                // return res.json({error: false, data: subcategoryArray});
            }else {
                return res.json({
                    error: true,
                    message: 'There is not any subcategory.'
                });
            }
        });
    });
});

// Create a new subcategory.
router.post('/', checkAuth, checkPrivilege(privileges['anatomica.add.subcategory']), (req, res) => {
    const schema = Joi.object({
        name: Joi.string().required(),
        category: Joi.number().integer().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    const sql = "INSERT INTO quiz_subcategory (name, category) VALUES (?,?)";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.name, req.body.category], (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});

            if (rows['insertId'] === 0) {
                return res.json({
                    error: true,
                    code: errorCodes.SUBCATEGORY_CAN_NOT_BE_CREATED,
                    message: 'The subcategory can not be created.'
                });
            }else {
                return res.json({error: false, data: rows['insertId']});
            }
        });
    });
});

// Update a subcategory.
router.put('/', checkAuth, checkPrivilege(privileges['anatomica.update.subcategory']), (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required(),
        name: Joi.string().required(),
        category: Joi.number().integer().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    const sql = "UPDATE quiz_subcategory SET name = ?, category = ? WHERE id = ?";
    const data = [
        req.body.name,
        req.body.category,
        req.body.id
    ]

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, data, (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});

            if (rows['affectedRows'] === 0) {
                return res.json({
                    error: true,
                    code: errorCodes.SUBCATEGORY_CAN_NOT_BE_UPDATED,
                    message: 'The subcategory can not be updated.'
                });
            }else {
                return res.json({error: false, data: data});
            }
        });
    });
});

// Delete a category.
router.delete('/', checkAuth, checkPrivilege(privileges['anatomica.delete.subcategory']), async (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    const sql = "DELETE FROM quiz_subcategory WHERE id = ?";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.id], (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});

            if (rows['affectedRows'] === 0) return res.json({
                error: true,
                code: errorCodes.SUBCATEGORY_NOT_FOUND,
                message: 'The subcategory with the given id was not fount on the server.'
            });
            else return res.json({error: false, id: req.body.id});
        });
    });
});

module.exports = router