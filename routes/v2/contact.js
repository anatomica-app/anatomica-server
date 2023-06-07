const express = require('express');

const contactController = require('../../controllers/contact');

const router = express.Router();

// Create a contact form.
router.post('/', contactController.postContactForm);

module.exports = router;
