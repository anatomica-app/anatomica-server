const { DataTypes} = require('sequelize');

const sequelize = require('../utilities/database');

const User = sequelize.define('User', {
  user_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true
  },
  first_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  last_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  reset_token: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  data_joined: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  profile_photo: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  hash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  account_provider: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  google_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  apple_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true,
  }
});

module.exports = User;