const express = require('express');
const router = express.Router();

const Joi = require('joi');

const checkAuth = require('../middleware/check-auth');
const checkPrivilege = require('../middleware/check-privilege');

const pool = require('../database');
const constants = require('./constants');
const errorCodes = require('./errors');

router.post('/', checkAuth, async (req, res) => {
    const schema = Joi.object({
        user: Joi.number().integer().required(),
        sku: Joi.string().required()
    });
    
    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});
    
    const sql = "INSERT INTO user_purchases (user, sku) VALUES (?,?)";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.user, req.body.sku],(error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});

            return res.json({error: false, data: rows});
        });
    });
});

module.exports = router;