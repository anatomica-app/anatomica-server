const express = require('express');
const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const cors = require('cors');
const rateLimit = require('express-rate-limit');
process.env.NODE_ENV !== 'production' ? require('dotenv').config() : null;

const categoryRoutes = require('./routes/category');
const subcategoryRoutes = require('./routes/subcategory');
const topicRoutes = require('./routes/topic');
const classicQuestionRoutes = require('./routes/classicQuestion');
const imageQuestionRoutes = require('./routes/imageQuestion');
const questionsRoutes = require('./routes/questions');
const userRoutes = require('./routes/user');
const feedbackRoutes = require('./routes/feedbacks');
const reportRoutes = require('./routes/report');
const contactRoutes = require('./routes/contact');

const categoryRoutesV2 = require('./routes/v2/category');
const subcategoryRoutesV2 = require('./routes/v2/subcategory');
const topicRoutesV2 = require('./routes/v2/topic');
const classicQuestionRoutesV2 = require('./routes/v2/classicQuestion');
const imageQuestionRoutesV2 = require('./routes/v2/imageQuestion');
const questionsRoutesV2 = require('./routes/v2/questions');
const userRoutesV2 = require('./routes/v2/user');
const feedbackRoutesV2 = require('./routes/v2/feedbacks');
const reportRoutesV2 = require('./routes/v2/report');
const contactRoutesV2 = require('./routes/v2/contact');

const app = express();
const port = process.env.port || 8080;

// Rate Limiter Middleware for protecting against DDoS attacks.
app.set('trust proxy', 1);

const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: "Anatomica API",
      description: "Anatomica REST Api",
      version: '2.0.0',
      contact: {
        name: "Ahmet Özrahat",
      },
      servers: ["http://localhost:8080"]
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        }
      }
    },
    security: [{
      bearerAuth: []
    }],
  },
  apis: [
    "./routes/*.js",
  ]
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  handler: function (req, res, next) {
    return res.json({ error: true, message: 'Limit exceeded.' });
  },
});

app.use(limiter);

app.use(
  cors({
    origin: [
      'https://anatomicaquizapp.com',
      'https://api.anatomicaquizapp.com',
      'https://debug.api.anatomicaquizapp.com',
    ],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    preflightContinue: true,
  })
);

// Limit the payload for 10 MB.
app.use(express.json({ limit: 10000000 }));

// Serving static files under public directory.
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('Hello, world!');
});

// ***** Server Methods *****
const apiMethodsV1 = [
  {path: 'quiz/category', router: categoryRoutes},
  {path: 'quiz/subcategory', router: subcategoryRoutes},
  {path: 'quiz/topics', router: topicRoutes},
  {path: 'quiz/classics', router: classicQuestionRoutes},
  {path: 'quiz/image', router: imageQuestionRoutes},
  {path: 'quiz/questions', router: questionsRoutes},
  {path: 'users', router: userRoutes},
  {path: 'feedback', router: feedbackRoutes},
  {path: 'report', router: reportRoutes},
  {path: 'contact', router: contactRoutes},
]

const apiMethodsV2 = [
  {path: 'quiz/category', router: categoryRoutesV2},
  {path: 'quiz/subcategory', router: subcategoryRoutesV2},
  {path: 'quiz/topics', router: topicRoutesV2},
  {path: 'quiz/classics', router: classicQuestionRoutesV2},
  {path: 'quiz/image', router: imageQuestionRoutesV2},
  {path: 'quiz/questions', router: questionsRoutes},
  {path: 'users', router: userRoutesV2},
  {path: 'feedback', router: feedbackRoutesV2},
  {path: 'report', router: reportRoutesV2},
  {path: 'contact', router: contactRoutesV2},
]

app.listen(port, () => {
  // v1 routes.
  apiMethodsV1.forEach(method => {
    app.use(`/v1/${method.path}`, method.router)
  })

  // v2 routes.
  apiMethodsV2.forEach(method => {
    app.use(`/v2/${method.path}`, method.router)
  })

  console.log('App listening at port: ' + port);
});
