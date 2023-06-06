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
const userRoutes = require('./routes/user');
const feedbackRoutes = require('./routes/feedbacks');
const reportRoutes = require('./routes/report');
const contactRoutes = require('./routes/contact');

const app = express();
const port = process.env.port || 8080;
const apiVersion = 'v1';

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
app.use('/' + apiVersion + '/quiz/category', categoryRoutes);
app.use('/' + apiVersion + '/quiz/subcategory', subcategoryRoutes);
app.use('/' + apiVersion + '/quiz/topics', topicRoutes);
app.use('/' + apiVersion + '/quiz/classic', classicQuestionRoutes);
app.use('/' + apiVersion + '/quiz/image', imageQuestionRoutes);
app.use('/' + apiVersion + '/users', userRoutes);
app.use('/' + apiVersion + '/feedback', feedbackRoutes);
app.use('/' + apiVersion + '/report', reportRoutes);
app.use('/' + apiVersion + '/contact', contactRoutes);

app.listen(port, () => {
  console.log('App listening at port: ' + port);
});
