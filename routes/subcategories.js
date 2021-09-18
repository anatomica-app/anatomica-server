const express = require('express');
const router = express.Router();

const mysql = require('mysql');
const Joi = require('joi');

// ***** MySQL Connection *****
const pool = mysql.createPool({
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DATABASE,
    socketPath: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`
});

// Fetching all the subcategories.
router.get('/', (req, res) => {
    const sql = "SELECT * FROM quiz_subcategory";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({error: true, message: error.message});;

            res.json({error: false, data: rows});
        });
    });
});

// Fetching all the subcategories with the given category.
router.post('/withCategory', (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required()
    })

    const result = schema.validate(req.body);
    if (result.error) return res.status(400).send(result.error.details[0].message);

    const sql = "SELECT * FROM quiz_subcategory WHERE category = ?";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.id],(error, rows) => {
            conn.release();
            if (error) return res.status(500).json({error: true, message: error.message});

            return res.json({error: false, data: rows});
        });
    });
});

// Create a new subcategory.
router.post('/', (req, res) => {
    const schema = Joi.object({
        name: Joi.string().required(),
        category: Joi.number().integer().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.status(400).send(result.error.details[0].message);

    const sql = "INSERT INTO quiz_subcategory (name, category) VALUES (?,?)";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.name, req.body.category], (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({error: true, message: error.message});

            if (rows['insertId'] === 0) {
                return res.json({error: true, message: 'The subcategory can not be created.'});
            }else {
                return res.json({error: false, data: rows['insertId']});
            }
        });
    });
});

// Update a subcategory.
router.put('/', (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required(),
        name: Joi.string().required(),
        category: Joi.number().integer().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.status(400).send(result.error.details[0].message);

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
            if (error) return res.status(500).json({error: true, message: error.message});

            if (rows['affectedRows'] === 0) {
                return res.json({error: true, message: 'The subcategory can not be updated.'});
            }else {
                return res.json({error: false, data: data});
            }
        });
    });
});

// Delete a category.
router.delete('/', async (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.status(400).send(result.error.details[0].message);

    const sql = "DELETE FROM quiz_subcategory WHERE id = ?";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.id], (error, rows) => {
            conn.release();
            if (error) return res.status(500).json({error: true, message: error.message});

            if (rows['affectedRows'] === 0) return res.status(404).json({error: true, message: 'The subcategory with the given id was not fount on the server.'});
            else return res.json({error: false, id: req.body.id});
        });
    });
});

module.exports = router