const express = require('express');

const imageQuestionController = require('../controllers/imageQuestion');
const checkAuth = require('../middlewares/check-auth');

const router = express.Router();

// Fetching all the Image Questions
router.post('/', checkAuth, imageQuestionController.getAllImageQuestions);

// Fetching the Image Question From Id.
router.post('/withId', checkAuth, imageQuestionController.getAllImageQuestionsFromId);

// Fetching the Image Question From Category and Subcategories.
router.post('/withCategory', checkAuth, imageQuestionController.getAllImageQuestionsFromCategoryAndSubcategories);

module.exports = router;
