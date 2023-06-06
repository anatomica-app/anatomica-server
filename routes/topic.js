const express = require('express');
const router = express.Router();

const Joi = require('joi');

const checkAuth = require('../middlewares/check-auth');

const pool = require('../utilities/database');
const responseMessages = require('./responseMessages');

const topicController = require('../controllers/topic');

// Fetching all the topics.
router.post('/', checkAuth, topicController.getAllTopics);

// Fetching all the topics with the given subcategory.
router.post('/withCategory', checkAuth, topicController.getAllTopicsWithGivenSubcategory);

module.exports = router;
