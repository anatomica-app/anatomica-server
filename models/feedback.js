const { DataTypes} = require('sequelize');

const sequelize = require('../utilities/database');

const Feedback = sequelize.define('Feedback', {
  feedback_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    foreignKey: true
  },
  message: {
    type: DataTypes.STRING,
    allowNull: false
  },
  app_version: {
    type: DataTypes.STRING,
    allowNull: false
  },
  os_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  date_added: {
    type: DataTypes.DATE,
    allowNull: false,
  }
});

module.exports = Feedback;