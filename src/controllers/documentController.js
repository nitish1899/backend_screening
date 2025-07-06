import { Document } from '../models/Document.js';
import { Activity } from '../models/Activity.js';
import { Folder } from '../models/Folder.js';
import { logger } from '../config/logger.js';
import { catchAsync, AppError } from '../middleware/errorHandler.js';

// Get all documents for the user's organization
export const getDocuments = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, sort = '-updatedAt', search, status, folder, tags } = req.query;
  const userId = req.user.id;
  const organizationId = req.user.organization.id;

  // Build query
  const query = {
    organization: organizationId,
    $or: [
      { owner: userId },
      { visibility: 'organization' },
      { 'sharedWith.user': userId, 'sharedWith.isActive': true }
    ]
  };

  if (status && status !== 'all') {
    query.status = status;
  } else {
    query.status = { $ne: 'deleted' };
  }

  if (folder) {
    query.folder = folder;
  }

  if (tags && tags.length > 0) {
    const tagArray = Array.isArray(tags) ? tags : tags.split(',');
    query.tags = { $in: tagArray };
  }

  if (search) {
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ]
    });
  }

  // Execute query with pagination
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort,
    populate: [
      { path: 'owner', select: 'name email' },
      { path: 'folder', select: 'name path' },
      { path: 'sharedWith.user', select: 'name email' }
    ]
  };

  const result = await Document.paginate(query, options);

  res.json({
    success: true,
    data: {
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

// Get a single document by ID
export const getDocument = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const organizationId = req.user.organization.id;

  const document = await Document.findOne({
    _id: id,
    organization: organizationId,
    status: { $ne: 'deleted' }
  })
    .populate('owner', 'name email')
    .populate('folder', 'name path')
    .populate('sharedWith.user', 'name email')
    .populate('versions.author', 'name email');

  if (!document) {
    throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
  }

  // Check if user has permission to view
  if (!document.hasPermission(userId, 'viewer')) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Update last accessed
  document.updateLastAccessed(userId);

  // Log activity
  await Activity.logActivity(
    userId,
    organizationId,
    'document_viewed',
    `Document "${document.title}" viewed`,
    { documentId: document._id }
  );

  res.json({
    success: true,
    data: { document }
  });
});

// Create a new document
export const createDocument = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const organizationId = req.user.organization.id;
  const { title, content, contentType, folder, tags, visibility } = req.body;

  // Validate folder if provided
  if (folder) {
    const folderDoc = await Folder.findOne({
      _id: folder,
      organization: organizationId
    });

    if (!folderDoc) {
      throw new AppError('Folder not found', 404, 'FOLDER_NOT_FOUND');
    }

    if (!folderDoc.hasPermission(userId, 'editor')) {
      throw new AppError('No permission to create documents in this folder', 403, 'FOLDER_ACCESS_DENIED');
    }
  }

  const document = new Document({
    title,
    content: content || '',
    contentType: contentType || 'text',
    owner: userId,
    organization: organizationId,
    folder: folder || null,
    tags: tags || [],
    visibility: visibility || 'private',
    status: 'draft'
  });

  await document.save();

  // Update folder stats if document is in a folder
  if (folder) {
    const folderDoc = await Folder.findById(folder);
    if (folderDoc) {
      folderDoc.updateStats();
    }
  }

  // Log activity
  await Activity.logActivity(
    userId,
    organizationId,
    'document_created',
    `Document "${document.title}" created`,
    { documentId: document._id, folder }
  );

  // Populate response
  await document.populate([
    { path: 'owner', select: 'name email' },
    { path: 'folder', select: 'name path' }
  ]);

  res.status(201).json({
    success: true,
    message: 'Document created successfully',
    data: { document }
  });
});

