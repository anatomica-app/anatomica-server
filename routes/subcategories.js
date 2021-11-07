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