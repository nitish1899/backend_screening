import { Organization } from '../models/Organization.js';
import { logger } from '../config/logger.js';

// Middleware to ensure multi-tenant data isolation
export const enforceMultiTenancy = (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required for multi-tenant access.',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!user.organization || !user.organization.id) {
      return res.status(400).json({
        success: false,
        message: 'User organization not found.',
        code: 'NO_ORGANIZATION'
      });
    }

    // Add organization filter to all database queries
    req.organizationId = user.organization.id;
    req.organizationFilter = { organization: user.organization.id };

    next();
  } catch (error) {
    logger.error('Multi-tenancy enforcement error:', error);
    return res.status(500).json({
      success: false,
      message: 'Multi-tenancy check failed.',
      code: 'TENANCY_ERROR'
    });
  }
};

// Middleware to validate organization access
export const validateOrganizationAccess = async (req, res, next) => {
  try {
    const user = req.user;
    const organizationId = req.params.organizationId || req.body.organizationId || req.query.organizationId;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
        code: 'AUTH_REQUIRED'
      });
    }

    // If no specific organization ID is provided, use user's organization
    if (!organizationId) {
      req.targetOrganizationId = user.organization.id;
      return next();
    }

    // Check if user is trying to access their own organization
    if (organizationId !== user.organization.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own organization.',
        code: 'ORGANIZATION_ACCESS_DENIED'
      });
    }

    // Verify organization exists and is active
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found.',
        code: 'ORGANIZATION_NOT_FOUND'
      });
    }

    if (!organization.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Organization is inactive.',
        code: 'ORGANIZATION_INACTIVE'
      });
    }

    req.targetOrganizationId = organizationId;
    req.targetOrganization = organization;

    next();
  } catch (error) {
    logger.error('Organization access validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Organization access validation failed.',
      code: 'VALIDATION_ERROR'
    });
  }
};

// Middleware to check organization subscription limits
export const checkSubscriptionLimits = (resource, action = 'create') => {
  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user || !user.organization) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.',
          code: 'AUTH_REQUIRED'
        });
      }

      const organization = user.organization;
      const subscription = organization.subscription;

      // Skip limits for enterprise plans
      if (subscription.plan === 'enterprise') {
        return next();
      }

      // Define limits based on subscription plan
      const limits = {
        free: {
          users: 5,
          documents: 50,
          storage: 100 * 1024 * 1024, // 100MB
          collaborators: 3
        },
        basic: {
          users: 25,
          documents: 500,
          storage: 1024 * 1024 * 1024, // 1GB
          collaborators: 10
        },
        premium: {
          users: 100,
          documents: 5000,
          storage: 10 * 1024 * 1024 * 1024, // 10GB
          collaborators: 50
        }
      };

      const planLimits = limits[subscription.plan] || limits.free;
      const currentLimit = planLimits[resource];

      if (!currentLimit) {
        return next(); // No limit defined for this resource
      }

      // Get current usage based on resource type
      let currentUsage = 0;

      switch (resource) {
        case 'users':
          const { User } = await import('../models/User.js');
          currentUsage = await User.countDocuments({
            organization: organization.id,
            isActive: true
          });
          break;

        case 'documents':
          const { Document } = await import('../models/Document.js');
          currentUsage = await Document.countDocuments({
            organization: organization.id,
            status: { $ne: 'deleted' }
          });
          break;

        case 'storage':
          // This would need to be calculated based on actual file sizes
          // For now, we'll use a placeholder
          currentUsage = organization.stats?.storageUsed || 0;
          break;

        default:
          return next();
      }

      // Check if action would exceed limit
      if (action === 'create' && currentUsage >= currentLimit) {
        return res.status(403).json({
          success: false,
          message: `${resource} limit exceeded for ${subscription.plan} plan.`,
          code: 'SUBSCRIPTION_LIMIT_EXCEEDED',
          limit: currentLimit,
          current: currentUsage,
          plan: subscription.plan
        });
      }

      // Add usage info to request for potential use in response
      req.subscriptionUsage = {
        resource,
        current: currentUsage,
        limit: currentLimit,
        plan: subscription.plan
      };

      next();
    } catch (error) {
      logger.error('Subscription limit check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Subscription limit check failed.',
        code: 'LIMIT_CHECK_ERROR'
      });
    }
  };
};

// Middleware to check feature access based on subscription
export const requireFeature = (feature) => {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user || !user.organization) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.',
          code: 'AUTH_REQUIRED'
        });
      }

      const subscription = user.organization.subscription;

      // Define features by plan
      const planFeatures = {
        free: ['basic_collaboration', 'basic_sharing'],
        basic: ['basic_collaboration', 'basic_sharing', 'version_history', 'comments'],
        premium: ['basic_collaboration', 'basic_sharing', 'version_history', 'comments', 'advanced_sharing', 'real_time_collaboration'],
        enterprise: ['basic_collaboration', 'basic_sharing', 'version_history', 'comments', 'advanced_sharing', 'real_time_collaboration', 'api_access', 'sso', 'audit_logs']
      };

      const availableFeatures = planFeatures[subscription.plan] || planFeatures.free;

      if (!availableFeatures.includes(feature)) {
        return res.status(403).json({
          success: false,
          message: `Feature '${feature}' is not available in your ${subscription.plan} plan.`,
          code: 'FEATURE_NOT_AVAILABLE',
          feature,
          plan: subscription.plan,
          availableFeatures
        });
      }

      next();
    } catch (error) {
      logger.error('Feature access check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Feature access check failed.',
        code: 'FEATURE_CHECK_ERROR'
      });
    }
  };
};

