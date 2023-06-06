const express = require('express');
const router = express.Router();

const Joi = require('joi');

const checkAuth = require('../middlewares/check-auth');

const pool = require('../utilities/database');
const responseMessages = require('./responseMessages');

// Fetching all the topics.
router.post('/', checkAuth, (req, res) => {
  const schema = Joi.object({
    lang: Joi.number().integer().default(1), // Default language is Turkish --> 1
  });

  // Change the language if there is a lang variable in request body.
  let lang = 1; // Default language is Turkish --> 1
  if (req.body.lang) lang = req.body.lang;

  const result = schema.validate(req.body);
  if (result.error)
    return res.status(400).json({ message: result.error.details[0].message });

  const sql = 'CALL fetch_all_topics(?);';

  pool.getConnection(function (err, conn) {
    if (err)
      return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
    conn.query(sql, [lang], (error, rows) => {
      conn.release();
      if (error)
        return res
          .status(500)
          .json({ message: responseMessages.DATABASE_ERROR });

      res.send(rows[0]);
    });
  });
});

// Fetching all the topics with the given subcategory.
router.post('/withCategory', checkAuth, (req, res) => {
  const schema = Joi.object({
    id: Joi.number().integer().required(),
    lang: Joi.number().integer().default(1), // Default language is Turkish --> 1
  });

  // Change the language if there is a lang variable in request body.
  let lang = 1; // Default language is Turkish --> 1
  if (req.body.lang) lang = req.body.lang;

  const result = schema.validate(req.body);
  if (result.error)
    return res.status(400).json({ message: result.error.details[0].message });

  const sql = 'CALL fetch_topics_by_category(?,?)';

  pool.getConnection(function (err, conn) {
    if (err)
      return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
    conn.query(sql, [lang, req.body.id], (error, rows) => {
      conn.release();
      if (error)
        return res
          .status(500)
          .json({ message: responseMessages.DATABASE_ERROR });

      return res.send(rows[0]);
    });
  });
});

module.exports = router;
