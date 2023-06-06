const Joi = require('joi');
const pool = require('../utilities/database');
const responseMessages = require('../utilities/responseMessages');

/** Classic Questions */
exports.getAllClassicQuestions = (req, res) => {
  const schema = Joi.object({
    full: Joi.boolean().required(),
    lang: Joi.number().integer().default(1), // Default language is Turkish --> 1
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
    sql = 'CALL fetch_classic_questions_with_joins(?);';

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
    sql = 'CALL fetch_classic_questions(?);';

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
}

exports.getAllClassicQuestionsFromId = async (req, res) => {
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

  const sql = 'CALL fetch_classic_question_by_id(?, ?);';

  pool.getConnection(function (err, conn) {
    if (err)
      return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
    conn.query(sql, [req.body.id, lang], (error, rows) => {
      conn.release();
      if (error)
        return res
          .status(500)
          .json({ message: responseMessages.DATABASE_ERROR });

      if (!rows[0][0])
        return res.status(404).json({
          message: errorMessages.QUESTION_NOT_FOUND,
        });
      else return res.send(rows[0][0]);
    });
  });
}

exports.getAllClassicQuestionsFromCategoryAndSubcategories = async (req, res) => {
  const schema = Joi.object({
    category: Joi.number().integer().required(),
    subcategories: Joi.array().required(),
    topics: Joi.array(),
    maxQuestionCount: Joi.number().integer().min(1).required(),
    lang: Joi.number().integer().default(1), // Default language is Turkish --> 1
  });

  // Change the language if there is a lang variable in request body.
  let lang = 1; // Default language is Turkish --> 1
  if (req.body.lang) lang = req.body.lang;

  const result = schema.validate(req.body);
  if (result.error)
    return res.status(400).json({ message: result.error.details[0].message });

  // Use subcategories array for concetanating the SQL command.
  // For example: 1,2 will be:
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

  const sql = 'CALL fetch_classic_questions_by_category(?, ?, ?, ?, ?);';

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
}


