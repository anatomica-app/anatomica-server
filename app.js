const express = require('express');
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
const routes = [
  { path: 'quiz/category', router: categoryRoutes },
  { path: 'quiz/subcategory', router: subcategoryRoutes },
  { path: 'quiz/topics', router: topicRoutes },
  { path: 'quiz/classic', router: classicQuestionRoutes },
  { path: 'quiz/image', router: imageQuestionRoutes },
  { path: 'users', router: userRoutes },
  { path: 'feedback', router: feedbackRoutes },
  { path: 'report', router: reportRoutes },
  { path: 'contact', router: contactRoutes },
];

routes.forEach((route) => {
  app.use(`/${apiVersion}/${route.path}`, route.router);
});


app.listen(port, () => {
  console.log('App listening at port: ' + port);
});
