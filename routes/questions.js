const express = require('express');
const router = express.Router();

const Joi = require('joi');

const checkAuth = require('../middleware/check-auth');

const pool = require('../database');
const responseMessages = require('./responseMessages');

// Fetching all the questions
router.post('/', checkAuth, (req, res) => {
  const schema = Joi.object({
    full: Joi.boolean().required(),
    lang: Joi.number().integer().default(1), // Default language is Turkish --> 1
    type: Joi.number().integer().required(), // 1: Multiple Choice, 2: Open Ended
  });

  // Change the language if there is a lang variable in request body.
  let lang = 1; // Default language is Turkish --> 1
  if (req.body.lang) lang = req.body.lang;

  const result = schema.validate(req.body);
  if (result.error)
    return res.status(400).json({ message: result.error.details[0].message });

  let sql = '';

  if (req.body.full) {
    // We need to inner join the foreign keys.
    if (req.body.type == 1) {
      sql = 'CALL fetch_pictured_questions_with_joins(?);';
    } else {
      sql = 'CALL fetch_questions_with_joins(?);';
    }

    pool.getConnection(function (err, conn) {
      if (err)
        return res
          .status(500)
          .json({ message: responseMessages.DATABASE_ERROR });
      conn.query(sql, [lang], (error, rows) => {
        conn.release();
        if (error)
          return res
            .status(500)
            .json({ message: responseMessages.DATABASE_ERROR });

        return res.send(rows[0]);
      });
    });
  } else {
    if (req.body.type == 1) {
      sql = 'CALL fetch_pictured_questions(?);';
    } else {
      sql = 'CALL fetch_questions(?);';
    }

    pool.getConnection(function (err, conn) {
      if (err)
        return res
          .status(500)
          .json({ message: responseMessages.DATABASE_ERROR });
      conn.query(sql, [lang], (error, rows) => {
        conn.release();
        if (error)
          return res
            .status(500)
            .json({ message: responseMessages.DATABASE_ERROR });

        return res.send(rows[0]);
      });
    });
  }
});

// Fetching the Image Question From Id.
router.post('/withId', checkAuth, async (req, res) => {
  const schema = Joi.object({
    id: Joi.number().integer().required(),
    lang: Joi.number().integer().default(1), // Default language is Turkish --> 1
    type: Joi.number().integer().required(), // 1: Multiple Choice, 2: Open Ended
  });

  // Change the language if there is a lang variable in request body.
  let lang = 1; // Default language is Turkish --> 1
  if (req.body.lang) lang = req.body.lang;

  const result = schema.validate(req.body);
  if (result.error)
    return res.status(400).json({ message: result.error.details[0].message });

  let sql = '';

  if (req.body.type == 1) {
    sql = 'CALL fetch_pictured_question_by_id(?, ?);';
  } else {
    sql = 'CALL fetch_question_by_id(?, ?);';
  }

  pool.getConnection(function (err, conn) {
    if (err) return res.status(500).json({ message: responseMessages });
    conn.query(sql, [req.body.id, lang], (error, rows) => {
      conn.release();
      if (error) return res.status(500).json({ message: responseMessages });

      if (!rows[0])
        return res.status(404).json({
          message: responseMessages.QUESTION_NOT_FOUND,
        });
      else return res.send(rows[0]);
    });
  });
});

// Fetching the Image Question From Category and Subcategories.
router.post('/withCategory', checkAuth, async (req, res) => {
  const schema = Joi.object({
    category: Joi.number().integer().required(),
    subcategories: Joi.array().required(),
    topics: Joi.array(),
    maxQuestionCount: Joi.number().integer().min(1).required(),
    lang: Joi.number().integer().default(1), // Default language is Turkish --> 1
    type: Joi.number().integer().required(), // 1: Multiple Choice, 2: Open Ended
  });

  // Change the language if there is a lang variable in request body.
  let lang = 1; // Default language is Turkish --> 1
  if (req.body.lang) lang = req.body.lang;

  const result = schema.validate(req.body);
  if (result.error)
    return res.status(400).json({ message: result.error.details[0].message });

  // Use subcategories array for concetanating the SQL command.
  // For example: [1, 2] will be :
  // subcategory = 1 OR subcategory = 2

  let subcategories = req.body.subcategories;
  let topics = req.body.topics;
  let subcategoryQuery = '';
  let topicsQuery = '';

  for (let i = 0; i < subcategories.length; i++) {
    subcategoryQuery += subcategories[i] + ',';
  }
  subcategoryQuery += '0';

  for (let i = 0; i < topics.length; i++) {
    topicsQuery += topics[i] + ',';
  }
  topicsQuery += '0';

  let sql = '';

  if (req.body.type == 1) {
    sql = 'CALL fetch_pictured_questions_by_category(?, ?, ?, ?, ?);';
  } else {
    sql = 'CALL fetch_questions_by_category(?, ?, ?, ?, ?);';
  }

  pool.getConnection(function (err, conn) {
    if (err)
      return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
    conn.query(
      sql,
      [
        lang,
        req.body.category,
        subcategoryQuery,
        topicsQuery,
        req.body.maxQuestionCount,
      ],
      (error, rows) => {
        conn.release();
        if (error)
          return res
            .status(500)
            .json({ message: responseMessages.DATABASE_ERROR });

        return res.send(rows[0]);
      }
    );
  });
});

module.exports = router;
