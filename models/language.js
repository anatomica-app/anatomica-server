const { DataTypes} = require('sequelize');

const sequelize = require('../utilities/database');

const Language = sequelize.define('Language', {
  language_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true
  },
  short_code: {
    type: DataTypes.STRING,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
});

module.exports = Language;