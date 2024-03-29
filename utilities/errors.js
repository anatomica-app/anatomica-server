/*

This file holds the error codes for the API.

*/

module.exports = Object.freeze({
  USER_NOT_FOUND: 0,
  WRONG_EMAIL_OR_PASSWORD: 1,
  USER_REGISTERED_WITH_ANOTHER_PROVIDER: 2,
  USER_CAN_NOT_BE_CREATED: 3,
  USER_ALREADY_EXISTS: 4,
  PROFILE_PICTURE_CAN_NOT_BE_CHANGED: 5,
  ACCOUNT_ALREADY_ACTIVATED: 6,
  NO_NEED_TO_VERIFY: 7,
  USER_CAN_NOT_BE_VERIFIED: 8,
  NAME_CAN_NOT_BE_CHANGED_DUE_TO_LIMIT: 9,
  CATEGORY_CAN_NOT_BE_CREATED: 10,
  CATEGORY_CAN_NOT_BE_UPDATED: 11,
  CATEGORY_NOT_FOUND: 12,
  CATEGORY_ACCESS_DENIED: 13,
  NO_USER_OR_CATEGORY_DEFINED: 14,
  QUESTION_NOT_FOUND: 15,
  QUESTION_CAN_NOT_BE_CREATED: 16,
  QUESTION_CAN_NOT_BE_CREATED: 17,
  FEEDBACK_NOT_FOUND: 18,
  FEEDBACK_CAN_NOT_BE_CREATED: 19,
  FEEDBACK_CAN_NOT_BE_UPDATED: 20,
  REPORT_CAN_NOT_BE_CREATED: 21,
  REPORT_CAN_NOT_BE_UPDATED: 22,
  REPORT_NOT_FOUND: 23,
  SUBCATEGORY_CAN_NOT_BE_CREATED: 24,
  SUBCATEGORY_CAN_NOT_BE_UPDATED: 25,
  SUBCATEGORY_NOT_FOUND: 26,
  PASSWORD_RESET_TOKEN_CANNOT_BE_CREATED: 27,
  INVALID_RESET_TOKEN: 28,
  PASSWORD_CANNOT_BE_CHANGED: 29,
  NEW_PASSWORD_CANNOT_BE_SAME_AS_OLD: 30,
  PERMISSION_DENIED: 31,
  INVALID_TOKEN: 32,
  QUESTION_CANNOT_BE_INSERTED_OR_UPDATED: 33,
  QUESTION_CAN_NOT_BE_UPDATED: 34,
  TOPIC_CAN_NOT_BE_CREATED: 35,
  TOPIC_CAN_NOT_BE_UPDATED: 36,
  TOPIC_NOT_FOUND: 37,
  DB_ERROR: 38,
  ADMIN_CANNOT_BE_CREATED: 39,
});
