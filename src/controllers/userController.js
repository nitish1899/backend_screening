import { User } from '../models/User.js';
import { Document } from '../models/Document.js';
import { Activity } from '../models/Activity.js';
import { logger } from '../config/logger.js';
import { catchAsync, AppError } from '../middleware/errorHandler.js';

// Get all users in organization
export const getUsers = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, role, status = 'active', search } = req.query;
  const organizationId = req.user.organization.id;

  // Build query
  const query = { organization: organizationId };

  if (role && role !== 'all') {
    query.role = role;
  }

  if (status === 'active') {
    query.isActive = true;
  } else if (status === 'inactive') {
    query.isActive = false;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  // Execute query with pagination
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: 'name',
    select: '-password'
  };

  const result = await User.paginate(query, options);

  res.json({
    success: true,
    data: {
      users: result.docs,
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
});

// Get a single user by ID
export const getUser = catchAsync(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.user.organization.id;

  const user = await User.findOne({
    _id: id,
    organization: organizationId
  }).select('-password');

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Get user statistics
  const [documentCount, recentActivity] = await Promise.all([
    Document.countDocuments({
      owner: id,
      organization: organizationId,
      status: { $ne: 'deleted' }
    }),
    Activity.find({
      user: id,
      organization: organizationId
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('type description createdAt')
  ]);

  const userWithStats = {
    ...user.toObject(),
    stats: {
      documentsOwned: documentCount,
      recentActivity
    }
  };

  res.json({
    success: true,
    data: { user: userWithStats }
  });
});

// Update user details (admin only)
export const updateUser = catchAsync(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.user.organization.id;
  const currentUserId = req.user.id;
  const updates = req.body;

  // Only admin can update other users
  if (req.user.role !== 'admin' && id !== currentUserId) {
    throw new AppError('Only administrators can update other users', 403, 'ADMIN_REQUIRED');
  }

  const user = await User.findOne({
    _id: id,
    organization: organizationId
  });

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Remove sensitive fields that shouldn't be updated directly
  delete updates.password;
  delete updates.organization;
  delete updates.emailVerified;

  // Only admin can change roles
  if (updates.role && req.user.role !== 'admin') {
    delete updates.role;
  }

  // Cannot change own role or status
  if (id === currentUserId) {
    delete updates.role;
    delete updates.isActive;
  }

  // Update user
  Object.assign(user, updates);
  user.updatedAt = new Date();
  await user.save();

  // Log activity
  await Activity.logActivity(
    currentUserId,
    organizationId,
    'user_updated',
    `User profile updated: ${user.email}`,
    { 
      targetUserId: id,
      updatedFields: Object.keys(updates),
      updatedBy: currentUserId === id ? 'self' : 'admin'
    }
  );

  // Return user without password
  const updatedUser = await User.findById(id).select('-password');

  res.json({
    success: true,
    message: 'User updated successfully',
    data: { user: updatedUser }
  });
});

// Deactivate user (admin only)
export const deactivateUser = catchAsync(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.user.organization.id;
  const currentUserId = req.user.id;

  // Only admin can deactivate users
  if (req.user.role !== 'admin') {
    throw new AppError('Only administrators can deactivate users', 403, 'ADMIN_REQUIRED');
  }

  // Cannot deactivate self
  if (id === currentUserId) {
    throw new AppError('Cannot deactivate yourself', 400, 'CANNOT_DEACTIVATE_SELF');
  }

  const user = await User.findOne({
    _id: id,
    organization: organizationId
  });

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  if (!user.isActive) {
    throw new AppError('User is already deactivated', 400, 'USER_ALREADY_DEACTIVATED');
  }

  // Deactivate user
  user.isActive = false;
  user.updatedAt = new Date();
  await user.save();

  // Transfer ownership of documents to admin
  await Document.updateMany(
    { owner: id, organization: organizationId },
    { owner: currentUserId, updatedAt: new Date() }
  );

  // Log activity
  await Activity.logActivity(
    currentUserId,
    organizationId,
    'user_deactivated',
    `User deactivated: ${user.email}`,
    { deactivatedUserId: id }
  );

  res.json({
    success: true,
    message: 'User deactivated successfully'
  });
});

// Reactivate user (admin only)
export const reactivateUser = catchAsync(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.user.organization.id;
  const currentUserId = req.user.id;

  // Only admin can reactivate users
  if (req.user.role !== 'admin') {
    throw new AppError('Only administrators can reactivate users', 403, 'ADMIN_REQUIRED');
  }

  const user = await User.findOne({
    _id: id,
    organization: organizationId
  });

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  if (user.isActive) {
    throw new AppError('User is already active', 400, 'USER_ALREADY_ACTIVE');
  }

  // Check subscription limits
  const { Organization } = await import('../models/Organization.js');
  const organization = await Organization.findById(organizationId);
  const currentActiveUsers = await User.countDocuments({
    organization: organizationId,
    isActive: true
  });

  if (currentActiveUsers >= organization.subscription.limits.users) {
    throw new AppError(
      `User limit reached. Current plan allows ${organization.subscription.limits.users} active users.`,
      400,
      'USER_LIMIT_REACHED'
    );
  }

  // Reactivate user
  user.isActive = true;
  user.updatedAt = new Date();
  await user.save();

  // Log activity
  await Activity.logActivity(
    currentUserId,
    organizationId,
    'user_reactivated',
    `User reactivated: ${user.email}`,
    { reactivatedUserId: id }
  );

  res.json({
    success: true,
    message: 'User reactivated successfully',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        updatedAt: user.updatedAt
      }
    }
  });
});

// Get user's documents
export const getUserDocuments = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 20, status = 'active' } = req.query;
  const organizationId = req.user.organization.id;
  const currentUserId = req.user.id;

  // Users can only view their own documents unless they're admin
  if (id !== currentUserId && req.user.role !== 'admin') {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Verify user exists in organization
  const user = await User.findOne({
    _id: id,
    organization: organizationId
  });

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Build query
  const query = {
    owner: id,
    organization: organizationId
  };

  if (status === 'active') {
    query.status = { $ne: 'deleted' };
  } else if (status === 'deleted') {
    query.status = 'deleted';
  }

  // Execute query with pagination
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: '-updatedAt',
    populate: [
      { path: 'folder', select: 'name path' }
    ]
  };

  const result = await Document.paginate(query, options);

  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      },
      documents: result.docs,
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
});

// Get user's activity log
export const getUserActivity = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 20, type } = req.query;
  const organizationId = req.user.organization.id;
  const currentUserId = req.user.id;

  // Users can only view their own activity unless they're admin
  if (id !== currentUserId && req.user.role !== 'admin') {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Verify user exists in organization
  const user = await User.findOne({
    _id: id,
    organization: organizationId
  });

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Build query
  const query = {
    user: id,
    organization: organizationId
  };

  if (type && type !== 'all') {
    query.type = type;
  }

  // Execute query with pagination
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: '-createdAt'
  };

  const result = await Activity.paginate(query, options);

  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      },
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
});
