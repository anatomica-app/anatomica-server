const express = require('express');
const router = express.Router();

const mysql = require('mysql');
const Joi = require('joi');
const {Storage} = require('@google-cloud/storage');
const path = require('path');

// ***** MySQL Connection *****
const pool = mysql.createPool({
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DATABASE,
    socketPath: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`
});

// ***** Google Cloud Storage *****
const gcs = new Storage({
    keyFilename: path.join(__dirname, '../anatomica-ec2cd-a8621075b43a.json'),
    projectId: 'anatomica-ec2cd'
});

const defaultBucket = gcs.bucket('anatomica-ec2cd.appspot.com');

// Fetching all the Image Questions
router.post('/', (req, res) => {
    const schema = Joi.object({
        full: Joi.boolean().required()
    })

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    let sql = "";

    if (req.body.full) {
        // We need to inner join the foreign keys.
        sql = "SELECT quiz_questions_image.id, image, quiz_category.name AS category, quiz_subcategory.name AS subcategory, answer, a, b, c, d, quiz_questions_image.date_added FROM quiz_questions_image INNER JOIN quiz_category on quiz_questions_image.category = quiz_category.id INNER JOIN quiz_subcategory ON quiz_questions_image.subcategory = quiz_subcategory.id";
    }else {
        sql = "SELECT * FROM quiz_questions_image";
    }

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});;

            res.json({error: false, data: rows});
        });
    });
});

// Fetching the Image Question From Id.
router.post('/withId', async (req, res) => {
    const sql = "SELECT * FROM quiz_questions_image WHERE id = ?";

    const schema = Joi.object({
        id: Joi.number().integer().required()
    })

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.id], (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});;

            if(!result[0])
                return res.json({error: true, message: 'The question was not found on the server.'});
            else
                return res.json({error: false, data: rows[0]});
        });
    });
});

// Fetching the Image Question From Category and Subcategories.
router.post('/withCategory', async (req, res) => {
    const schema = Joi.object({
        category: Joi.number().integer().required(),
        subcategories: Joi.array().required(),
        maxQuestionCount: Joi.number().integer().min(1).required(),
    })

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    // Split the 'subcategories' string from commas ',' and create a list.
    // Use this list for concetanating the SQL command.
    // For example: 1,2 will be:
    // subcategory = 1 OR subcategory = 2

    let subcategories = req.body.subcategories;
    let subcategoryQuery = "";

    for (let i = 0; i < subcategories.length; i++) {
        subcategoryQuery += ("subcategory = " + i);

        if (i !== (subcategories.length - 1)) {
            subcategoryQuery += " OR ";
        }
    }

    const sql = `SELECT * FROM quiz_questions_image WHERE category = ? AND ${subcategoryQuery} ORDER BY RAND() LIMIT ?`;

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.category, req.body.maxQuestionCount], (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});;

            return res.json({error: false, data: rows});
        });
    });
});

// Insert a new Image Question record.
router.post('/create', async (req, res) => {
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
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    // Image processing part.
    const imageBuffer = Buffer.from(req.body.image, 'base64');
    const byteArray = new Uint8Array(imageBuffer);
    const fileURL = `quiz_question_images/${req.body.category}/${req.body.subcategory}/${new Date().getTime()}.jpg`;
    const file = defaultBucket.file(fileURL);

    return file.save(byteArray).then(async () => {
        file.makePublic();
        const url = `https://storage.cloud.google.com/anatomica-ec2cd.appspot.com/${fileURL}`;
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
    
        pool.getConnection(function(err, conn){
            if (err) return res.json({error: true, message: err.message});
            conn.query(sql, data, (error, rows) => {
                conn.release();
                if (error) return res.json({error: true, message: error.message});;
    
                if (rows['insertId'] === 0){
                    return res.json({error: true, message: 'The data can not be inserted.'});
                }else {
                    return res.json({error: false, data: rows['insertId']});
                }
            });
        });
    });
});