// Middleware to add organization context to database queries
export const addOrganizationContext = (req, res, next) => {
  const originalQuery = req.query;
  const user = req.user;

  if (user && user.organization) {
    // Add organization filter to query parameters
    req.query = {
      ...originalQuery,
      organization: user.organization.id
    };

    // Store original query for potential use
    req.originalQuery = originalQuery;
  }

  next();
};

// Middleware to validate cross-organization resource access
export const preventCrossOrganizationAccess = (getResourceOrganizationId) => {
  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.',
          code: 'AUTH_REQUIRED'
        });
      }

      let resourceOrgId;

      if (typeof getResourceOrganizationId === 'function') {
        resourceOrgId = await getResourceOrganizationId(req);
      } else if (typeof getResourceOrganizationId === 'string') {
        resourceOrgId = req.params[getResourceOrganizationId] || req.body[getResourceOrganizationId];
      } else {
        resourceOrgId = getResourceOrganizationId;
      }

      if (!resourceOrgId) {
        return res.status(400).json({
          success: false,
          message: 'Resource organization could not be determined.',
          code: 'ORGANIZATION_UNKNOWN'
        });
      }

      if (resourceOrgId.toString() !== user.organization.id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Resource belongs to a different organization.',
          code: 'CROSS_ORGANIZATION_ACCESS_DENIED'
        });
      }

      next();
    } catch (error) {
      logger.error('Cross-organization access check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Cross-organization access check failed.',
        code: 'ACCESS_CHECK_ERROR'
      });
    }
  };
};

// Enhanced middleware to validate document access with organization isolation
export const validateDocumentAccess = (permission = 'view') => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const documentId = req.params.id || req.params.documentId;

      if (!documentId) {
        return res.status(400).json({
          success: false,
          message: 'Document ID is required.',
          code: 'DOCUMENT_ID_REQUIRED'
        });
      }

      const { Document } = await import('../models/Document.js');

      // Find document with organization isolation
      const document = await Document.findOne({
        _id: documentId,
        organization: user.organization.id,
        status: { $ne: 'deleted' }
      }).populate('owner', 'name email organization');

      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Document not found or access denied.',
          code: 'DOCUMENT_NOT_FOUND'
        });
      }

      // Double-check organization isolation
      if (document.organization.toString() !== user.organization.id.toString()) {
        logger.warn(`Cross-organization access attempt: User ${user.id} tried to access document ${documentId} from different organization`);
        return res.status(403).json({
          success: false,
          message: 'Access denied. Document belongs to a different organization.',
          code: 'CROSS_ORGANIZATION_ACCESS_DENIED'
        });
      }

      // Check specific permissions
      const hasAccess = checkDocumentPermission(document, user.id, permission);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: `Insufficient permissions. Required: ${permission}`,
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      // Add document to request for use in controller
      req.document = document;
      next();
    } catch (error) {
      logger.error('Document access validation error:', error);
      return res.status(500).json({
        success: false,
        message: 'Document access validation failed.',
        code: 'ACCESS_VALIDATION_ERROR'
      });
    }
  };
};

// Helper function to check document permissions
const checkDocumentPermission = (document, userId, permission) => {
  // Owner has all permissions
  if (document.owner._id.toString() === userId) {
    return true;
  }

  // Check shared access
  const sharedAccess = document.sharedWith.find(
    share => share.user.toString() === userId && share.isActive
  );

  if (!sharedAccess) {
    // Check if document is organization-wide visible
    if (document.visibility === 'organization' && permission === 'view') {
      return true;
    }
    return false;
  }

  // Check permission level
  const permissionLevels = {
    'view': ['viewer', 'editor', 'admin'],
    'edit': ['editor', 'admin'],
    'admin': ['admin']
  };

  return permissionLevels[permission]?.includes(sharedAccess.permission) || false;
};

// Middleware to validate user access with organization isolation
export const validateUserAccess = async (req, res, next) => {
  try {
    const currentUser = req.user;
    const targetUserId = req.params.id || req.params.userId;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required.',
        code: 'USER_ID_REQUIRED'
      });
    }

    const { User } = await import('../models/User.js');

    // Find user with organization isolation
    const targetUser = await User.findOne({
      _id: targetUserId,
      organization: currentUser.organization.id,
      isActive: true
    }).select('-password');

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found or access denied.',
        code: 'USER_NOT_FOUND'
      });
    }

    // Double-check organization isolation
    if (targetUser.organization.toString() !== currentUser.organization.id.toString()) {
      logger.warn(`Cross-organization user access attempt: User ${currentUser.id} tried to access user ${targetUserId} from different organization`);
      return res.status(403).json({
        success: false,
        message: 'Access denied. User belongs to a different organization.',
        code: 'CROSS_ORGANIZATION_ACCESS_DENIED'
      });
    }

    // Add target user to request
    req.targetUser = targetUser;
    next();
  } catch (error) {
    logger.error('User access validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'User access validation failed.',
      code: 'ACCESS_VALIDATION_ERROR'
    });
  }
};
