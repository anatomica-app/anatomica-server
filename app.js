const express = require('express');
const cors = require('cors');
const rateLimit = require("express-rate-limit");

const app = express();
const port = process.env.port || 8080;

// Rate Limiter Middleware for protecting against DDoS attacks.
app.set('trust proxy', 1);

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 requests per windowMs
    handler: function (req, res, next) {
        return res.json({error: true, message: 'Limit exceeded.'})
    }
});

app.use(limiter);

app.use(cors({
    origin: 'https://anatomica-app.com',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    preflightContinue: true,
}));

const categoriesRoute = require('./routes/categories');
const subcategoriesRoute = require('./routes/subcategories');
const classicQuestionsroute = require('./routes/classicQuestions');
const imageQuestionsroute = require('./routes/imageQuestions');
const usersRoute = require('./routes/users');
const feedbacksRoute = require('./routes/feedbacks');
const reportsRoute = require('./routes/reports');
const adminPanelRoute = require('./routes/adminPanel');

// Limit the payload for 10 MB.
app.use(express.json({limit: 10000000}));

// ***** Server Methods *****

app.use('/v1/quiz/category', categoriesRoute);
app.use('/v1/quiz/subcategory', subcategoriesRoute);
app.use('/v1/quiz/classic', classicQuestionsroute);
app.use('/v1/quiz/image', imageQuestionsroute);
app.use('/v1/users', usersRoute);
app.use('/v1/feedback', feedbacksRoute);
app.use('/v1/report', reportsRoute);
app.use('/v1/admin-panel', adminPanelRoute);

app.listen(port, () => {
    console.log('App listening at port: ' + port);
});

app.get('/', (req, res) => {
    res.send('Hello, world!');
});