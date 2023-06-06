const express = require('express');

const topicController = require('../controllers/topic');
const checkAuth = require('../middlewares/check-auth');

const router = express.Router();

// Fetching all the topics.
router.post('/', checkAuth, topicController.getAllTopics);

// Fetching all the topics with the given subcategory.
router.post('/withCategory', checkAuth, topicController.getAllTopicsWithGivenSubcategory);

module.exports = router;
