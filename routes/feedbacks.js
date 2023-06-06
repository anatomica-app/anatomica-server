const express = require('express');

const feedbackController = require('../controllers/feedback');
const checkAuth = require('../middlewares/check-auth');

const router = express.Router();

// Fetching all the feedbacks.
router.get('/', checkAuth, feedbackController.getAllFeedbacks);

// Create a new feedback.
router.post('/', checkAuth, feedbackController.postFeedback);

module.exports = router;
