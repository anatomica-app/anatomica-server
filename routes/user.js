const express = require('express');

const userController = require('../controllers/user');

const router = express.Router();

// const Joi = require('joi');
// const crypto = require('crypto');
// const bcrypt = require('bcrypt');
// const nodemailer = require('nodemailer');
// const smtp = require('nodemailer-smtp-transport');
// const { Storage } = require('@google-cloud/storage');
// const { OAuth2Client } = require('google-auth-library');
// const fs = require('fs');
// const path = require('path');
// const jwt = require('jsonwebtoken');
// const pool = require('../utilities/database');
// const constants = require('./constants');
// const errorCodes = require('./errors');
// const responseMessages = require('./responseMessages');
//
// // ***** Google Cloud Storage *****
// const storage = new Storage();
// const defaultBucket = storage.bucket('anatomica-storage');
//
// const apiPrefix = `https://api.${process.env.DOMAIN}/`;
// const apiVersion = 'v1';
//
// // ***** Google OAuth2 Client *****
// const client = new OAuth2Client(process.env.GOOGLE_OAUTH2_CLIENT_ID);

/**
 * @swagger
 * /v1/users/login:
 *  post:
 *    summary: Login with credentials
 *    description: Logs the user in with email and password and generates a JWT token.
 *    tags:
 *      - User
 *    responses:
 *      '200':
 *        description: Success response.
 *      '400':
 *        description: User registered with another provider.
 *      '404':
 *        description: The user can not be found..
 *      '500':
 *        description: An internal server error.
 */
router.post('/login', userController.postLogin);

// Login user with Google.
router.post('/google', userController.postLoginWithGoogle);

// Login user with Apple.
router.post('/apple', userController.postLoginWithApple);

// Create a user with default configuration.
router.post('/', userController.postUser);

// Change user name.
router.put('/changeUserName/', userController.putChangeUsername);

// Change profile picture.
router.put('/changeProfilePicture', userController.putChangeProfilePicture);

// Send verify email again.
router.post('/sendVerificationEmail', userController.postSendVerificationMail);

// Verify mail address.
router.get('/verify/:id/:hash', userController.getVerifyMail);

// Send password reset request.
router.post('/password/resetMail/', userController.postResetMail);

// Reset password page.
router.get('/password/reset/:id/:token', userController.getResetPage);

// Reset password.
router.put('/password/update', userController.putResetPassword);

// Delete account.
router.delete('/', userController.deleteUser);

module.exports = router;
