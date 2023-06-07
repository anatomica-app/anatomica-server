const { DataTypes} = require('sequelize');

const sequelize = require('../utilities/database');

const PicturedQuestion = sequelize.define('PicturedQuestion', {
  pictured_question_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true
  },
  lang: {
    type: DataTypes.INTEGER,
    allowNull: false,
    foreignKey: true
  },
  image_url: {
    type: DataTypes.STRING,
    allowNull: false
  },
  is_animated: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
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
  date_added: {
    type: DataTypes.DATE,
    allowNull: false,
  }
});

module.exports = PicturedQuestion;