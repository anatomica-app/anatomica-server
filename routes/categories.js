const express = require('express');
const router = express.Router();

const Joi = require('joi');

const checkAuth = require('../middleware/check-auth');

const pool = require('../database');
const responseMessages = require('./responseMessages');
const userInfo = require('../authenticatedUserService');
const logger = require('../logger');

const storageUrlPrefix =
  'https://storage.googleapis.com/anatomica-storage/quiz_category_icons/';

// Fetching all the categories.
router.get('/', checkAuth, (req, res) => {
  const sql = 'CALL fetch_all_categories();';

  pool.getConnection(function (err, conn) {
    if (err) {
      logger.logDatabaseError(req, err);
      return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
    }

    conn.query(sql, (error, rows) => {
      conn.release();
      if (error) {
        logger.logDatabaseError(req, error);
        return res
          .status(500)
          .json({ message: responseMessages.DATABASE_ERROR });
      }

      let categories = rows[0];
      categories.forEach((element) => {
        element.icon = storageUrlPrefix + element.icon;
      });

      logger.logger.info("Fetch Categories", {
        request: userInfo(req),
        responseLength: categories.length
      });
      return res.send(categories);
    });
  });
});

// Fetching all the categories with language.
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

  let sql = 'CALL fetch_categories_with_lang(?);';

  pool.getConnection(function (err, conn) {
    if (err) {
      logger.logDatabaseError(req, err);
      return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
    }

    conn.query(sql, [lang], (error, rows) => {
      conn.release();
      if (error) {
        logger.logDatabaseError(req, error);
        return res
          .status(500)
          .json({ message: responseMessages.DATABASE_ERROR });
      }

      let categories = rows[0];
      categories.forEach((element) => {
        element.icon = storageUrlPrefix + element.icon;
      });
      logger.logger.info("Fetch Categories", {
        request: userInfo(req),
        requestInfo: { lang: lang },
        responseLength: categories.length
      });
      return res.send(categories);
    });
  });
});

module.exports = router;
