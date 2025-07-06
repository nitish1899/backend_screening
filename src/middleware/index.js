// Central export file for all middleware
export {
  authenticate,
  optionalAuth,
  requireAuth
} from './auth.js';

export {
  requireRole,
  requireAdmin,
  requireEditor,
  requireViewer,
  requireOwnerOrAdmin,
  requireSameOrganization
} from './role.js';

export {
  handleValidationErrors,
  validateEmail,
  validatePassword,
  validateName,
  validateObjectId,
  validateDocumentTitle,
  validateDocumentContent,
  validateRole,
  validatePermission,
  validatePagination,
  validateUserRegistration,
  validateUserLogin,
  validateDocumentCreation,
  validateDocumentUpdate,
  validateDocumentShare,
  validateCommentCreation,
  validateOrganizationCreation,
  validateFolderCreation,
  sanitizeInput
} from './validation.js';

export {
  generalLimiter,
  authLimiter,
  documentLimiter,
  collaborationLimiter,
  uploadLimiter,
  apiLimiter,
  searchLimiter,
  commentLimiter,
  createRoleBasedLimiter,
  createOrgLimiter,
  subscriptionBasedLimiter
} from './rateLimiter.js';

export {
  enforceMultiTenancy,
  validateOrganizationAccess,
  checkSubscriptionLimits,
  requireFeature,
  addOrganizationContext,
  preventCrossOrganizationAccess,
  validateDocumentAccess,
  validateUserAccess
} from './multiTenant.js';

export {
  AppError,
  globalErrorHandler,
  catchAsync,
  handleNotFound,
  handleUncaughtException,
  handleUnhandledRejection,
  handleSigterm
} from './errorHandler.js';
