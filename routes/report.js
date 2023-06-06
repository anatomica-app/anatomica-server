const express = require('express');

const reportController = require('../controllers/report');
const checkAuth = require('../middlewares/check-auth');

const router = express.Router();

// Create a new report.
router.post('/', checkAuth, reportController.postReport);

module.exports = router;