// Update Image Question record with given id.
router.put('/', async (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required(),
        category: Joi.number().integer().required(),
        subcategory: Joi.number().integer().required(),
        answer: Joi.string().valid('A', 'B', 'C', 'D').required(),
        a: Joi.string().required(),
        b: Joi.string().required(),
        c: Joi.string().required(),
        d: Joi.string().required(),
        image: Joi.string().base64() // Image is not a must.
    });

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    let sql = "";
    let data = [];

    if (req.body.image) {
        // Image is updated too. Make a full update.
        
        // First we need to delete the previous image
        // in order to get rid of unused mass.
        let sql2 = "SELECT * FROM quiz_questions_image WHERE id = ? LIMIT 1";
        pool.getConnection(function(err, conn){
            if (err) return res.json({error: true, message: err.message});
            conn.query(sql2, [req.body.id], (error, rows) => {
                conn.release();
                if (error) return res.json({error: true, message: error.message});

                if (rows[0]) {
                    // Delete the file. We need to strip the url
                    // in order to get the bucket file path.
                    // Let's strip down before /quiz_question_images/..
                    // https://storage.googleapis.com/anatomica-ec2cd.appspot.com/quiz_question_images/1/1/1631631802266.jpg
                    let image = rows[0]['image'];
                    let imageUrl = image.split('anatomica-ec2cd.appspot.com/')[1];

                    if (defaultBucket.file(imageUrl).exists()){
                        async function deleteFile() {
                            await defaultBucket.file(imageUrl).delete();
                        }

                        deleteFile().catch(err => {
                            res.json({error: true, message: err.message, fileUrl: imageUrl});
                        })
                    }
                    
                    // Image processing part.
                    const imageBuffer = Buffer.from(req.body.image, 'base64');
                    const byteArray = new Uint8Array(imageBuffer);
                    const fileURL = `quiz_question_images/${req.body.category}/${req.body.subcategory}/${new Date().getTime()}.jpg`;
                    const file = defaultBucket.file(fileURL);
                    
                    file.save(byteArray).then(async () => {
                        file.makePublic();
                    
                        const url = `https://storage.cloud.google.com/anatomica-ec2cd.appspot.com/${fileURL}`;
                    
                        data = [
                            url,
                            req.body.category,
                            req.body.subcategory,
                            req.body.answer,
                            req.body.a,
                            req.body.b,
                            req.body.c,
                            req.body.d,
                            req.body.id
                        ];

                        sql = "UPDATE quiz_questions_image SET image = ?, category = ?, subcategory = ?, answer = ?, a = ?, b = ?, c = ?, d = ? WHERE id = ?";

                        pool.getConnection(function(err, conn){
                            if (err) return res.json({error: true, message: err.message});
                            conn.query(sql, data, (error, rows) => {
                                conn.release();
                                if (error) return res.json({error: true, message: error.message});

                                if (rows['affectedRows'] === 0) {
                                    return res.json({error: true, message: 'The question with the given id can not be updated.'});
                                }else {
                                    return res.json({error: false, data: data});
                                }
                            });
                        });
                    });
                }else {
                    return res.json({error: true, message: 'The question with the given id was not found on the server.'});
                }
            });
        });
    }else {
        // Image is not present. Update other fields.
        data = [
            req.body.category,
            req.body.subcategory,
            req.body.answer,
            req.body.a,
            req.body.b,
            req.body.c,
            req.body.d,
            req.body.id
        ];
        sql = "UPDATE quiz_questions_image SET category = ?, subcategory = ?, answer = ?, a = ?, b = ?, c = ?, d = ? WHERE id = ?";

        pool.getConnection(function(err, conn){
            if (err) return res.json({error: true, message: err.message});
            conn.query(sql, data, (error, rows) => {
                conn.release();
                if (error) return res.json({error: true, message: error.message});

                if (rows['affectedRows'] === 0) return res.json({error: true, message: 'The question with the given id was not found on the server.'});
                else return res.json({error: false, data: data});
            });
        });
    }
});

// Delete Image Question record with given id.
router.delete('/', async (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    const sql = "DELETE FROM quiz_questions_image WHERE id = ?";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.id], (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});

            if (rows['affectedRows'] === 0) return res.json({error: true, message: 'The question with the given id was not found on the server.'});
            return res.json({error: false, id: req.body.id});
        });
    });
});

module.exports = router