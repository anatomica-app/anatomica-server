const pool = require('../utilities/database');
const responseMessages = require('../utilities/responseMessages');
const Joi = require('joi');

exports.getAllFeedbacks = (req, res) => {
  const sql = 'CALL fetch_feedbacks();';

  pool.getConnection(function (err, conn) {
    if (err)
      return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
    conn.query(sql, (error, rows) => {
      conn.release();
      if (error)
        return res
          .status(500)
          .json({ message: responseMessages.DATABASE_ERROR });

      return res.send(rows[0]);
    });
  });
};

exports.postFeedback = (req, res) => {
  const schema = Joi.object({
    userId: Joi.number().integer().required(),
    message: Joi.string().required(),
    appVersion: Joi.string().required(),
    osType: Joi.string().required(),
  });

  const result = schema.validate(req.body);
  if (result.error)
    return res.status(400).json({ message: result.error.details[0].message });

  const sql = 'CALL create_feedback(?, ?, ?, ?);';
  data = [
    req.body.userId,
    req.body.message,
    req.body.appVersion,
    req.body.osType,
  ];

  pool.getConnection(function (err, conn) {
    if (err)
      return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
    conn.query(sql, data, (error, rows) => {
      conn.release();
      if (error)
        return res
          .status(500)
          .json({ message: responseMessages.DATABASE_ERROR });

      if (rows[0].insertId === 0) {
        return res.status(500).json({
          message: responseMessages.FEEDBACK_CANNOT_CREATED,
        });
      } else {
        return res.send({
          id: rows[0].insertId,
          userId: req.body.userId,
          message: req.body.message,
          appVersion: req.body.appVersion,
          osType: req.body.osType,
        });
      }
    });
  });
}