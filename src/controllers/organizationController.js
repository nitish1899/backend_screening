import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { Document } from '../models/Document.js';
import { Activity } from '../models/Activity.js';
import { logger } from '../config/logger.js';
import { catchAsync, AppError } from '../middleware/errorHandler.js';

// Get organization details
export const getOrganization = catchAsync(async (req, res) => {
  const organizationId = req.user.organization.id;

  const organization = await Organization.findById(organizationId)
    .populate('owner', 'name email')
    .select('-settings.apiKeys -settings.webhooks');

  if (!organization) {
    throw new AppError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
  }

  res.json({
    success: true,
    data: { organization }
  });
});

// Update organization details
export const updateOrganization = catchAsync(async (req, res) => {
  const organizationId = req.user.organization.id;
  const userId = req.user.id;
  const updates = req.body;

  // Only admin can update organization
  if (req.user.role !== 'admin') {
    throw new AppError('Only administrators can update organization details', 403, 'ADMIN_REQUIRED');
  }

  const organization = await Organization.findById(organizationId);

  if (!organization) {
    throw new AppError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
  }

  // Remove sensitive fields that shouldn't be updated directly
  delete updates.owner;
  delete updates.domain;
  delete updates.subscription;
  delete updates.stats;
  delete updates.settings.apiKeys;
  delete updates.settings.webhooks;

  // Update organization
  Object.assign(organization, updates);
  organization.updatedAt = new Date();
  await organization.save();

  // Log activity
  await Activity.logActivity(
    userId,
    organizationId,
    'organization_updated',
    'Organization details updated',
    { updatedFields: Object.keys(updates) }
  );

  res.json({
    success: true,
    message: 'Organization updated successfully',
    data: { organization }
  });
});

// Get organization members
export const getMembers = catchAsync(async (req, res) => {
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
      members: result.docs,
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

// Invite a new member
export const inviteMember = catchAsync(async (req, res) => {
  const { email, role = 'viewer', name } = req.body;
  const organizationId = req.user.organization.id;
  const userId = req.user.id;

  // Only admin can invite members
  if (req.user.role !== 'admin') {
    throw new AppError('Only administrators can invite members', 403, 'ADMIN_REQUIRED');
  }

  // Check if user already exists in organization
  const existingUser = await User.findOne({
    email,
    organization: organizationId
  });

  if (existingUser) {
    throw new AppError('User already exists in organization', 400, 'USER_EXISTS');
  }

  // Get organization for subscription limits
  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
  }

  // Check subscription limits
  const currentMemberCount = await User.countDocuments({
    organization: organizationId,
    isActive: true
  });

  const maxMembers = organization.subscription.limits.users;
  if (currentMemberCount >= maxMembers) {
    throw new AppError(
      `Member limit reached. Current plan allows ${maxMembers} members.`,
      400,
      'MEMBER_LIMIT_REACHED'
    );
  }

  // Create user with temporary password
  const tempPassword = Math.random().toString(36).slice(-8);
  const newUser = new User({
    name: name || email.split('@')[0],
    email,
    password: tempPassword,
    role,
    organization: organizationId,
    isActive: true,
    emailVerified: false
  });

  await newUser.save();

  // TODO: Send invitation email with temporary password
  // This would typically integrate with an email service

  // Log activity
  await Activity.logActivity(
    userId,
    organizationId,
    'member_invited',
    `New member invited: ${email}`,
    { invitedUserId: newUser._id, role }
  );

  // Update organization stats
  await organization.updateStats();

  res.status(201).json({
    success: true,
    message: 'Member invited successfully',
    data: {
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        isActive: newUser.isActive,
        createdAt: newUser.createdAt
      }
    }
  });
});

// Update member role
export const updateMemberRole = catchAsync(async (req, res) => {
  const { memberId } = req.params;
  const { role } = req.body;
  const organizationId = req.user.organization.id;
  const userId = req.user.id;

  // Only admin can update member roles
  if (req.user.role !== 'admin') {
    throw new AppError('Only administrators can update member roles', 403, 'ADMIN_REQUIRED');
  }

  const member = await User.findOne({
    _id: memberId,
    organization: organizationId
  });

  if (!member) {
    throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND');
  }

  // Cannot change own role
  if (member._id.toString() === userId) {
    throw new AppError('Cannot change your own role', 400, 'CANNOT_CHANGE_OWN_ROLE');
  }

  const oldRole = member.role;
  member.role = role;
  member.updatedAt = new Date();
  await member.save();

  // Log activity
  await Activity.logActivity(
    userId,
    organizationId,
    'member_role_updated',
    `Member role updated: ${member.email} from ${oldRole} to ${role}`,
    { memberId, oldRole, newRole: role }
  );

  res.json({
    success: true,
    message: 'Member role updated successfully',
    data: {
      user: {
        id: member._id,
        name: member.name,
        email: member.email,
        role: member.role,
        updatedAt: member.updatedAt
      }
    }
  });
});

// Remove member from organization
export const removeMember = catchAsync(async (req, res) => {
  const { memberId } = req.params;
  const organizationId = req.user.organization.id;
  const userId = req.user.id;

  // Only admin can remove members
  if (req.user.role !== 'admin') {
    throw new AppError('Only administrators can remove members', 403, 'ADMIN_REQUIRED');
  }

  const member = await User.findOne({
    _id: memberId,
    organization: organizationId
  });

  if (!member) {
    throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND');
  }

  // Cannot remove self
  if (member._id.toString() === userId) {
    throw new AppError('Cannot remove yourself from organization', 400, 'CANNOT_REMOVE_SELF');
  }

  // Deactivate user instead of deleting
  member.isActive = false;
  member.updatedAt = new Date();
  await member.save();

  // Transfer ownership of documents to admin
  await Document.updateMany(
    { owner: memberId, organization: organizationId },
    { owner: userId, updatedAt: new Date() }
  );

  // Log activity
  await Activity.logActivity(
    userId,
    organizationId,
    'member_removed',
    `Member removed: ${member.email}`,
    { removedMemberId: memberId }
  );

  // Update organization stats
  const organization = await Organization.findById(organizationId);
  if (organization) {
    await organization.updateStats();
  }

  res.json({
    success: true,
    message: 'Member removed successfully'
  });
});

// Get organization statistics
export const getStats = catchAsync(async (req, res) => {
  const organizationId = req.user.organization.id;

  // Only admin can view detailed stats
  if (req.user.role !== 'admin') {
    throw new AppError('Only administrators can view organization statistics', 403, 'ADMIN_REQUIRED');
  }

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
  }

  // Get additional statistics
  const [
    totalUsers,
    activeUsers,
    totalDocuments,
    recentActivity
  ] = await Promise.all([
    User.countDocuments({ organization: organizationId }),
    User.countDocuments({ organization: organizationId, isActive: true }),
    Document.countDocuments({ organization: organizationId, status: { $ne: 'deleted' } }),
    Activity.find({ organization: organizationId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'name email')
  ]);

  const stats = {
    ...organization.stats,
    users: {
      total: totalUsers,
      active: activeUsers,
      inactive: totalUsers - activeUsers
    },
    documents: {
      total: totalDocuments
    },
    subscription: {
      plan: organization.subscription.plan,
      status: organization.subscription.status,
      limits: organization.subscription.limits,
      usage: {
        users: activeUsers,
        documents: totalDocuments,
        storage: organization.stats.storageUsed
      }
    },
    recentActivity
  };

  res.json({
    success: true,
    data: { stats }
  });
});
