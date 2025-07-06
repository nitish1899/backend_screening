import express from 'express';
import {
  getUsers,
  getUser,
  updateUser,
  deactivateUser,
  reactivateUser,
  getUserDocuments,
  getUserActivity
} from '../controllers/userController.js';
import {
  authenticate,
  requireAdmin,
  validateObjectId,
  validatePagination,
  handleValidationErrors,
  sanitizeInput,
  enforceMultiTenancy,
  authLimiter,
  validateUserAccess
} from '../middleware/index.js';
import { body } from 'express-validator';

const router = express.Router();

// Apply authentication and multi-tenancy to all routes
router.use(authenticate);
router.use(enforceMultiTenancy);
router.use(sanitizeInput);
router.use(authLimiter);

/**
 * @route   GET /api/users
 * @desc    Get all users in organization
 * @access  Private
 */
router.get('/',
  validatePagination,
  handleValidationErrors,
  getUsers
);

/**
 * @route   GET /api/users/:id
 * @desc    Get a single user by ID
 * @access  Private
 */
router.get('/:id',
  validateObjectId('id'),
  handleValidationErrors,
  validateUserAccess,
  getUser
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user details
 * @access  Private (Admin or self)
 */
router.put('/:id',
  [
    validateObjectId('id'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('role')
      .optional()
      .isIn(['viewer', 'editor', 'admin'])
      .withMessage('Role must be viewer, editor, or admin'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('Active status must be boolean'),
    body('preferences.theme')
      .optional()
      .isIn(['light', 'dark', 'auto'])
      .withMessage('Theme must be light, dark, or auto'),
    body('preferences.language')
      .optional()
      .isIn(['en', 'es', 'fr', 'de'])
      .withMessage('Language must be a supported language code'),
    body('preferences.notifications.email')
      .optional()
      .isBoolean()
      .withMessage('Email notifications preference must be boolean'),
    body('preferences.notifications.push')
      .optional()
      .isBoolean()
      .withMessage('Push notifications preference must be boolean'),
    handleValidationErrors
  ],
  updateUser
);

/**
 * @route   POST /api/users/:id/deactivate
 * @desc    Deactivate a user
 * @access  Private (Admin only)
 */
router.post('/:id/deactivate',
  requireAdmin,
  validateObjectId('id'),
  handleValidationErrors,
  validateUserAccess,
  deactivateUser
);

/**
 * @route   POST /api/users/:id/reactivate
 * @desc    Reactivate a user
 * @access  Private (Admin only)
 */
router.post('/:id/reactivate',
  requireAdmin,
  validateObjectId('id'),
  handleValidationErrors,
  reactivateUser
);

/**
 * @route   GET /api/users/:id/documents
 * @desc    Get user's documents
 * @access  Private (Admin or self)
 */
router.get('/:id/documents',
  [
    validateObjectId('id'),
    validatePagination,
    handleValidationErrors
  ],
  getUserDocuments
);

/**
 * @route   GET /api/users/:id/activity
 * @desc    Get user's activity log
 * @access  Private (Admin or self)
 */
router.get('/:id/activity',
  [
    validateObjectId('id'),
    validatePagination,
    handleValidationErrors
  ],
  getUserActivity
);

/**
 * @route   POST /api/users/:id/reset-password
 * @desc    Reset user password (admin only)
 * @access  Private (Admin only)
 */
router.post('/:id/reset-password',
  requireAdmin,
  [
    validateObjectId('id'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    body('sendEmail')
      .optional()
      .isBoolean()
      .withMessage('Send email flag must be boolean'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { User } = await import('../models/User.js');
      const { Activity } = await import('../models/Activity.js');
      const { AppError } = await import('../middleware/errorHandler.js');
      const { logger } = await import('../config/logger.js');

      const { id } = req.params;
      const { newPassword, sendEmail = true } = req.body;
      const organizationId = req.user.organization.id;
      const currentUserId = req.user.id;

      // Cannot reset own password through this endpoint
      if (id === currentUserId) {
        throw new AppError('Cannot reset your own password through this endpoint', 400, 'CANNOT_RESET_OWN_PASSWORD');
      }

      const user = await User.findOne({
        _id: id,
        organization: organizationId
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Update password
      user.password = newPassword;
      user.updatedAt = new Date();
      await user.save();

      // TODO: Send email notification if requested
      if (sendEmail) {
        // This would typically integrate with an email service
        logger.info(`Password reset email should be sent to: ${user.email}`);
      }

      // Log activity
      await Activity.logActivity(
        currentUserId,
        organizationId,
        'password_reset',
        `Password reset for user: ${user.email}`,
        { targetUserId: id, emailSent: sendEmail }
      );

      res.json({
        success: true,
        message: 'Password reset successfully',
        data: {
          emailSent: sendEmail
        }
      });

    } catch (error) {
      const { logger } = await import('../config/logger.js');
      logger.error('Reset password error:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to reset password',
        code: 'PASSWORD_RESET_ERROR'
      });
    }
  }
);

/**
 * @route   GET /api/users/:id/permissions
 * @desc    Get user's effective permissions
 * @access  Private (Admin or self)
 */
router.get('/:id/permissions',
  validateObjectId('id'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { User } = await import('../models/User.js');
      const { Document } = await import('../models/Document.js');
      const { AppError } = await import('../middleware/errorHandler.js');

      const { id } = req.params;
      const organizationId = req.user.organization.id;
      const currentUserId = req.user.id;

      // Users can only view their own permissions unless they're admin
      if (id !== currentUserId && req.user.role !== 'admin') {
        throw new AppError('Access denied', 403, 'ACCESS_DENIED');
      }

      const user = await User.findOne({
        _id: id,
        organization: organizationId
      }).select('-password');

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Get documents shared with user
      const sharedDocuments = await Document.find({
        organization: organizationId,
        'sharedWith.user': id,
        'sharedWith.isActive': true,
        status: { $ne: 'deleted' }
      })
        .select('title sharedWith')
        .populate('owner', 'name email');

      // Extract permissions for shared documents
      const documentPermissions = sharedDocuments.map(doc => {
        const shareInfo = doc.sharedWith.find(share =>
          share.user.toString() === id && share.isActive
        );

        return {
          documentId: doc._id,
          documentTitle: doc.title,
          owner: doc.owner,
          permission: shareInfo.permission,
          sharedAt: shareInfo.sharedAt,
          expiresAt: shareInfo.expiresAt
        };
      });

      const permissions = {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        rolePermissions: {
          canCreateDocuments: ['editor', 'admin'].includes(user.role),
          canEditDocuments: ['editor', 'admin'].includes(user.role),
          canDeleteDocuments: user.role === 'admin',
          canManageUsers: user.role === 'admin',
          canManageOrganization: user.role === 'admin',
          canViewAllDocuments: user.role === 'admin'
        },
        sharedDocuments: documentPermissions,
        totalSharedDocuments: documentPermissions.length
      };

      res.json({
        success: true,
        data: { permissions }
      });

    } catch (error) {
      const { logger } = await import('../config/logger.js');
      logger.error('Get user permissions error:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to get user permissions',
        code: 'PERMISSIONS_ERROR'
      });
    }
  }
);

export default router;
