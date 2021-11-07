const express = require('express');
const router = express.Router();

const Joi = require('joi');

const checkAuth = require('../middleware/check-auth');
const checkPrivilege = require('../middleware/check-privilege');

const pool = require('../database');
const constants = require('./constants');
const errorCodes = require('./errors');
const privileges = require('../privileges');

// Fetching all the Classic Questions
router.post('/', checkAuth, (req, res) => {
    const schema = Joi.object({
        full: Joi.boolean().required(),
        lang: Joi.number().integer().default(1) // Default language is Turkish --> 1
    });

    // Change the language if there is a lang variable in request body.
    let lang = 1 // Default language is Turkish --> 1
    if (req.body.lang) lang = req.body.lang;

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    let sql = "";

    if (req.body.full) {
        // We need to inner join the foreign keys.
        sql = "SELECT quiz_questions_classic.id, question, quiz_category.name AS category, quiz_subcategory.name AS subcategory, answer, a, b, c, d, quiz_questions_classic.date_added FROM quiz_questions_classic INNER JOIN quiz_category ON quiz_questions_classic.category = quiz_category.id AND quiz_category.lang = ? INNER JOIN quiz_subcategory ON quiz_questions_classic.subcategory = quiz_subcategory.id AND quiz_subcategory.lang = ? WHERE quiz_questions_classic.lang = ?";

        pool.getConnection(function(err, conn){
            if (err) return res.json({error: true, message: err.message});
            conn.query(sql, [lang, lang, lang], (error, rows) => {
                conn.release();
                if (error) return res.json({error: true, message: error.message});;
    
                res.json({error: false, data: rows});
            });
        });
    }else {
        sql = "SELECT * FROM quiz_questions_classic WHERE lang = ?";

        pool.getConnection(function(err, conn){
            if (err) return res.json({error: true, message: err.message});
            conn.query(sql, [lang], (error, rows) => {
                conn.release();
                if (error) return res.json({error: true, message: error.message});;
    
                res.json({error: false, data: rows});
            });
        });
    }
});

// Fetching the Classic Question From Id.
router.post('/withId', checkAuth, async (req, res) => {
    const sql = "SELECT * FROM quiz_questions_classic WHERE id = ? AND lang = ?";

    const schema = Joi.object({
        id: Joi.number().integer().required(),
        lang: Joi.number().integer().default(1) // Default language is Turkish --> 1
    });

    // Change the language if there is a lang variable in request body.
    let lang = 1 // Default language is Turkish --> 1
    if (req.body.lang) lang = req.body.lang;

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.id, lang], (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});

            if(!rows[0])
                return res.json({
                    error: true, 
                    code: errorCodes.QUESTION_NOT_FOUND,
                    message: 'The question was not found on the server.'
                });
            else
                res.json({error: false, data: rows[0]});
        });
    });
});

// Fetching the Classic Question From Category and Subcategories.
router.post('/withCategory', checkAuth, async (req, res) => {
    const schema = Joi.object({
        category: Joi.number().integer().required(),
        subcategories: Joi.array().required(),
        topics: Joi.array(),
        maxQuestionCount: Joi.number().integer().min(1).required(),
        lang: Joi.number().integer().default(1) // Default language is Turkish --> 1
    });

    // Change the language if there is a lang variable in request body.
    let lang = 1 // Default language is Turkish --> 1
    if (req.body.lang) lang = req.body.lang;

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    // Use subcategories array for concetanating the SQL command.
    // For example: 1,2 will be:
    // subcategory = 1 OR subcategory = 2

    let subcategories = req.body.subcategories;
    let subcategoryQuery = "";
    
    for (let i = 0; i < subcategories.length; i++) {
        subcategoryQuery += ("subcategory = " + subcategories[i]);

        if (subcategories.length !== 1 && i !== (subcategories.length - 1)) {
            subcategoryQuery += " OR ";
        }
    }

    if (req.body.topics) {
        let topics = req.body.topics;
        subcategoryQuery += " OR ";
        for (let j = 0; j < topics.length; j++) {
            subcategoryQuery += ("topic = " + topics[j]);
    
            if (subcategories.length !== 1 && j !== (subcategories.length - 1)) {
                subcategoryQuery += " OR ";
            }
        }
    }

    const sql = `SELECT * FROM quiz_questions_classic WHERE lang = ? AND category = ? AND (${subcategoryQuery}) ORDER BY RAND() LIMIT ?`;

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [lang, req.body.category, req.body.maxQuestionCount], (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});

            return res.json({error: false, data: rows});
        });
    });
});

