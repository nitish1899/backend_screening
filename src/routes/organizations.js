import express from 'express';
import {
  getOrganization,
  updateOrganization,
  getMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
  getStats
} from '../controllers/organizationController.js';
import {
  authenticate,
  requireAdmin,
  validateOrganizationCreation,
  validateObjectId,
  validatePagination,
  handleValidationErrors,
  sanitizeInput,
  enforceMultiTenancy,
  authLimiter
} from '../middleware/index.js';
import { body } from 'express-validator';

const router = express.Router();

// Apply authentication and multi-tenancy to all routes
router.use(authenticate);
router.use(enforceMultiTenancy);
router.use(sanitizeInput);
router.use(authLimiter);

/**
 * @route   GET /api/organizations
 * @desc    Get current organization details
 * @access  Private
 */
router.get('/',
  getOrganization
);

/**
 * @route   PUT /api/organizations
 * @desc    Update organization details
 * @access  Private (Admin only)
 */
router.put('/',
  requireAdmin,
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Organization name must be between 2 and 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must not exceed 500 characters'),
    body('settings.features.realTimeCollaboration')
      .optional()
      .isBoolean()
      .withMessage('Real-time collaboration setting must be boolean'),
    body('settings.features.documentVersioning')
      .optional()
      .isBoolean()
      .withMessage('Document versioning setting must be boolean'),
    body('settings.features.advancedSharing')
      .optional()
      .isBoolean()
      .withMessage('Advanced sharing setting must be boolean'),
    body('settings.security.requireTwoFactor')
      .optional()
      .isBoolean()
      .withMessage('Two-factor requirement setting must be boolean'),
    body('settings.security.sessionTimeout')
      .optional()
      .isInt({ min: 15, max: 1440 })
      .withMessage('Session timeout must be between 15 and 1440 minutes'),
    body('settings.security.passwordPolicy.minLength')
      .optional()
      .isInt({ min: 6, max: 50 })
      .withMessage('Minimum password length must be between 6 and 50'),
    handleValidationErrors
  ],
  updateOrganization
);

/**
 * @route   GET /api/organizations/members
 * @desc    Get organization members
 * @access  Private
 */
router.get('/members',
  validatePagination,
  handleValidationErrors,
  getMembers
);

/**
 * @route   POST /api/organizations/members
 * @desc    Invite a new member to the organization
 * @access  Private (Admin only)
 */
router.post('/members',
  requireAdmin,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters'),
    body('role')
      .optional()
      .isIn(['viewer', 'editor', 'admin'])
      .withMessage('Role must be viewer, editor, or admin'),
    handleValidationErrors
  ],
  inviteMember
);

/**
 * @route   PUT /api/organizations/members/:memberId/role
 * @desc    Update member role
 * @access  Private (Admin only)
 */
router.put('/members/:memberId/role',
  requireAdmin,
  [
    validateObjectId('memberId'),
    body('role')
      .isIn(['viewer', 'editor', 'admin'])
      .withMessage('Role must be viewer, editor, or admin'),
    handleValidationErrors
  ],
  updateMemberRole
);

/**
 * @route   DELETE /api/organizations/members/:memberId
 * @desc    Remove member from organization
 * @access  Private (Admin only)
 */
router.delete('/members/:memberId',
  requireAdmin,
  validateObjectId('memberId'),
  handleValidationErrors,
  removeMember
);

/**
 * @route   GET /api/organizations/stats
 * @desc    Get organization statistics
 * @access  Private (Admin only)
 */
router.get('/stats',
  requireAdmin,
  getStats
);

/**
 * @route   POST /api/organizations/members/:memberId/reactivate
 * @desc    Reactivate a deactivated member
 * @access  Private (Admin only)
 */
router.post('/members/:memberId/reactivate',
  requireAdmin,
  validateObjectId('memberId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { User } = await import('../models/User.js');
      const { Activity } = await import('../models/Activity.js');
      const { Organization } = await import('../models/Organization.js');
      const { AppError } = await import('../middleware/errorHandler.js');
      
      const { memberId } = req.params;
      const organizationId = req.user.organization.id;
      const userId = req.user.id;

      const member = await User.findOne({
        _id: memberId,
        organization: organizationId
      });

      if (!member) {
        throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND');
      }

      if (member.isActive) {
        throw new AppError('Member is already active', 400, 'MEMBER_ALREADY_ACTIVE');
      }

      // Check subscription limits
      const organization = await Organization.findById(organizationId);
      const currentActiveMembers = await User.countDocuments({
        organization: organizationId,
        isActive: true
      });

      if (currentActiveMembers >= organization.subscription.limits.users) {
        throw new AppError(
          `Member limit reached. Current plan allows ${organization.subscription.limits.users} active members.`,
          400,
          'MEMBER_LIMIT_REACHED'
        );
      }

      // Reactivate member
      member.isActive = true;
      member.updatedAt = new Date();
      await member.save();

      // Log activity
      await Activity.logActivity(
        userId,
        organizationId,
        'member_reactivated',
        `Member reactivated: ${member.email}`,
        { reactivatedMemberId: memberId }
      );

      // Update organization stats
      await organization.updateStats();

      res.json({
        success: true,
        message: 'Member reactivated successfully',
        data: {
          user: {
            id: member._id,
            name: member.name,
            email: member.email,
            role: member.role,
            isActive: member.isActive,
            updatedAt: member.updatedAt
          }
        }
      });

    } catch (error) {
      const { logger } = await import('../config/logger.js');
      logger.error('Reactivate member error:', error);
      
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to reactivate member',
        code: 'REACTIVATE_ERROR'
      });
    }
  }
);

/**
 * @route   GET /api/organizations/activity
 * @desc    Get organization activity log
 * @access  Private (Admin only)
 */
router.get('/activity',
  requireAdmin,
  [
    validatePagination,
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { Activity } = await import('../models/Activity.js');
      const { page = 1, limit = 20, type, user: userId } = req.query;
      const organizationId = req.user.organization.id;

      // Build query
      const query = { organization: organizationId };

      if (type && type !== 'all') {
        query.type = type;
      }

      if (userId) {
        query.user = userId;
      }

      // Execute query with pagination
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: '-createdAt',
        populate: [
          { path: 'user', select: 'name email' }
        ]
      };

      const result = await Activity.paginate(query, options);

      res.json({
        success: true,
        data: {
          activities: result.docs,
          pagination: {
            page: result.page,
            pages: result.totalPages,
            total: result.totalDocs,
            limit: result.limit,
            hasNext: result.hasNextPage,
            hasPrev: result.hasPrevPage
          }
        }
      });

    } catch (error) {
      const { logger } = await import('../config/logger.js');
      logger.error('Get organization activity error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to get organization activity',
        code: 'ACTIVITY_ERROR'
      });
    }
  }
);

export default router;
