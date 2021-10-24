const express = require('express');
const router = express.Router();

const Joi = require('joi');

const checkAuth = require('../middleware/check-auth');

const pool = require('../database');
const constants = require('./constants');
const errorCodes = require('./errors');

// Fetching all the Classic Questions
router.post('/', checkAuth, (req, res) => {
    const schema = Joi.object({
        full: Joi.boolean().required()
    })

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    let sql = "";

    if (req.body.full) {
        // We need to inner join the foreign keys.
        sql = "SELECT quiz_questions_classic.id, question, quiz_category.name AS category, quiz_subcategory.name AS subcategory, answer, a, b, c, d, quiz_questions_classic.date_added FROM quiz_questions_classic INNER JOIN quiz_category on quiz_questions_classic.category = quiz_category.id INNER JOIN quiz_subcategory ON quiz_questions_classic.subcategory = quiz_subcategory.id";
    }else {
        sql = "SELECT * FROM quiz_questions_classic";
    }

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});;

            res.json({error: false, data: rows});
        });
    });
});

// Fetching the Classic Question From Id.
router.post('/withId', checkAuth, async (req, res) => {
    const sql = "SELECT * FROM quiz_questions_classic WHERE id = ?";

    const schema = Joi.object({
        id: Joi.number().integer().required()
    })

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.id], (error, rows) => {
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
        maxQuestionCount: Joi.number().integer().min(1).required(),
    })

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

    const sql = `SELECT * FROM quiz_questions_classic WHERE category = ? AND ${subcategoryQuery} ORDER BY RAND() LIMIT ?`;

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.category, req.body.maxQuestionCount], (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});

            return res.json({error: false, data: rows});
        });
    });
});

// Insert a new Classic Question record.
router.post('/create', checkAuth, async (req, res) => {
    const schema = Joi.object({
        question: Joi.string().required(),
        category: Joi.number().integer().required(),
        subcategory: Joi.number().integer().required(),
        answer: Joi.string().valid('A', 'B', 'C', 'D').required(),
        a: Joi.string().required(),
        b: Joi.string().required(),
        c: Joi.string().required(),
        d: Joi.string().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    const sql = "INSERT INTO quiz_questions_classic (question, category, subcategory, answer, a, b, c, d) VALUES (?,?,?,?,?,?,?,?)";
    const data = [
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
router.put('/', checkAuth, async (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required(),
        question: Joi.string().required(),
        category: Joi.number().integer().required(),
        subcategory: Joi.number().integer().required(),
        answer: Joi.string().valid('A', 'B', 'C', 'D').required(),
        a: Joi.string().required(),
        b: Joi.string().required(),
        c: Joi.string().required(),
        d: Joi.string().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    const sql = "UPDATE quiz_questions_classic SET question = ?, category = ?, subcategory = ?, answer = ?, a = ?, b = ?, c = ?, d = ? WHERE id = ?";
    const data = [
        req.body.question,
        req.body.category,
        req.body.subcategory,
        req.body.answer,
        req.body.a,
        req.body.b,
        req.body.c,
        req.body.d,
        req.body.id
    ];

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, data, (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});;

            if (rows['affectedRows'] === 0){
                return res.json({
                    error: true,
                    code: errorCodes.QUESTION_NOT_FOUND,
                    message: 'The question with the given id was not found.'
                });
            }else {
                return res.json({error: false, data: data});
            }
        });
    });
});

// Delete Classic Question record with given id.
router.delete('/', checkAuth, async (req, res) => {
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