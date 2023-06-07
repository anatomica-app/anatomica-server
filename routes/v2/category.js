const express = require('express');

const categoryController = require('../../controllers/category');
const checkAuth = require('../../middlewares/check-auth');

const router = express.Router();

/**
 * @swagger
 * /v1/quiz/category:
 *  get:
 *    summary: Fetch all the categories
 *    description: Retrieves all the categories without localization.
 *    tags:
 *      - Category
 *    responses:
 *      200:
 *        description: Success response.
 *        content:
 *          application/json:
 *            schema:
 *              type: array
 *              items:
 *                type: object
 *                properties:
 *                  id:
 *                    type: number
 *                  name:
 *                    type: string
 *                  description:
 *                    type: string
 *                  icon:
 *                    type: string
 *                  isPaid:
 *                    type: boolean
 *                  isActive:
 *                    type: boolean
 *      500:
 *        description: An internal server error.
 */
router.get('/', checkAuth, categoryController.getAllCategories);

/**
 * @swagger
 * /v1/quiz/category:
 *  post:
 *    summary: Fetch all the categories with language.
 *    description: Retrieves all the categories in the database with the given localization data.
 *    tags:
 *      - Category
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              lang:
 *                type: number
 *                description: Language id
 *                example: 1
 *    responses:
 *      200:
 *        description: Success response.
 *        content:
 *          application/json:
 *            schema:
 *              type: array
 *              items:
 *                type: object
 *                properties:
 *                  id:
 *                    type: number
 *                  name:
 *                    type: string
 *                  description:
 *                    type: string
 *                  icon:
 *                    type: string
 *                  isPaid:
 *                    type: boolean
 *                  isActive:
 *                    type: boolean
 *                  subcategoryCount:
 *                    type: number
 *      500:
 *        description: An internal server error.
 */
router.post('/', checkAuth, categoryController.getAllCategoriesWithLanguage);

module.exports = router;