// Update a document
export const updateDocument = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const organizationId = req.user.organization.id;
  const updates = req.body;

  const document = await Document.findOne({
    _id: id,
    organization: organizationId,
    status: { $ne: 'deleted' }
  });

  if (!document) {
    throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
  }

  // Check if user has permission to edit
  if (!document.hasPermission(userId, 'editor')) {
    throw new AppError('No permission to edit this document', 403, 'EDIT_ACCESS_DENIED');
  }

  // Create version if content is being updated
  if (updates.content && updates.content !== document.content) {
    const changeDescription = updates.changeDescription || 'Manual update';
    await document.addVersion(updates.content, userId, changeDescription);
  }

  // Store original values for change tracking
  const originalValues = {};
  Object.keys(updates).forEach(key => {
    if (key !== 'changeDescription') {
      originalValues[key] = document[key];
    }
  });

  // Remove sensitive fields that shouldn't be updated directly
  delete updates.owner;
  delete updates.organization;
  delete updates.versions;
  delete updates.sharedWith;
  delete updates.changeDescription; // Already used for version creation

  // Update document
  Object.assign(document, updates);
  document.updatedAt = new Date();
  await document.save();

  // Track document changes with enhanced activity logging
  await Activity.trackDocumentChange(
    document._id,
    userId,
    organizationId,
    {
      before: originalValues,
      after: updates,
      ...Object.keys(updates).reduce((acc, key) => {
        acc[key] = updates[key];
        return acc;
      }, {})
    }
  );

  // Populate response
  await document.populate([
    { path: 'owner', select: 'name email' },
    { path: 'folder', select: 'name path' }
  ]);

  res.json({
    success: true,
    message: 'Document updated successfully',
    data: { document }
  });
});

// Delete a document (soft delete)
export const deleteDocument = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const organizationId = req.user.organization.id;

  const document = await Document.findOne({
    _id: id,
    organization: organizationId,
    status: { $ne: 'deleted' }
  });

  if (!document) {
    throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
  }

  // Check if user has permission to delete (owner or admin)
  if (!document.hasPermission(userId, 'admin') && document.owner.toString() !== userId) {
    throw new AppError('No permission to delete this document', 403, 'DELETE_ACCESS_DENIED');
  }

  // Soft delete
  document.status = 'deleted';
  document.deletedAt = new Date();
  await document.save();

  // Update folder stats if document was in a folder
  if (document.folder) {
    const folder = await Folder.findById(document.folder);
    if (folder) {
      folder.updateStats();
    }
  }

  // Log activity
  await Activity.logActivity(
    userId,
    organizationId,
    'document_deleted',
    `Document "${document.title}" deleted`,
    { documentId: document._id }
  );

  res.json({
    success: true,
    message: 'Document deleted successfully'
  });
});

// Share a document with a user
export const shareDocument = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { userId: targetUserId, permission, expiresAt } = req.body;
  const userId = req.user.id;
  const organizationId = req.user.organization.id;

  const document = await Document.findOne({
    _id: id,
    organization: organizationId,
    status: { $ne: 'deleted' }
  });

  if (!document) {
    throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
  }

  // Check if user has permission to share
  if (!document.hasPermission(userId, 'admin') && document.owner.toString() !== userId) {
    throw new AppError('No permission to share this document', 403, 'SHARE_ACCESS_DENIED');
  }

  // Validate target user exists in same organization
  const { User } = await import('../models/User.js');
  const targetUser = await User.findOne({
    _id: targetUserId,
    organization: organizationId,
    isActive: true
  });

  if (!targetUser) {
    throw new AppError('Target user not found in organization', 404, 'TARGET_USER_NOT_FOUND');
  }

  // Share document
  await document.shareWith(targetUserId, permission, userId, expiresAt);

  // Log activity
  await Activity.logActivity(
    userId,
    organizationId,
    'document_shared',
    `Document "${document.title}" shared with ${targetUser.name}`,
    {
      documentId: document._id,
      targetUserId,
      permission
    }
  );

  res.json({
    success: true,
    message: 'Document shared successfully'
  });
});

// Get document version history
export const getDocumentVersions = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const organizationId = req.user.organization.id;
  const { page = 1, limit = 10 } = req.query;

  const document = await Document.findOne({
    _id: id,
    organization: organizationId,
    status: { $ne: 'deleted' }
  })
    .populate('versions.editedBy', 'name email')
    .select('title versions currentVersion');

  if (!document) {
    throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
  }

  // Check if user has permission to view
  if (!document.hasPermission(userId, 'viewer')) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Paginate versions (newest first)
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + parseInt(limit);
  const sortedVersions = document.versions
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(startIndex, endIndex);

  const totalVersions = document.versions.length;
  const totalPages = Math.ceil(totalVersions / limit);

  // Log activity
  await Activity.logActivity({
    user: userId,
    organization: organizationId,
    document: id,
    action: 'version_viewed',
    details: `Viewed version history for document "${document.title}"`,
    category: 'document',
    severity: 'low'
  });

  res.json({
    success: true,
    data: {
      document: {
        id: document._id,
        title: document.title,
        currentVersion: document.currentVersion
      },
      versions: sortedVersions,
      pagination: {
        page: parseInt(page),
        pages: totalPages,
        total: totalVersions,
        limit: parseInt(limit),
        hasNext: endIndex < totalVersions,
        hasPrev: startIndex > 0
      }
    }
  });
});

