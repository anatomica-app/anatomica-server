require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const port = process.env.port || 8080;
const apiVersion = 'v1';

// Rate Limiter Middleware for protecting against DDoS attacks.
app.set('trust proxy', 1);

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // limit each IP to 1 requests per windowMs
  handler: function(req, res, next) {
    return res.status(429).json({ error: true, message: 'Too many requests, slow down.' });
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
  }),
);

const categoriesRoute = require('./routes/categories');
const subcategoriesRoute = require('./routes/subcategories');
const topicsRoute = require('./routes/topics');
const classicQuestionsroute = require('./routes/classicQuestions');
const imageQuestionsroute = require('./routes/imageQuestions');
const usersRoute = require('./routes/users');
const feedbacksRoute = require('./routes/feedbacks');
const reportsRoute = require('./routes/reports');
const contactRoute = require('./routes/contact');

// Limit the payload for 10 MB.
app.use(express.json({ limit: 10000000 }));

// Serving static files under public directory.
app.use(express.static('public'));

// ***** Server Methods *****

app.use('/' + apiVersion + '/quiz/category', categoriesRoute);
app.use('/' + apiVersion + '/quiz/subcategory', subcategoriesRoute);
app.use('/' + apiVersion + '/quiz/topics', topicsRoute);
app.use('/' + apiVersion + '/quiz/classic', classicQuestionsroute);
app.use('/' + apiVersion + '/quiz/image', imageQuestionsroute);
app.use('/' + apiVersion + '/users', usersRoute);
app.use('/' + apiVersion + '/feedback', feedbacksRoute);
app.use('/' + apiVersion + '/report', reportsRoute);
app.use('/' + apiVersion + '/contact', contactRoute);

app.listen(port, () => {
  console.log('App listening at port: ' + port);
});

app.get('/health', (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
  };
  try {
    res.send(healthcheck);
  } catch (error) {
    healthcheck.message = error;
    res.status(503).send();
  }
});
