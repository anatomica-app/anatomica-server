const express = require('express');
const router = express.Router();

const Joi = require('joi');
const { Storage } = require('@google-cloud/storage');
const path = require('path');

const checkAuth = require('../middleware/check-auth');
const checkPrivilege = require('../middleware/check-privilege');

const pool = require('../database');
const constants = require('./constants');
const errorCodes = require('./errors');
const privileges = require('../privileges');

// ***** Google Cloud Storage *****
const gcs = new Storage({
    keyFilename: path.join(__dirname, '../anatomica-ec2cd-a8621075b43a.json'),
    projectId: 'anatomica-ec2cd'
});

const defaultBucket = gcs.bucket('anatomica-ec2cd.appspot.com');

// Fetching all the Image Questions
router.post('/', checkAuth, (req, res) => {
    const schema = Joi.object({
        full: Joi.boolean().required(),
        lang: Joi.number().integer().default(1) // Default language is Turkish --> 1
    });

    // Change the language if there is a lang variable in request body.
    let lang = 1 // Default language is Turkish --> 1
    if (req.body.lang) lang = req.body.lang;

    const result = schema.validate(req.body);
    if (result.error) return res.json({ error: true, message: result.error.details[0].message });

    let sql = "";

    if (req.body.full) {
        // We need to inner join the foreign keys.
        sql = "SELECT quiz_questions_image.id, quiz_questions_image.image, quiz_category.name AS category, quiz_subcategory.name AS subcategory, answer, a, b, c, d, quiz_questions_image.date_added FROM quiz_questions_image INNER JOIN quiz_category ON quiz_questions_image.category = quiz_category.id AND quiz_category.lang = 1 INNER JOIN quiz_subcategory ON quiz_questions_image.subcategory = quiz_subcategory.id AND quiz_subcategory.lang = 1 WHERE quiz_questions_image.lang = 1";

        pool.getConnection(function (err, conn) {
            if (err) return res.json({ error: true, message: err.message });
            conn.query(sql, [lang, lang, lang], (error, rows) => {
                conn.release();
                if (error) return res.json({ error: true, message: error.message });;

                res.json({ error: false, data: rows });
            });
        });
    } else {
        sql = "SELECT * FROM quiz_questions_image WHERE lang = ?";

        pool.getConnection(function (err, conn) {
            if (err) return res.json({ error: true, message: err.message });
            conn.query(sql, [lang], (error, rows) => {
                conn.release();
                if (error) return res.json({ error: true, message: error.message });;

                res.json({ error: false, data: rows });
            });
        });
    }
});

// Fetching the Image Question From Id.
router.post('/withId', checkAuth, async (req, res) => {
    const sql = "SELECT * FROM quiz_questions_image WHERE id = ? AND lang = ?";

    const schema = Joi.object({
        id: Joi.number().integer().required(),
        lang: Joi.number().integer().default(1) // Default language is Turkish --> 1
    });

    // Change the language if there is a lang variable in request body.
    let lang = 1 // Default language is Turkish --> 1
    if (req.body.lang) lang = req.body.lang;

    const result = schema.validate(req.body);
    if (result.error) return res.json({ error: true, message: result.error.details[0].message });

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [req.body.id, lang], (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });;

            if (!rows[0])
                return res.json({
                    error: true,
                    code: errorCodes.QUESTION_NOT_FOUND,
                    message: 'The question was not found on the server.'
                });
            else
                return res.json({ error: false, data: rows[0] });
        });
    });
});

