const { body, validationResult } = require("express-validator");

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const validateRegister = [
  body("username")
    .trim()
    .notEmpty().withMessage("Username is required.")
    .isLength({ min: 3, max: 50 }).withMessage("Username must be between 3 and 50 characters."),
  body("email")
    .trim()
    .isEmail().withMessage("Must be a valid email address.")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters long."),
  handleValidationErrors
];

const validateLogin = [
  body("email")
    .trim()
    .isEmail().withMessage("Must be a valid email address.")
    .normalizeEmail(),
  body("password")
    .notEmpty().withMessage("Password is required."),
  handleValidationErrors
];

const validateForgotPassword = [
  body("email")
    .trim()
    .isEmail().withMessage("Must be a valid email address.")
    .normalizeEmail(),
  handleValidationErrors
];

const validateVerifyOtp = [
  body("email")
    .trim()
    .isEmail().withMessage("Must be a valid email address.")
    .normalizeEmail(),
  body("otp")
    .trim()
    .notEmpty().withMessage("OTP is required.")
    .isLength({ min: 6, max: 6 }).withMessage("OTP must be exactly 6 digits.")
    .isNumeric().withMessage("OTP must be numeric."),
  handleValidationErrors
];

const validateResendOtp = [
  body("email")
    .trim()
    .isEmail().withMessage("Must be a valid email address.")
    .normalizeEmail(),
  handleValidationErrors
];

const validateResetPassword = [
  body("resetToken")
    .notEmpty().withMessage("Reset token is required."),
  body("newPassword")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters long."),
  handleValidationErrors
];

const validateChangePassword = [
  body("currentPassword")
    .notEmpty().withMessage("Current password is required."),
  body("newPassword")
    .isLength({ min: 8 }).withMessage("New password must be at least 8 characters long."),
  handleValidationErrors
];

const validateProfile = [
  body("bio")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 255 }).withMessage("Bio cannot exceed 255 characters."),
  handleValidationErrors
];

const validateBlockUser = [
  body("contactId")
    .notEmpty().withMessage("Contact ID is required.")
    .isInt().withMessage("Contact ID must be an integer."),
  handleValidationErrors
];

const validateUnblockUser = [
  body("contactId")
    .notEmpty().withMessage("Contact ID is required.")
    .isInt().withMessage("Contact ID must be an integer."),
  handleValidationErrors
];

const validateSendMessage = [
  body("receiver_id")
    .notEmpty().withMessage("Receiver ID is required.")
    .isInt().withMessage("Receiver ID must be an integer."),
  body("message")
    .trim()
    .notEmpty().withMessage("Message content is required."),
  handleValidationErrors
];

module.exports = {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateVerifyOtp,
  validateResendOtp,
  validateResetPassword,
  validateChangePassword,
  validateProfile,
  validateBlockUser,
  validateUnblockUser,
  validateSendMessage
};
