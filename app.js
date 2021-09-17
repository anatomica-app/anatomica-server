const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.port || 8080;

const categoriesRoute = require('./routes/categories');
const subcategoriesRoute = require('./routes/subcategories');
const classicQuestionsroute = require('./routes/classicQuestions');
const imageQuestionsroute = require('./routes/imageQuestions');
const usersRoute = require('./routes/users');
const feedbacksRoute = require('./routes/feedbacks');
const reportsRoute = require('./routes/reports');

// Limit the payload for 10 MB.
app.use(express.json({limit: 10000000}));

// Enabling cross domain requests.
app.use(cors());

// ***** Server Methods *****

app.use('/v1/quiz/category', categoriesRoute);
app.use('/v1/quiz/subcategory', subcategoriesRoute);
app.use('/v1/quiz/classic', classicQuestionsroute);
app.use('/v1/quiz/image', imageQuestionsroute);
app.use('/v1/users', usersRoute);
app.use('/v1/feedback', feedbacksRoute);
app.use('/v1/report', reportsRoute);

app.listen(port, () => {
    console.log('App listening at port: ' + port);
});

app.get('/', (req, res) => {
    res.send('Hello, world!');
});