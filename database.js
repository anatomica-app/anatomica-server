let mysql = require('mysql');

// ***** MySQL Connection *****
const pool = mysql.createPool({
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DATABASE,
    host: 'anatomica-db.cgds1zbfinvm.us-east-1.rds.amazonaws.com',
    dateStrings: true
});

module.exports = pool;