// Fetching the Image Question From Category and Subcategories.
router.post('/withCategory', checkAuth, async (req, res) => {
    const schema = Joi.object({
        category: Joi.number().integer().required(),
        subcategories: Joi.array().required(),
        maxQuestionCount: Joi.number().integer().min(1).required(),
        lang: Joi.number().integer().default(1) // Default language is Turkish --> 1
    });

    // Change the language if there is a lang variable in request body.
    let lang = 1 // Default language is Turkish --> 1
    if (req.body.lang) lang = req.body.lang;

    const result = schema.validate(req.body);
    if (result.error) return res.json({ error: true, message: result.error.details[0].message });

    // Use subcategories array for concetanating the SQL command.
    // For example: [1, 2] will be :
    // subcategory = 1 OR subcategory = 2

    let subcategories = req.body.subcategories;
    let subcategoryQuery = "";

    for (let i = 0; i < subcategories.length; i++) {
        subcategoryQuery += ("subcategory = " + subcategories[i]);

        if (subcategories.length !== 1 && i !== (subcategories.length - 1)) {
            subcategoryQuery += " OR ";
        }
    }

    const sql = `SELECT * FROM quiz_questions_image WHERE lang = ? AND category = ? AND (${subcategoryQuery}) ORDER BY RAND() LIMIT ?`;

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [lang, req.body.category, req.body.maxQuestionCount], (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            return res.json({ error: false, data: rows });
        });
    });
});

