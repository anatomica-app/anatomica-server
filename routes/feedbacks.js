const express = require('express');
const router = express.Router();

const mysql = require('mysql');
const Joi = require('joi');

// ***** MySQL Connection *****
const pool = mysql.createPool({
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DATABASE,
    socketPath: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`,
    dateStrings: true
});

// Fetching all the feedbacks.
router.get('/', (req, res) => {
    const sql = "SELECT * FROM feedback";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});;

            return res.json({error: false, data: rows});
        });
    });
});

// Create a new feedback.
router.post('/', (req, res) => {
    const schema = Joi.object({
        userId: Joi.number().integer().required(),
        message: Joi.string().required(),
        app_version: Joi.string().required(),
        device: Joi.string().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    const sql = "INSERT INTO feedback (userId, message, app_version, device) VALUES (?,?,?,?)";
    data = [
        req.body.userId,
        req.body.message,
        req.body.app_version,
        req.body.device
    ];

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, data, (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});

            if (rows['insertId'] === 0) {
                return res.json({error: true, message: 'The feedback can not be inserted.'});
            }else {
                return res.json({error: false, data: rows['insertId']});
            }
        });
    });
});

// Update a feedback.
router.put('/', (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required(),
        userId: Joi.number().integer().required(),
        message: Joi.string().required(),
        app_version: Joi.string().required(),
        device: Joi.string().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    const sql = "UPDATE feedback SET userId = ?, message = ?, app_version = ?, device = ? WHERE id = ?";
    data = [
        req.body.userId,
        req.body.message,
        req.body.app_version,
        req.body.device,
        req.body.id
    ];

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, data, (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});

            if (rows['affectedRows'] === 0) {
                return res.json({error: true, message: 'The feedback can not be updated.'});
            }else {
                return res.json({error: false, data: data});
            }
        });
    });
})

// Delete a feedback.
router.delete('/', async (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    const sql = "DELETE FROM feedback WHERE id = ?";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.id], (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});

            if (rows['affectedRows'] === 0) return res.json({error: true, message: 'The feedback with the given id was not fount on the server.'});
            else return res.json({error: false, id: req.body.id});
        });
    });
});

module.exports = router;