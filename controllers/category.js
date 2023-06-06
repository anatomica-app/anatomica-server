const pool = require('../utilities/database');
const responseMessages = require('../utilities/responseMessages');
const Joi = require('joi');

const storageUrlPrefix =
  'https://storage.googleapis.com/anatomica-storage/quiz_category_icons/';

exports.getAllCategories = (req, res) => {
  const sql = 'CALL fetch_all_categories();';

  pool.getConnection(function (err, conn) {
    if (err)
      return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
    conn.query(sql, (error, rows) => {
      conn.release();
      if (error)
        return res
          .status(500)
          .json({ message: responseMessages.DATABASE_ERROR });

      let categories = rows[0];
      categories.forEach((element) => {
        element.icon = storageUrlPrefix + element.icon;
      });

      return res.send(categories);
    });
  });
}

exports.getAllCategoriesWithLanguage = (req, res) => {
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
    if (err)
      return res.status(500).json({ message: responseMessages.DATABASE_ERROR });
    conn.query(sql, [lang], (error, rows) => {
      conn.release();
      if (error)
        return res
          .status(500)
          .json({ message: responseMessages.DATABASE_ERROR });

      let categories = rows[0];
      categories.forEach((element) => {
        element.icon = storageUrlPrefix + element.icon;
      });

      return res.send(categories);
    });
  });
}