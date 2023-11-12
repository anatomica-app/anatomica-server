const winston = require('winston');
const userInfo = require('./authenticatedUserService');
// Imports the Google Cloud client library for Winston
const { LoggingWinston } = require('@google-cloud/logging-winston');

const loggingWinston = new LoggingWinston();

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
  ],
});

const logDatabaseError = (req, error) => {
  logger.error("DATABASE ERROR: ", {
    request: userInfo(req),
    error: error
  });
}

const logValidationError = (req, error) => {
  logger.warning("Validation Error: ", {
    request: userInfo(req),
    error: error.details[0].message
  });
}

module.exports = { logger, logDatabaseError, logValidationError };