// Get specific document version
export const getDocumentVersion = catchAsync(async (req, res) => {
  const { id, versionNumber } = req.params;
  const userId = req.user.id;
  const organizationId = req.user.organization.id;

  const document = await Document.findOne({
    _id: id,
    organization: organizationId,
    status: { $ne: 'deleted' }
  })
    .populate('versions.editedBy', 'name email')
    .select('title versions currentVersion');

  if (!document) {
    throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
  }

  // Check if user has permission to view
  if (!document.hasPermission(userId, 'viewer')) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Find the specific version
  const version = document.versions.find(v => v.versionNumber === parseInt(versionNumber));

  if (!version) {
    throw new AppError('Version not found', 404, 'VERSION_NOT_FOUND');
  }

  // Log activity
  await Activity.logActivity({
    user: userId,
    organization: organizationId,
    document: id,
    action: 'version_viewed',
    details: `Viewed version ${versionNumber} of document "${document.title}"`,
    category: 'document',
    severity: 'low',
    metadata: { versionNumber: parseInt(versionNumber) }
  });

  res.json({
    success: true,
    data: {
      document: {
        id: document._id,
        title: document.title,
        currentVersion: document.currentVersion
      },
      version
    }
  });
});

// Restore document to a specific version
export const restoreDocumentVersion = catchAsync(async (req, res) => {
  const { id, versionNumber } = req.params;
  const userId = req.user.id;
  const organizationId = req.user.organization.id;
  const { changeDescription } = req.body;

  const document = await Document.findOne({
    _id: id,
    organization: organizationId,
    status: { $ne: 'deleted' }
  });

  if (!document) {
    throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
  }

  // Check if user has permission to edit
  if (!document.hasPermission(userId, 'editor')) {
    throw new AppError('No permission to edit this document', 403, 'EDIT_ACCESS_DENIED');
  }

  // Use enhanced restore method
  try {
    await document.restoreToVersion(parseInt(versionNumber), userId, changeDescription);
  } catch (error) {
    if (error.message.includes('not found')) {
      throw new AppError('Version not found', 404, 'VERSION_NOT_FOUND');
    }
    throw error;
  }

  // Log activity
  await Activity.logActivity({
    user: userId,
    organization: organizationId,
    document: id,
    action: 'version_restored',
    details: `Restored document "${document.title}" to version ${versionNumber}`,
    category: 'document',
    severity: 'medium',
    metadata: {
      restoredFromVersion: parseInt(versionNumber),
      newVersion: document.currentVersion
    }
  });

  await document.populate([
    { path: 'owner', select: 'name email' },
    { path: 'versions.editedBy', select: 'name email' }
  ]);

  res.json({
    success: true,
    message: 'Document restored successfully',
    data: {
      document,
      restoredFromVersion: parseInt(versionNumber),
      newVersion: document.currentVersion
    }
  });
});

// Compare two document versions
export const compareDocumentVersions = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { version1, version2 } = req.query;
  const userId = req.user.id;
  const organizationId = req.user.organization.id;

  if (!version1 || !version2) {
    throw new AppError('Both version numbers are required', 400, 'MISSING_VERSIONS');
  }

  const document = await Document.findOne({
    _id: id,
    organization: organizationId,
    status: { $ne: 'deleted' }
  })
    .populate('versions.editedBy', 'name email')
    .select('title versions currentVersion');

  if (!document) {
    throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
  }

  // Check if user has permission to view
  if (!document.hasPermission(userId, 'viewer')) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Find the versions to compare
  const ver1 = document.versions.find(v => v.versionNumber === parseInt(version1));
  const ver2 = document.versions.find(v => v.versionNumber === parseInt(version2));

  if (!ver1 || !ver2) {
    throw new AppError('One or both versions not found', 404, 'VERSION_NOT_FOUND');
  }

  // Use enhanced diff calculation
  const { generateTextDiff } = await import('../utils/versionControl.js');
  const diffResult = generateTextDiff(ver1.content, ver2.content);

  // Log activity
  await Activity.logActivity({
    user: userId,
    organization: organizationId,
    document: id,
    action: 'version_compared',
    details: `Compared versions ${version1} and ${version2} of document "${document.title}"`,
    category: 'document',
    severity: 'low',
    metadata: {
      version1: parseInt(version1),
      version2: parseInt(version2),
      changesCount: diffResult.summary.totalChanges
    }
  });

  res.json({
    success: true,
    data: {
      document: {
        id: document._id,
        title: document.title
      },
      comparison: {
        version1: ver1,
        version2: ver2,
        diff: diffResult.changes,
        summary: diffResult.summary
      }
    }
  });
});

