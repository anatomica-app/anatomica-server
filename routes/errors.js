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
    QUESTION_NOT_FOUND: 13,
    QUESTION_CAN_NOT_BE_CREATED: 14,
    QUESTION_CAN_NOT_BE_CREATED: 15,
    FEEDBACK_NOT_FOUND: 16,
    FEEDBACK_CAN_NOT_BE_CREATED: 17,
    FEEDBACK_CAN_NOT_BE_UPDATED: 18,
    REPORT_CAN_NOT_BE_CREATED: 19,
    REPORT_CAN_NOT_BE_UPDATED: 20,
    REPORT_NOT_FOUND: 21,
    SUBCATEGORY_CAN_NOT_BE_CREATED: 22,
    SUBCATEGORY_CAN_NOT_BE_UPDATED: 23,
    SUBCATEGORY_NOT_FOUND: 24,
    PASSWORD_RESET_TOKEN_CANNOT_BE_CREATED: 25,
    INVALID_RESET_TOKEN: 26,
    PASSWORD_CANNOT_BE_CHANGED: 27,
    NEW_PASSWORD_CANNOT_BE_SAME_AS_OLD: 28,
    PERMISSION_DENIED: 29,
    INVALID_TOKEN: 30,
    QUESTION_CANNOT_BE_INSERTED_OR_UPDATED: 31
});