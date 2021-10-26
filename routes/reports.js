const express = require('express');
const router = express.Router();

const Joi = require('joi');

const checkAuth = require('../middleware/check-auth');
const checkPrivilege = require('../middleware/check-privilege');

const pool = require('../database');
const constants = require('./constants');
const errorCodes = require('./errors');
const privileges = require('../privileges');

// Fetching all the reports.
router.get('/', checkAuth, (req, res) => {
    const sql = "SELECT * FROM quiz_reports";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});;

            return res.json({error: false, data: rows});
        });
    });
});

// Create a new report.
router.post('/', checkAuth, (req, res) => {
    const schema = Joi.object({
        classic_id: Joi.number().integer().allow(null).required(),
        image_id: Joi.number().integer().allow(null).required(),
        user: Joi.number().integer().required(),
        message: Joi.string().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    const sql = "INSERT INTO quiz_reports (classic_id, image_id, user, message) VALUES (?,?,?,?)";
    data = [
        req.body.classic_id,
        req.body.image_id,
        req.body.user,
        req.body.message
    ];

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, data, (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});

            if (rows['insertId'] === 0) {
                return res.json({
                    error: true,
                    code: errorCodes.REPORT_CAN_NOT_BE_CREATED,
                    message: 'The report can not be inserted.'
                });
            }else {
                return res.json({error: false, data: rows['insertId']});
            }
        });
    });
});

// Update a report.
router.put('/', checkAuth, (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required(),
        classic_id: Joi.number().integer().allow(null).required(),
        image_id: Joi.number().integer().allow(null).required(),
        user: Joi.number().integer().required(),
        message: Joi.string().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    const sql = "UPDATE quiz_reports SET classic_id = ?, image_id = ?, user = ?, message = ? WHERE id = ?";
    data = [
        req.body.classic_id,
        req.body.image_id,
        req.body.user,
        req.body.message,
        req.body.id
    ];

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, data, (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});

            if (rows['affectedRows'] === 0) {
                return res.json({
                    error: true,
                    code: errorCodes.REPORT_CAN_NOT_BE_UPDATED,
                    message: 'The repoort can not be updated.'
                });
            }else {
                return res.json({error: false, data: data});
            }
        });
    });
})

// Delete a report.
router.delete('/', checkAuth, checkPrivilege(privileges['anatomica.delete.report']), async (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    const sql = "DELETE FROM quiz_reports WHERE id = ?";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.id], (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});

            if (rows['affectedRows'] === 0) return res.json({
                error: true,
                code: errorCodes.REPORT_NOT_FOUND,
                message: 'The report with the given id was not fount on the server.'
            });
            else return res.json({error: false, id: req.body.id});
        });
    });
});

module.exports = router