const { DataTypes} = require('sequelize');

const sequelize = require('../utilities/database');

const Report = sequelize.define('Report', {
  report_id: {
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
  classic_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    foreignKey: true
  },
  pictured_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    foreignKey: true
  },
  message: {
    type: DataTypes.STRING,
    allowNull: false
  },
  date_added: {
    type: DataTypes.DATE,
    allowNull: false,
  }
});

module.exports = Report;