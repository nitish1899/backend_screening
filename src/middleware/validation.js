import { validationResult, body, param, query } from 'express-validator';
import { logger } from '../config/logger.js';

// Middleware to handle validation errors
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));

    logger.warn('Validation errors:', formattedErrors);
    
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: formattedErrors
    });
  }
  
  next();
};

// Common validation rules
export const validateEmail = body('email')
  .isEmail()
  .normalizeEmail()
  .withMessage('Please provide a valid email address');

export const validatePassword = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters long')
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');

export const validateName = body('name')
  .trim()
  .isLength({ min: 2, max: 50 })
  .withMessage('Name must be between 2 and 50 characters')
  .matches(/^[a-zA-Z\s]+$/)
  .withMessage('Name can only contain letters and spaces');

export const validateObjectId = (field) => {
  return param(field)
    .isMongoId()
    .withMessage(`${field} must be a valid ID`);
};

export const validateDocumentTitle = body('title')
  .trim()
  .isLength({ min: 1, max: 200 })
  .withMessage('Document title must be between 1 and 200 characters');

export const validateDocumentContent = body('content')
  .optional()
  .isLength({ max: 1048576 })
  .withMessage('Document content cannot exceed 1MB');

export const validateRole = body('role')
  .isIn(['admin', 'editor', 'viewer'])
  .withMessage('Role must be admin, editor, or viewer');

export const validatePermission = body('permission')
  .isIn(['viewer', 'editor', 'admin'])
  .withMessage('Permission must be viewer, editor, or admin');

export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sort')
    .optional()
    .isIn(['createdAt', '-createdAt', 'updatedAt', '-updatedAt', 'title', '-title'])
    .withMessage('Invalid sort parameter')
];

// Validation sets for different endpoints
export const validateUserRegistration = [
  validateName,
  validateEmail,
  validatePassword,
  body('organizationDomain')
    .trim()
    .isLength({ min: 3 })
    .withMessage('Organization domain is required')
    .matches(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/)
    .withMessage('Please provide a valid domain'),
  validateRole.optional(),
  handleValidationErrors
];

export const validateUserLogin = [
  validateEmail,
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

export const validateDocumentCreation = [
  validateDocumentTitle,
  validateDocumentContent,
  body('contentType')
    .optional()
    .isIn(['text', 'markdown', 'html', 'json'])
    .withMessage('Content type must be text, markdown, html, or json'),
  body('visibility')
    .optional()
    .isIn(['private', 'organization', 'public'])
    .withMessage('Visibility must be private, organization, or public'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),
  handleValidationErrors
];

export const validateDocumentUpdate = [
  validateObjectId('id'),
  validateDocumentTitle.optional(),
  validateDocumentContent,
  body('contentType')
    .optional()
    .isIn(['text', 'markdown', 'html', 'json'])
    .withMessage('Content type must be text, markdown, html, or json'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Status must be draft, published, or archived'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  handleValidationErrors
];

export const validateDocumentShare = [
  validateObjectId('id'),
  body('userId')
    .isMongoId()
    .withMessage('User ID must be valid'),
  validatePermission,
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Expiration date must be a valid ISO 8601 date'),
  handleValidationErrors
];

export const validateCommentCreation = [
  validateObjectId('documentId'),
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Comment content must be between 1 and 2000 characters'),
  body('type')
    .optional()
    .isIn(['general', 'suggestion', 'question', 'issue', 'approval'])
    .withMessage('Comment type must be general, suggestion, question, issue, or approval'),
  body('position.start')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Position start must be a non-negative integer'),
  body('position.end')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Position end must be a non-negative integer'),
  handleValidationErrors
];

export const validateOrganizationCreation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Organization name must be between 2 and 100 characters'),
  body('domain')
    .trim()
    .matches(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/)
    .withMessage('Please provide a valid domain'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  handleValidationErrors
];

export const validateFolderCreation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Folder name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('parent')
    .optional()
    .isMongoId()
    .withMessage('Parent folder ID must be valid'),
  body('color')
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage('Color must be a valid hex color'),
  handleValidationErrors
];

// Sanitization middleware
export const sanitizeInput = (req, res, next) => {
  // Remove any potential XSS attempts from string fields
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  };

  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = sanitizeString(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);

  next();
};
