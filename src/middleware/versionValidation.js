import { body, query, param } from 'express-validator';

// Validation for version number parameter
export const validateVersionNumber = [
  param('versionNumber')
    .isInt({ min: 1 })
    .withMessage('Version number must be a positive integer')
    .toInt()
];

// Validation for version restore
export const validateVersionRestore = [
  ...validateVersionNumber,
  body('changeDescription')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Change description cannot exceed 500 characters')
];

// Validation for version comparison
export const validateVersionComparison = [
  query('version1')
    .isInt({ min: 1 })
    .withMessage('Version 1 must be a positive integer')
    .toInt(),
  query('version2')
    .isInt({ min: 1 })
    .withMessage('Version 2 must be a positive integer')
    .toInt()
];

// Validation for activity queries
export const validateActivityQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  query('action')
    .optional()
    .isString()
    .trim()
    .isIn([
      'document_created', 'document_updated', 'document_viewed', 'document_shared',
      'document_unshared', 'document_deleted', 'document_restored', 'document_archived',
      'document_published', 'document_duplicated', 'document_exported',
      'version_created', 'version_restored', 'version_viewed', 'version_compared',
      'activity_viewed', 'organization_activity_viewed',
      'user_invited', 'user_removed', 'user_role_changed',
      'organization_created', 'organization_updated',
      'login', 'logout', 'password_changed', 'profile_updated'
    ])
    .withMessage('Invalid action type'),
  query('category')
    .optional()
    .isString()
    .trim()
    .isIn(['document', 'user', 'organization', 'security', 'system'])
    .withMessage('Invalid category'),
  query('severity')
    .optional()
    .isString()
    .trim()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid severity level'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date')
    .toDate(),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .toDate(),
  query('userId')
    .optional()
    .isMongoId()
    .withMessage('User ID must be a valid MongoDB ObjectId')
];

// Custom validation to ensure end date is after start date
export const validateDateRange = (req, res, next) => {
  const { startDate, endDate } = req.query;
  
  if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
    return res.status(400).json({
      success: false,
      message: 'End date must be after start date',
      code: 'INVALID_DATE_RANGE'
    });
  }
  
  next();
};

// Validation for document update with version tracking
export const validateDocumentUpdateWithVersioning = [
  body('title')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('content')
    .optional()
    .isString()
    .isLength({ max: 1048576 }) // 1MB limit
    .withMessage('Content cannot exceed 1MB'),
  body('contentType')
    .optional()
    .isString()
    .isIn(['text', 'markdown', 'html', 'json'])
    .withMessage('Content type must be text, markdown, html, or json'),
  body('changeDescription')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Change description cannot exceed 500 characters'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Each tag cannot exceed 50 characters'),
  body('visibility')
    .optional()
    .isString()
    .isIn(['private', 'organization', 'public'])
    .withMessage('Visibility must be private, organization, or public'),
  body('status')
    .optional()
    .isString()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Status must be draft, published, or archived')
];
