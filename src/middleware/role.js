import { logger } from '../config/logger.js';

// Role hierarchy for permission checking
const ROLE_HIERARCHY = {
    viewer: 1,
    editor: 2,
    admin: 3
};

// Check if user has required role or higher
export const requireRole = (requiredRoles = []) => {
    return (req, res, next) => {
        try {
            const user = req.user;

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required.',
                    code: 'AUTH_REQUIRED'
                });
            }

            // Convert single role to array
            const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

            // Check if user has any of the required roles
            const hasRole = roles.some(role => {
                const requiredLevel = ROLE_HIERARCHY[role] || 0;
                const userLevel = ROLE_HIERARCHY[user.role] || 0;
                return userLevel >= requiredLevel;
            });

            if (!hasRole) {
                logger.warn(`Access denied for user ${user.id} with role ${user.role}. Required: ${roles.join(', ')}`);
                return res.status(403).json({
                    success: false,
                    message: 'Insufficient permissions.',
                    code: 'INSUFFICIENT_PERMISSIONS',
                    required: roles,
                    current: user.role
                });
            }

            next();
        } catch (error) {
            logger.error('Role check error:', error);
            return res.status(500).json({
                success: false,
                message: 'Permission check failed.',
                code: 'PERMISSION_ERROR'
            });
        }
    };
};

// Check if user is admin
export const requireAdmin = requireRole(['admin']);

// Check if user is editor or admin
export const requireEditor = requireRole(['editor', 'admin']);

// Check if user is viewer, editor, or admin (essentially any authenticated user)
export const requireViewer = requireRole(['viewer', 'editor', 'admin']);

// Check if user owns the resource or has admin role
export const requireOwnerOrAdmin = (getResourceOwnerId) => {
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

            // Admin can access everything
            if (user.role === 'admin') {
                return next();
            }

            // Get the owner ID of the resource
            let ownerId;
            if (typeof getResourceOwnerId === 'function') {
                ownerId = await getResourceOwnerId(req);
            } else if (typeof getResourceOwnerId === 'string') {
                ownerId = req.params[getResourceOwnerId] || req.body[getResourceOwnerId];
            } else {
                ownerId = getResourceOwnerId;
            }

            if (!ownerId) {
                return res.status(400).json({
                    success: false,
                    message: 'Resource owner could not be determined.',
                    code: 'OWNER_UNKNOWN'
                });
            }

            // Check if user is the owner
            if (user.id.toString() === ownerId.toString()) {
                return next();
            }

            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only access your own resources.',
                code: 'NOT_OWNER'
            });
        } catch (error) {
            logger.error('Owner check error:', error);
            return res.status(500).json({
                success: false,
                message: 'Ownership check failed.',
                code: 'OWNERSHIP_ERROR'
            });
        }
    };
};

// Check if user belongs to the same organization
export const requireSameOrganization = (getOrganizationId) => {
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

            // Get the organization ID of the resource
            let orgId;
            if (typeof getOrganizationId === 'function') {
                orgId = await getOrganizationId(req);
            } else if (typeof getOrganizationId === 'string') {
                orgId = req.params[getOrganizationId] || req.body[getOrganizationId];
            } else {
                orgId = getOrganizationId;
            }

            if (!orgId) {
                return res.status(400).json({
                    success: false,
                    message: 'Resource organization could not be determined.',
                    code: 'ORGANIZATION_UNKNOWN'
                });
            }

            // Check if user belongs to the same organization
            if (user.organization.id.toString() !== orgId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. Resource belongs to a different organization.',
                    code: 'DIFFERENT_ORGANIZATION'
                });
            }

            next();
        } catch (error) {
            logger.error('Organization check error:', error);
            return res.status(500).json({
                success: false,
                message: 'Organization check failed.',
                code: 'ORGANIZATION_ERROR'
            });
        }
    };
};

// Default export for backward compatibility
export default requireRole;
