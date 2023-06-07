const { DataTypes} = require('sequelize');

const sequelize = require('../utilities/database');

const ClassicQuestion = sequelize.define('ClassicQuestion', {
  classic_question_id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  lang: {
    type: DataTypes.INTEGER,
    allowNull: false,
    foreignKey: true
  },
  question: {
    type: DataTypes.STRING,
    allowNull: false
  },
  category: {
    type: DataTypes.INTEGER,
    allowNull: false,
    foreignKey: true
  },
  subcategory: {
    type: DataTypes.INTEGER,
    allowNull: false,
    foreignKey: true
  },
  topic: {
    type: DataTypes.INTEGER,
    allowNull: false,
    foreignKey: true
  },
  answer: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  a: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  b: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  c: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  d: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  data_added: {
    type: DataTypes.DATE,
    allowNull: false,
  }
});

module.exports = ClassicQuestion;