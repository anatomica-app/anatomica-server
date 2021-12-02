const express = require('express');
const router = express.Router();

const Joi = require('joi');

const checkAuth = require('../middleware/check-auth');
const checkPrivilege = require('../middleware/check-privilege');

const pool = require('../database');
const constants = require('./constants');
const errorCodes = require('./errors');
const privileges = require('../privileges');

// Fetching all the topics.
router.get('/', checkAuth, (req, res) => {
    const sql = "SELECT * FROM quiz_topic";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});;

            res.json({error: false, data: rows});
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
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    const sql = "SELECT * FROM quiz_topic WHERE subcategory = ? AND lang = ?";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.id, lang],(error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});

            return res.json({error: false, data: rows});
        });
    });
});

// Create a new topic.
router.post('/', checkAuth, checkPrivilege(privileges['anatomica.add.topic']), (req, res) => {
    const schema = Joi.object({
        name: Joi.string().required(),
        subcategory: Joi.number().integer().required(),
        lang: Joi.number().integer().default(1) // Default language is Turkish --> 1
    });

    // Change the language if there is a lang variable in request body.
    let lang = 1 // Default language is Turkish --> 1
    if (req.body.lang) lang = req.body.lang;

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    const sql = "INSERT INTO quiz_topic (lang, name, subcategory) VALUES (?,?,?)";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [lang, req.body.name, req.body.category, req.body.subcategory], (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});

            if (rows['insertId'] === 0) {
                return res.json({
                    error: true,
                    code: errorCodes.TOPIC_CAN_NOT_BE_CREATED,
                    message: 'The topic can not be created.'
                });
            }else {
                return res.json({error: false, data: rows['insertId']});
            }
        });
    });
});

// Update a topic.
router.put('/', checkAuth, checkPrivilege(privileges['anatomica.update.topic']), (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required(),
        name: Joi.string().required(),
        subcategory: Joi.number().integer().required(),
        lang: Joi.number().integer().default(1) // Default language is Turkish --> 1
    });

    // Change the language if there is a lang variable in request body.
    let lang = 1 // Default language is Turkish --> 1
    if (req.body.lang) lang = req.body.lang;

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    const sql = "UPDATE quiz_topic SET lang = ?, name = ?, category = ?, subcategory = ? WHERE id = ?";
    const data = [
        lang,
        req.body.name,
        req.body.subcategory,
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
                    code: errorCodes.TOPIC_CAN_NOT_BE_UPDATED,
                    message: 'The topic can not be updated.'
                });
            }else {
                return res.json({error: false, data: data});
            }
        });
    });
});

// Delete a topic.
router.delete('/', checkAuth, checkPrivilege(privileges['anatomica.delete.topic']), async (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    const sql = "DELETE FROM quiz_topic WHERE id = ?";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.id], (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});

            if (rows['affectedRows'] === 0) return res.json({
                error: true,
                code: errorCodes.TOPIC_NOT_FOUND,
                message: 'The topic with the given id was not fount on the server.'
            });
            else return res.json({error: false, id: req.body.id});
        });
    });
});

module.exports = router