// Insert a new Classic Question record.
router.post('/create', checkAuth, checkPrivilege(privileges['anatomica.add.question']), async (req, res) => {
    const schema = Joi.object({
        lang: Joi.number().integer(),
        question: Joi.string().required(),
        category: Joi.number().integer().required(),
        subcategory: Joi.number().integer().required(),
        answer: Joi.string().valid('A', 'B', 'C', 'D').required(),
        a: Joi.string().required(),
        b: Joi.string().required(),
        c: Joi.string().required(),
        d: Joi.string().required()
    });

    // Change the language if there is a lang variable in request body.
    let lang = 1 // Default language is Turkish --> 1
    if (req.body.lang) lang = req.body.lang;

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    const sql = "INSERT INTO quiz_questions_classic (lang, question, category, subcategory, answer, a, b, c, d) VALUES (?,?,?,?,?,?,?,?,?)";
    const data = [
        lang,
        req.body.question,
        req.body.category,
        req.body.subcategory,
        req.body.answer,
        req.body.a,
        req.body.b,
        req.body.c,
        req.body.d
    ];

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, data, (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});

            if (rows['insertId'] === 0){
                return res.json({
                    error: true,
                    code: errorCodes.QUESTION_CAN_NOT_BE_CREATED,
                    message: 'The data can not be inserted.'
                });
            }else {
                return res.json({error: false, data: rows['insertId']});
            }
        });
    });
});

// Update Classic Question record with given id.
router.put('/', checkAuth, checkPrivilege(privileges['anatomica.update.question']), async (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required(),
        lang: Joi.number().integer(),
        question: Joi.string().required(),
        category: Joi.number().integer().required(),
        subcategory: Joi.number().integer().required(),
        answer: Joi.string().valid('A', 'B', 'C', 'D').required(),
        a: Joi.string().required(),
        b: Joi.string().required(),
        c: Joi.string().required(),
        d: Joi.string().required()
    });

    // Change the language if there is a lang variable in request body.
    let lang = 1 // Default language is Turkish --> 1
    if (req.body.lang) lang = req.body.lang;

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    const sql = "SELECT * FROM quiz_questions_classic WHERE id = ? AND lang = ?";
    pool.getConnection(function(err, conn) {
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.id, lang], (error, rows) => {
            if (error) return res.json({error: true, message: error.message});

            let sql2 = "";
            let data = [];

            if (!rows[0]) {
                // The question with the given lang and id not found.
                // We shall create a new question with this language configuration.
                sql2 = "INSERT INTO quiz_questions_classic (id, lang, question, category, subcategory, answer, a, b, c, d) VALUES (?,?,?,?,?,?,?,?,?,?)";
                data = [
                    req.body.id,
                    lang,
                    req.body.question,
                    req.body.category,
                    req.body.subcategory,
                    req.body.answer,
                    req.body.a,
                    req.body.b,
                    req.body.c,
                    req.body.d
                ];

                console.log('Inserting classic question...');
                console.log('Request id: ' + req.body.id + ', lang: ' + lang + ', question: ' + req.body.question);

                conn.query(sql2, data, (error2, rows2) => {
                    conn.release();
                    if (error2) return res.json({error: true, message: error2.message});;
        
                    if (rows2['affectedRows'] === 0){
                        return res.json({
                            error: true,
                            code: errorCodes.QUESTION_CANNOT_BE_INSERTED_OR_UPDATED,
                            message: 'The question neither could be inserted nor could be updated.'
                        });
                    }else {
                        return res.json({error: false, data: data});
                    }
                });
            }else {
                // A question with the given id and language found. Update it.
                sql2 = "UPDATE quiz_questions_classic SET question = ?, category = ?, subcategory = ?, answer = ?, a = ?, b = ?, c = ?, d= ? WHERE id = ? AND lang = ?";
                data = [
                    req.body.question,
                    req.body.category,
                    req.body.subcategory,
                    req.body.answer,
                    req.body.a,
                    req.body.b,
                    req.body.c,
                    req.body.d,
                    req.body.id,
                    lang
                ];

                console.log('Updating classic question...');
                console.log('Request id: ' + req.body.id + ', lang: ' + lang + ', question: ' + req.body.question);

                conn.query(sql2, data, (error2, rows2) => {
                    conn.release();
                    if (error2) return res.json({error: true, message: error2.message});;
        
                    if (rows2['affectedRows'] === 0){
                        return res.json({
                            error: true,
                            code: errorCodes.QUESTION_CANNOT_BE_INSERTED_OR_UPDATED,
                            message: 'The question neither could be inserted nor could be updated.'
                        });
                    }else {
                        return res.json({error: false, data: data});
                    }
                });
            }
        });
    })
});

// Delete Classic Question record with given id.
router.delete('/', checkAuth, checkPrivilege(privileges['anatomica.delete.question']), async (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    const sql = "DELETE FROM quiz_questions_classic WHERE id = ?";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.id], (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});;

            if (rows['affectedRows'] === 0){
                return res.json({
                    error: true,
                    code: errorCodes.QUESTION_NOT_FOUND,
                    message: 'The question with the given id was not found.'
                });
            }else {
                return res.json({error: false, id: req.body.id});
            }
        });
    });
});

module.exports = router