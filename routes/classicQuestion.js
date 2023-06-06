const express = require('express');

const questionController = require('../controllers/classicQuestion');
const checkAuth = require('../middlewares/check-auth');

const router = express.Router();

// Fetching all the Classic Questions
router.post('/', checkAuth, questionController.getAllClassicQuestions );

// Fetching the Classic Question From Id.
router.post('/withId', checkAuth, questionController.getAllClassicQuestionsFromId);

// Fetching the Classic Question From Category and Subcategories.
router.post('/withCategory', checkAuth, questionController.getAllClassicQuestionsFromCategoryAndSubcategories);

module.exports = router;
