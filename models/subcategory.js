const { DataTypes} = require('sequelize');

const sequelize = require('../utilities/database');

const Subcategory = sequelize.define('Subcategory', {
  subcategory_id: {
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
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  is_pictured: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  is_classic: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  data_added: {
    type: DataTypes.DATE,
    allowNull: false,
  }
});

module.exports = Subcategory;