// Insert a new Image Question record.
router.post('/create', checkAuth, checkPrivilege(privileges['anatomica.add.question']), async (req, res) => {
    const schema = Joi.object({
        category: Joi.number().integer().required(),
        subcategory: Joi.number().integer().required(),
        answer: Joi.string().valid('A', 'B', 'C', 'D').required(),
        a: Joi.string().required(),
        b: Joi.string().required(),
        c: Joi.string().required(),
        d: Joi.string().required(),
        image: Joi.string().base64().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.json({ error: true, message: result.error.details[0].message });

    // Image processing part.
    const imageBuffer = Buffer.from(req.body.image, 'base64');
    const byteArray = new Uint8Array(imageBuffer);
    const fileURL = `quiz_question_images/${req.body.category}/${req.body.subcategory}/${new Date().getTime()}.jpg`;
    const file = defaultBucket.file(fileURL);

    return file.save(byteArray).then(async () => {
        file.makePublic();
        const url = `https://storage.googleapis.com/anatomica-ec2cd.appspot.com/${fileURL}`;
        const data = [
            url,
            req.body.category,
            req.body.subcategory,
            req.body.answer,
            req.body.a,
            req.body.b,
            req.body.c,
            req.body.d
        ];

        const sql = "INSERT INTO quiz_questions_image (image, category, subcategory, answer, a, b, c, d) VALUES (?,?,?,?,?,?,?,?)";

        pool.getConnection(function (err, conn) {
            if (err) return res.json({ error: true, message: err.message });
            conn.query(sql, data, (error, rows) => {
                conn.release();
                if (error) return res.json({ error: true, message: error.message });;

                if (rows['insertId'] === 0) {
                    return res.json({
                        error: true,
                        code: errorCodes.QUESTION_CAN_NOT_BE_CREATED,
                        message: 'The data can not be inserted.'
                    });
                } else {
                    return res.json({ error: false, data: rows['insertId'] });
                }
            });
        });
    });
});

// Update Image Question record with given id.
router.put('/', checkAuth, checkPrivilege(privileges['anatomica.update.question']), async (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required(),
        lang: Joi.number().integer(),
        category: Joi.number().integer().required(),
        subcategory: Joi.number().integer().required(),
        answer: Joi.string().valid('A', 'B', 'C', 'D').required(),
        a: Joi.string().required(),
        b: Joi.string().required(),
        c: Joi.string().required(),
        d: Joi.string().required(),
        image: Joi.string().base64() // Image is not a must.
    });

    // Change the language if there is a lang variable in request body.
    let lang = 1; // Default language is Turkish --> 1
    if (req.body.lang) lang = req.body.lang;

    const result = schema.validate(req.body);
    if (result.error) return res.json({ error: true, message: result.error.details[0].message });

    if (req.body.image) {
        // Request body contains image.
        // Let's check if we add new language
        // or updating an existing one.
        const sql = "SELECT * FROM quiz_questions_image WHERE id = ? AND lang = ?";
        pool.getConnection(function (err, conn) {
            if (err) return res.json({ error: true, message: err.message });
            conn.query(sql, [req.body.id, lang], (error, rows) => {
                if (error) return res.json({ error: true, message: error.message });

                let sql2 = "";
                let data = [];

                if (!rows[0]) {
                    // The question with the given lang and id not found.
                    // So we are adding a new language.
                    // Let's upload the file to the bucket.
                    console.log('There is a photo, adding a new language.');
                    const imageBuffer = Buffer.from(req.body.image, 'base64');
                    const byteArray = new Uint8Array(imageBuffer);
                    const fileURL = `quiz_question_images/${req.body.category}/${req.body.subcategory}/${new Date().getTime()}.jpg`;
                    const file = defaultBucket.file(fileURL);

                    file.save(byteArray).then(async () => {
                        file.makePublic();

                        const url = `https://storage.googleapis.com/anatomica-ec2cd.appspot.com/${fileURL}`;

                        data = [
                            req.body.id,
                            req.body.lang,
                            url,
                            req.body.category,
                            req.body.subcategory,
                            req.body.answer,
                            req.body.a,
                            req.body.b,
                            req.body.c,
                            req.body.d,
                        ];

                        sql2 = "INSERT INTO quiz_questions_image (id, lang, image, category, subcategory, answer, a, b, c, d) VALUES (?,?,?,?,?,?,?,?,?,?)";

                        pool.getConnection(function (err, conn) {
                            if (err) return res.json({ error: true, message: err.message });
                            conn.query(sql2, data, (error, rows) => {
                                conn.release();
                                if (error) return res.json({ error: true, message: error.message });
        
                                if (rows['affectedRows'] === 0) {
                                    return res.json({
                                        error: true,
                                        code: errorCodes.QUESTION_CAN_NOT_BE_UPDATED,
                                        message: 'The question with the given id can not be updated.'
                                    });
                                } else {
                                    return res.json({ error: false, data: data });
                                }
                            });
                        });
                    });
                } else {
                    // We are not adding new language.
                    // Let's update the fields.
                    console.log('There is a photo, updating the existing language.');

                    // First delete the previous image if it exists.
                    // We need to strip the url in order to get the bucket file path.
                    // Let's strip down before /quiz_question_images/..
                    // https://storage.googleapis.com/anatomica-ec2cd.appspot.com/quiz_question_images/1/1/1631631802266.jpg
                    let image = rows[0]['image'];
                    let imageUrl = image.split('anatomica-ec2cd.appspot.com/')[1];

                    if (defaultBucket.file(imageUrl).exists()) {
                        async function deleteFile() {
                            await defaultBucket.file(imageUrl).delete();
                        }

                        deleteFile().catch(err => {
                            res.json({ error: true, message: err.message, fileUrl: imageUrl });
                        })
                    }

                    const imageBuffer = Buffer.from(req.body.image, 'base64');
                    const byteArray = new Uint8Array(imageBuffer);
                    const fileURL = `quiz_question_images/${req.body.category}/${req.body.subcategory}/${new Date().getTime()}.jpg`;
                    const file = defaultBucket.file(fileURL);

                    file.save(byteArray).then(async () => {
                        file.makePublic();

                        const url = `https://storage.googleapis.com/anatomica-ec2cd.appspot.com/${fileURL}`;

                        data = [
                            url,
                            req.body.category,
                            req.body.subcategory,
                            req.body.answer,
                            req.body.a,
                            req.body.b,
                            req.body.c,
                            req.body.d,
                            req.body.id,
                            req.body.lang,
                        ];

                        sql2 = "UPDATE quiz_questions_image SET image = ?, category = ?, subcategory = ?, answer = ?, a = ?, b = ?, c = ?, d = ? WHERE id = ? AND lang = ?";

                        pool.getConnection(function (err, conn) {
                            if (err) return res.json({ error: true, message: err.message });
                            conn.query(sql2, data, (error, rows) => {
                                conn.release();
                                if (error) return res.json({ error: true, message: error.message });
        
                                if (rows['affectedRows'] === 0) {
                                    return res.json({
                                        error: true,
                                        code: errorCodes.QUESTION_CAN_NOT_BE_UPDATED,
                                        message: 'The question with the given id can not be updated.'
                                    });
                                } else {
                                    return res.json({ error: false, data: data });
                                }
                            });
                        });
                    });
                }
            });
        });
    } else {
        // Request body does not contain image.
        // Let's check if we add new language
        // or updating an existing one.
        const sql = "SELECT * FROM quiz_questions_image WHERE id = ? AND lang = ?";
        pool.getConnection(function (err, conn) {
            if (err) return res.json({ error: true, message: err.message });
            conn.query(sql, [req.body.id, lang], (error, rows) => {
                if (error) return res.json({ error: true, message: error.message });

                let sql2 = "";
                let data = [];

                if (!rows[0]) {
                    // The question with the given lang and id not found.
                    // So we are adding a new language.
                    console.log('There is not a photo, adding a new language.');

                    const sql3 = "SELECT * FROM quiz_questions_image WHERE id = ?";
                    pool.getConnection(function (err, conn) {
                        if (err) return res.json({ error: true, message: err.message });
                        conn.query(sql3, [req.body.id], (error, rows) => {
                            conn.release();
                            if (error) return res.json({ error: true, message: error.message });
    
                            if (!rows[0]) {
                                return res.json({
                                    error: true,
                                    code: errorCodes.QUESTION_CAN_NOT_BE_UPDATED,
                                    message: 'The question with the given id can not be updated.'
                                });
                            } else {
                                sql2 = "INSERT INTO quiz_questions_image (id, lang, image, category, subcategory, answer, a, b, c, d) VALUES (?,?,?,?,?,?,?,?,?,?)";

                                data = [
                                    req.body.id,
                                    req.body.lang,
                                    rows[0].image,
                                    req.body.category,
                                    req.body.subcategory,
                                    req.body.answer,
                                    req.body.a,
                                    req.body.b,
                                    req.body.c,
                                    req.body.d,
                                ];

                                pool.getConnection(function (err, conn) {
                                    if (err) return res.json({ error: true, message: err.message });
                                    conn.query(sql2, data, (error, rows) => {
                                        conn.release();
                                        if (error) return res.json({ error: true, message: error.message });
                
                                        if (rows['affectedRows'] === 0) {
                                            return res.json({
                                                error: true,
                                                code: errorCodes.QUESTION_CAN_NOT_BE_UPDATED,
                                                message: 'The question with the given id can not be updated.'
                                            });
                                        } else {
                                            return res.json({ error: false, data: data });
                                        }
                                    });
                                });
                            }
                        });
                    });
                }else {
                    // We are not adding new language.
                    // Let's update the fields.
                    console.log('There is not a photo, updating the existing language.');
                    sql2 = "UPDATE quiz_questions_image SET category = ?, subcategory = ?, answer = ?, a = ?, b = ?, c = ?, d = ? WHERE id = ? AND lang = ?";

                    data = [
                        req.body.category,
                        req.body.subcategory,
                        req.body.answer,
                        req.body.a,
                        req.body.b,
                        req.body.c,
                        req.body.d,
                        req.body.id,
                        req.body.lang,
                    ];

                    pool.getConnection(function (err, conn) {
                        if (err) return res.json({ error: true, message: err.message });
                        conn.query(sql2, data, (error, rows) => {
                            conn.release();
                            if (error) return res.json({ error: true, message: error.message });
    
                            if (rows['affectedRows'] === 0) {
                                return res.json({
                                    error: true,
                                    code: errorCodes.QUESTION_CAN_NOT_BE_UPDATED,
                                    message: 'The question with the given id can not be updated.'
                                });
                            } else {
                                return res.json({ error: false, data: data });
                            }
                        });
                    });
                }
            });
        });
    }
});

// Delete Image Question record with given id.
router.delete('/', checkAuth, checkPrivilege(privileges['anatomica.delete.question']), async (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.json({ error: true, message: result.error.details[0].message });

    const sql = "DELETE FROM quiz_questions_image WHERE id = ?";

    pool.getConnection(function (err, conn) {
        if (err) return res.json({ error: true, message: err.message });
        conn.query(sql, [req.body.id], (error, rows) => {
            conn.release();
            if (error) return res.json({ error: true, message: error.message });

            if (rows['affectedRows'] === 0) return res.json({
                error: true,
                code: errorCodes.QUESTION_NOT_FOUND,
                message: 'The question with the given id was not found on the server.'
            });
            return res.json({ error: false, id: req.body.id });
        });
    });
});

module.exports = router