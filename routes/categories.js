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

// Fetching all the categories.
router.get('/', (req, res) => {
    const sql = "SELECT * FROM quiz_category";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});;

            res.json({error: false, data: rows});
        });
    });
});

// Create a new category.
router.post('/create', (req, res) => {
    const schema = Joi.object({
        name: Joi.string().required(),
        icon: Joi.string().base64().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    // Image processing part.
    const imageBuffer = Buffer.from(req.body.icon, 'base64');
    const byteArray = new Uint8Array(imageBuffer);
    const fileURL = `quiz_category_icons/${new Date().getTime()}.png`;
    const file = defaultBucket.file(fileURL);

    return file.save(byteArray).then(async () => {
        file.makePublic();
        const url = `https://storage.cloud.google.com/anatomica-ec2cd.appspot.com/${fileURL}`;
    
        const sql = "INSERT INTO quiz_category (name, icon) VALUES (?,?)";
    
        pool.getConnection(function(err, conn){
            if (err) return res.json({error: true, message: err.message});
            conn.query(sql, [req.body.name, url], (error, rows) => {
                conn.release();
                if (error) return res.json({error: true, message: error.message});;
    
                return res.json({error: false, data: rows['insertId']});
            });
        });
    });
});

// Update a category.
router.put('/', (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required(),
        name: Joi.string().required(),
        icon: Joi.string().base64(), // icon is not a must.
        sku: Joi.string().allow(null)
    });

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    let sql = "";
    let data = [];

    if (req.body.icon) {
        // icon is updated too. Make a full update.
        
        // First we need to delete the previous icon
        // in order to get rid of unused mass.
        let sql2 = "SELECT * FROM quiz_category WHERE id = ? LIMIT 1";
        pool.getConnection(function(err, conn){
            if (err) return res.json({error: true, message: err.message});
            conn.query(sql2, [req.body.id], (error, rows) => {
                conn.release();
                if (error) return res.json({error: true, message: error.message});

                if (rows[0]) {
                    // Delete the file. We need to strip the url
                    // in order to get the bucket file path.
                    // Let's strip down before /quiz_category_icons/..
                    // https://storage.googleapis.com/anatomica-ec2cd.appspot.com/quiz_category_icons/1631631802266.jpg
                    let icon = rows[0]['icon'];
                    let iconUrl = icon.split('anatomica-ec2cd.appspot.com/')[1];

                    if (defaultBucket.file(iconUrl).exists()){
                        async function deleteFile() {
                            await defaultBucket.file(iconUrl).delete();
                        }

                        deleteFile().catch(err => {
                            res.json({error: true, message: err.message, fileUrl: iconUrl});
                        })
                    }
                    
                    // Image processing part.
                    const imageBuffer = Buffer.from(req.body.icon, 'base64');
                    const byteArray = new Uint8Array(imageBuffer);
                    const fileURL = `quiz_category_icons/${new Date().getTime()}.jpg`;
                    const file = defaultBucket.file(fileURL);
                    
                    file.save(byteArray).then(async () => {
                        file.makePublic();
                    
                        const url = `https://storage.cloud.google.com/anatomica-ec2cd.appspot.com/${fileURL}`;
                    
                        data = [
                            req.body.name,
                            url,
                            req.body.sku,
                            req.body.id
                        ];

                        sql = "UPDATE quiz_category SET name = ?, icon = ?, sku = ? WHERE id = ?";

                        pool.getConnection(function(err, conn){
                            if (err) return res.json({error: true, message: err.message});
                            conn.query(sql, data, (error, rows) => {
                                conn.release();
                                if (error) return res.json({error: true, message: error.message});

                                if (rows['affectedRows'] === 0) {
                                    return res.json({error: true, message: 'The category with the given id can not be updated.'});
                                }else {
                                    return res.json({error: false, data: data});
                                }
                            });
                        });
                    });
                }else {
                    return res.json({error: true, message: 'The category with the given id was not found on the server.'});
                }
            });
        });
    }else {
        // icon is not present. Update other fields.
        data = [
            req.body.name,
            req.body.sku,
            req.body.id
        ];
        sql = "UPDATE quiz_category SET name = ?, sku = ? WHERE id = ?";
        
        pool.getConnection(function(err, conn){
            if (err) return res.json({error: true, message: err.message});
            conn.query(sql, data, (error, rows) => {
                conn.release();
                if (error) return res.json({error: true, message: error.message});

                if (rows['affectedRows'] === 0) return res.json({error: true, message: 'The category with the given id was not found on the server.'});
                else return res.json({error: false, data: data});
            });
        });
    }
});

// Delete a category.
router.delete('/', async (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    const sql = "DELETE FROM quiz_category WHERE id = ?";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [req.body.id], (error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});

            if (rows['affectedRows'] === 0) return res.json({error: true, message: 'The category with the given id was not fount on the server.'});
            else return res.json({error: false, id: req.body.id});
        });
    });
});

module.exports = router