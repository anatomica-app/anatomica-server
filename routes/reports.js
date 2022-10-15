const express = require('express');
const router = express.Router();

const Joi = require('joi');

const checkAuth = require('../middleware/check-auth');

const pool = require('../database');

// Create a new report.
router.post('/', checkAuth, (req, res) => {
  const schema = Joi.object({
    userId: Joi.number().integer().required(),
    classicId: Joi.number().integer().allow(null).required(),
    picturedId: Joi.number().integer().allow(null).required(),
    message: Joi.string().required(),
  });

  const result = schema.validate(req.body);
  if (result.error)
    return res.status(400).json({ message: result.error.details[0].message });

  const sql = 'CALL create_question_report(?, ?, ?, ?)';
  data = [
    req.body.userId,
    req.body.classicId,
    req.body.picturedId,
    req.body.message,
  ];

  pool.getConnection(function (err, conn) {
    if (err) return res.status(500).json({ message: err.message });
    conn.query(sql, data, (error, rows) => {
      conn.release();
      if (error) return res.status(500).json({ message: error.message });

      if (rows[0].insertId === 0) {
        return res.status(500).json({
          message: 'The report can not be inserted.',
        });
      } else {
        console.log(rows[0]);
        console.log(rows[0].insertId);
        return res.send({
          id: rows[0].insertId,
          userId: req.body.userId,
          classicId: req.body.classicId,
          picturedId: req.body.picturedId,
          message: req.body.message,
        });
      }
    });
  });
});

module.exports = router;
