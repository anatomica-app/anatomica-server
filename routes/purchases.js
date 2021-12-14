const express = require('express');
const router = express.Router();
const https = require('https');

const jwt = require('jsonwebtoken');
const Joi = require('joi');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const checkAuth = require('../middleware/check-auth');
const checkPrivilege = require('../middleware/check-privilege');

const pool = require('../database');
const constants = require('./constants');
const errorCodes = require('./errors');

const verifyReceiptURL = 'sandbox.itunes.apple.com'; // POST

router.post('/verify/apple', checkAuth, async (req, res) => {
    const schema = Joi.object({
        user: Joi.number().integer().required(),
        receipt: Joi.string().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    // Create JWT for Apple verification.
    const appleJWT = createJWTForAppleVerification();
    
    // Send a request to Apple to verify the receipt.
    const data = new TextEncoder().encode(JSON.stringify({
        'receipt-data': req.body.receipt,
        'password': process.env.APPLE_SHARED_SECRET,
    }));

    const options = {
        hostname: verifyReceiptURL,
        port: 443,
        path: '/verifyReceipt',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length,
        }
    };

    const appleReq = https.request(options, (appleRes) => {
        let response = '';
        appleRes.on('data', (chunk) => {
            response += chunk;
        });

        appleRes.on('end', () => {
            const responsePayload = JSON.parse(response);
            if (responsePayload.status !== 0) return res.json({error: true, message: 'Apple verification failed.'});
            
            // Insert the purchase.
            const user = req.body.user;
            const sku = responsePayload.receipt.in_app[0].product_id;
            const transaction_id = responsePayload.receipt.in_app[0].transaction_id;
            const original_transaction_id = responsePayload.receipt.in_app[0].original_transaction_id;
            const purchase_time = responsePayload.receipt.in_app[0].purchase_date_ms / 1000;

            const sql = "SELECT * FROM user_purchases WHERE original_transaction_id = ?";

            pool.getConnection(function(err, conn){
                if (err) return false;
                conn.query(sql,[original_transaction_id],(error, rows) => {
                    conn.release();
                    if (error) return false;
        
                    if (!rows[0]) {
                        insertPurchaseForiOS(user, sku, transaction_id, original_transaction_id, purchase_time, res);
                    }else {
                        return res.json({
                            error: true,
                            message: 'Purchase token is invalid.'
                        });
                    }
                });
            });
        });
    }).on('error', (error) => {
        return res.json({error: true, message: error.message});
    });

    appleReq.write(data);
    appleReq.end();
});

router.post('/verify/google', checkAuth, async (req, res) => {
    const schema = Joi.object({
        purchaseToken: Joi.string().required(),
        purchaseTime: Joi.number().integer().required(),
        orderId: Joi.string().required(),
        productSku: Joi.string().required()
    });

    const result = schema.validate(req.body);
    if (result.error) return res.json({error: true, message: result.error.details[0].message});

    // Now we should verify the purchase with the Google Play Developer API.
});

function insertPurchaseForAndroid(user, sku, purchase_token, purchase_time, order_id, res) {
    const sql = "INSERT INTO user_purchases (user, sku, purchase_token, purchase_time, order_id) VALUES (?,?,?,?,?)";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [user, sku, purchase_token, purchase_time, order_id],(error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});
            
            if (rows.affectedRows === 1) {
                return res.json({error: false, data: {
                    user: user,
                    sku: sku,
                    purchase_token: purchase_token,
                    purchase_time: purchase_time,
                    order_id: order_id
                }});
            }else {
                return res.json({error: true, message: 'Purchase token is invalid.'});
            }
        });
    });
}

function insertPurchaseForiOS(user, sku, transaction_id, original_transaction_id, purchase_time, res) {
    const sql = "INSERT INTO user_purchases (user, sku, transaction_id, original_transaction_id, purchase_time) VALUES (?,?,?,?,?)";

    pool.getConnection(function(err, conn){
        if (err) return res.json({error: true, message: err.message});
        conn.query(sql, [user, sku, transaction_id, original_transaction_id, purchase_time],(error, rows) => {
            conn.release();
            if (error) return res.json({error: true, message: error.message});
            
            if (rows.affectedRows === 1) {
                return res.json({error: false, data: {
                    user: user,
                    sku: sku,
                    transaction_id: transaction_id,
                    original_transaction_id: original_transaction_id,
                    purchase_time: purchase_time
                }});
            }else {
                return res.json({error: true, message: 'Purchase token is invalid.'});
            }
        });
    });
}

// JWT Creation Functions

function createJWTForAppleVerification() {
    // header
    const header = {
        'kid': process.env.APPLE_JWT_HEADER_KEY,
        'alg': 'ES256',
        'typ': 'JWT'
    };

    // payload
    const payload = {
        'iss': process.env.APPLE_JWT_ISSUER_ID, // issuer id
        'iat': Math.floor(Date.now() / 1000), // issue time, seconds since epoch
        'exp': Math.floor(Date.now() / 1000) + 60 * 60, // expiration time, seconds since epoch
        'aud': 'appstoreconnect-v1', // audience
        'nonce': uuidv4(), // nonce
        'bid': process.env.APPLE_JWT_BUNDLE_ID // bundle id
    };

    const signOptions = {
        algorithm: 'ES256',
        header: header
    };

    // Signing process.
    
    const privateKeyPath = path.join(__dirname, "../SubscriptionKey_4M4TQD83BT.p8");
    const privateKey = fs.readFileSync(privateKeyPath);

    let signature = jwt.sign(payload, privateKey, signOptions);

    return signature;
}

module.exports = router;