// Get document activity log
export const getDocumentActivity = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const organizationId = req.user.organization.id;
  const {
    page = 1,
    limit = 20,
    action,
    startDate,
    endDate,
    userId: filterUserId
  } = req.query;

  const document = await Document.findOne({
    _id: id,
    organization: organizationId,
    status: { $ne: 'deleted' }
  }).select('title');

  if (!document) {
    throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
  }

  // Check if user has permission to view
  if (!document.hasPermission(userId, 'viewer')) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Build activity query
  const activityQuery = {
    document: id,
    organization: organizationId
  };

  if (action) {
    activityQuery.action = action;
  }

  if (filterUserId) {
    activityQuery.user = filterUserId;
  }

  if (startDate || endDate) {
    activityQuery.createdAt = {};
    if (startDate) activityQuery.createdAt.$gte = new Date(startDate);
    if (endDate) activityQuery.createdAt.$lte = new Date(endDate);
  }

  // Get activities with pagination
  const skip = (page - 1) * limit;
  const activities = await Activity.find(activityQuery)
    .populate('user', 'name email')
    .populate('relatedUsers', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const totalActivities = await Activity.countDocuments(activityQuery);
  const totalPages = Math.ceil(totalActivities / limit);

  // Log this activity view
  await Activity.logActivity({
    user: userId,
    organization: organizationId,
    document: id,
    action: 'activity_viewed',
    details: `Viewed activity log for document "${document.title}"`,
    category: 'document',
    severity: 'low'
  });

  res.json({
    success: true,
    data: {
      document: {
        id: document._id,
        title: document.title
      },
      activities,
      pagination: {
        page: parseInt(page),
        pages: totalPages,
        total: totalActivities,
        limit: parseInt(limit),
        hasNext: skip + activities.length < totalActivities,
        hasPrev: page > 1
      },
      filters: {
        action,
        startDate,
        endDate,
        userId: filterUserId
      }
    }
  });
});

// Get organization-wide activity log
export const getOrganizationActivity = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const organizationId = req.user.organization.id;
  const {
    page = 1,
    limit = 50,
    category,
    action,
    severity,
    startDate,
    endDate,
    userId: filterUserId
  } = req.query;

  // Check if user has admin permissions
  if (req.user.role !== 'admin') {
    throw new AppError('Admin access required', 403, 'ADMIN_ACCESS_REQUIRED');
  }

  // Build activity query
  const activityQuery = {
    organization: organizationId
  };

  if (category) {
    activityQuery.category = category;
  }

  if (action) {
    activityQuery.action = action;
  }

  if (severity) {
    activityQuery.severity = severity;
  }

  if (filterUserId) {
    activityQuery.user = filterUserId;
  }

  if (startDate || endDate) {
    activityQuery.createdAt = {};
    if (startDate) activityQuery.createdAt.$gte = new Date(startDate);
    if (endDate) activityQuery.createdAt.$lte = new Date(endDate);
  }

  // Get activities with pagination
  const skip = (page - 1) * limit;
  const activities = await Activity.find(activityQuery)
    .populate('user', 'name email role')
    .populate('document', 'title')
    .populate('relatedUsers', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const totalActivities = await Activity.countDocuments(activityQuery);
  const totalPages = Math.ceil(totalActivities / limit);

  // Get activity statistics
  const stats = await Activity.aggregate([
    { $match: { organization: organizationId } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        lastActivity: { $max: '$createdAt' }
      }
    }
  ]);

  // Log this activity view
  await Activity.logActivity({
    user: userId,
    organization: organizationId,
    action: 'organization_activity_viewed',
    details: 'Viewed organization-wide activity log',
    category: 'organization',
    severity: 'low'
  });

  res.json({
    success: true,
    data: {
      activities,
      statistics: stats,
      pagination: {
        page: parseInt(page),
        pages: totalPages,
        total: totalActivities,
        limit: parseInt(limit),
        hasNext: skip + activities.length < totalActivities,
        hasPrev: page > 1
      },
      filters: {
        category,
        action,
        severity,
        startDate,
        endDate,
        userId: filterUserId
      }
    }
  });
});
