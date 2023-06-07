// let mysql = require('mysql');
//
// // ***** MySQL Connection *****
// const pool = mysql.createPool({
//   user: process.env.SQL_USER,
//   password: process.env.SQL_PASSWORD,
//   database: process.env.SQL_DATABASE,
//   host: process.env.INSTANCE_CONNECTION_NAME,
//   dateStrings: true,
// });
//
// module.exports = pool;


const { Sequelize } = require('sequelize');
const mysql = require('mysql');

const sequelize = new Sequelize(process.env.SQL_DATABASE, process.env.SQL_USER, process.env.SQL_PASSWORD, {
  host: process.env.INSTANCE_CONNECTION_NAME,
  dialect: 'mysql',
  dialectModule: mysql,
});

module.exports = sequelize;