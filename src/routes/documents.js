import express from 'express';
import {
  getDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  shareDocument,
  getDocumentVersions,
  getDocumentVersion,
  restoreDocumentVersion,
  compareDocumentVersions,
  getDocumentActivity,
  getOrganizationActivity
} from '../controllers/documentController.js';
import {
  authenticate,
  requireEditor,
  requireAdmin,
  documentLimiter,
  validateDocumentCreation,
  validateDocumentUpdate,
  validateDocumentShare,
  validateObjectId,
  validatePagination,
  handleValidationErrors,
  sanitizeInput,
  enforceMultiTenancy,
  checkSubscriptionLimits,
  validateDocumentAccess
} from '../middleware/index.js';
import {
  validateVersionNumber,
  validateVersionRestore,
  validateVersionComparison,
  validateActivityQuery,
  validateDateRange,
  validateDocumentUpdateWithVersioning
} from '../middleware/versionValidation.js';

const router = express.Router();

// Apply authentication and multi-tenancy to all routes
router.use(authenticate);
router.use(enforceMultiTenancy);
router.use(sanitizeInput);

/**
 * @swagger
 * /api/documents:
 *   get:
 *     tags: [Documents]
 *     summary: Get all documents
 *     description: |
 *       Retrieve all documents accessible to the current user within their organization.
 *       Supports pagination, filtering, and sorting. Results are automatically filtered
 *       based on user permissions and organization membership.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - $ref: '#/components/parameters/search'
 *       - $ref: '#/components/parameters/sortBy'
 *       - $ref: '#/components/parameters/sortOrder'
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [draft, published, archived]
 *         description: Filter by document status
 *         example: "published"
 *       - name: visibility
 *         in: query
 *         schema:
 *           type: string
 *           enum: [private, organization, public]
 *         description: Filter by document visibility
 *         example: "organization"
 *       - name: owner
 *         in: query
 *         schema:
 *           type: string
 *           format: objectId
 *         description: Filter by document owner ID
 *         example: "507f1f77bcf86cd799439011"
 *       - name: folder
 *         in: query
 *         schema:
 *           type: string
 *           format: objectId
 *         description: Filter by folder ID
 *         example: "507f1f77bcf86cd799439014"
 *       - name: tags
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by tags (comma-separated)
 *         example: "project,planning"
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Document'
 *             examples:
 *               success:
 *                 summary: Successful document list retrieval
 *                 value:
 *                   success: true
 *                   data:
 *                     - _id: "507f1f77bcf86cd799439013"
 *                       title: "Project Requirements Document"
 *                       content: "# Project Overview..."
 *                       contentType: "markdown"
 *                       owner:
 *                         _id: "507f1f77bcf86cd799439011"
 *                         name: "John Doe"
 *                         email: "john.doe@acme.com"
 *                       organization:
 *                         _id: "507f1f77bcf86cd799439012"
 *                         name: "Acme Corporation"
 *                         slug: "acme-corp"
 *                       tags: ["requirements", "project"]
 *                       status: "published"
 *                       visibility: "organization"
 *                       currentVersion: 2
 *                       createdAt: "2023-11-15T14:30:00Z"
 *                       updatedAt: "2023-11-25T16:45:00Z"
 *                   pagination:
 *                     page: 1
 *                     limit: 20
 *                     total: 45
 *                     pages: 3
 *                     hasNext: true
 *                     hasPrev: false
 *                   timestamp: "2023-12-01T10:30:00Z"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/',
  validatePagination,
  handleValidationErrors,
  getDocuments
);

/**
 * @swagger
 * /api/documents/{id}:
 *   get:
 *     tags: [Documents]
 *     summary: Get a single document
 *     description: |
 *       Retrieve a specific document by its ID. The user must have at least
 *       viewer permission for the document. Returns the complete document
 *       including content, metadata, and version information.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/documentId'
 *       - name: includeContent
 *         in: query
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Whether to include document content in response
 *         example: true
 *       - name: version
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Specific version to retrieve (defaults to current version)
 *         example: 2
 *     responses:
 *       200:
 *         description: Document retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Document retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     document:
 *                       $ref: '#/components/schemas/Document'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2023-12-01T10:30:00Z"
 *             examples:
 *               success:
 *                 summary: Successful document retrieval
 *                 value:
 *                   success: true
 *                   message: "Document retrieved successfully"
 *                   data:
 *                     document:
 *                       _id: "507f1f77bcf86cd799439013"
 *                       title: "Project Requirements Document"
 *                       content: "# Project Overview\n\nThis document outlines..."
 *                       contentType: "markdown"
 *                       owner:
 *                         _id: "507f1f77bcf86cd799439011"
 *                         name: "John Doe"
 *                         email: "john.doe@acme.com"
 *                       organization:
 *                         _id: "507f1f77bcf86cd799439012"
 *                         name: "Acme Corporation"
 *                         slug: "acme-corp"
 *                       tags: ["requirements", "project", "planning"]
 *                       status: "published"
 *                       visibility: "organization"
 *                       currentVersion: 3
 *                       metadata:
 *                         wordCount: 1250
 *                         readTime: 5
 *                         lastEditedBy:
 *                           _id: "507f1f77bcf86cd799439011"
 *                           name: "John Doe"
 *                       createdAt: "2023-11-15T14:30:00Z"
 *                       updatedAt: "2023-11-25T16:45:00Z"
 *                   timestamp: "2023-12-01T10:30:00Z"
 *       400:
 *         description: Invalid document ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               no_permission:
 *                 summary: No permission to view document
 *                 value:
 *                   success: false
 *                   message: "You don't have permission to view this document"
 *                   error:
 *                     code: "INSUFFICIENT_PERMISSIONS"
 *                   timestamp: "2023-12-01T10:30:00Z"
 *       404:
 *         description: Document not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               not_found:
 *                 summary: Document not found
 *                 value:
 *                   success: false
 *                   message: "Document not found"
 *                   error:
 *                     code: "DOCUMENT_NOT_FOUND"
 *                   timestamp: "2023-12-01T10:30:00Z"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id',
  validateObjectId('id'),
  handleValidationErrors,
  validateDocumentAccess('view'),
  getDocument
);

/**
 * @swagger
 * /api/documents:
 *   post:
 *     tags: [Documents]
 *     summary: Create a new document
 *     description: |
 *       Create a new document within the user's organization. The user becomes
 *       the owner of the document and can set initial content, tags, and visibility.
 *       Documents are automatically versioned starting at version 1.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateDocumentRequest'
 *           examples:
 *             basic_document:
 *               summary: Basic document creation
 *               value:
 *                 title: "New Project Proposal"
 *                 content: "# Project Proposal\n\nThis document outlines our new project initiative..."
 *                 contentType: "markdown"
 *                 tags: ["proposal", "project", "planning"]
 *                 visibility: "organization"
 *             template_document:
 *               summary: Template document creation
 *               value:
 *                 title: "Meeting Notes Template"
 *                 content: "# Meeting Notes\n\n**Date:** \n**Attendees:** \n\n## Agenda\n\n## Action Items"
 *                 contentType: "markdown"
 *                 isTemplate: true
 *                 visibility: "organization"
 *                 tags: ["template", "meetings"]
 *     responses:
 *       201:
 *         description: Document created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Document created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     document:
 *                       $ref: '#/components/schemas/Document'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2023-12-01T10:30:00Z"
 *             examples:
 *               success:
 *                 summary: Successful document creation
 *                 value:
 *                   success: true
 *                   message: "Document created successfully"
 *                   data:
 *                     document:
 *                       _id: "507f1f77bcf86cd799439018"
 *                       title: "New Project Proposal"
 *                       content: "# Project Proposal\n\nThis document outlines..."
 *                       contentType: "markdown"
 *                       owner:
 *                         _id: "507f1f77bcf86cd799439011"
 *                         name: "John Doe"
 *                         email: "john.doe@acme.com"
 *                       organization:
 *                         _id: "507f1f77bcf86cd799439012"
 *                         name: "Acme Corporation"
 *                         slug: "acme-corp"
 *                       tags: ["proposal", "project", "planning"]
 *                       status: "draft"
 *                       visibility: "organization"
 *                       currentVersion: 1
 *                       isTemplate: false
 *                       metadata:
 *                         wordCount: 45
 *                         readTime: 1
 *                       createdAt: "2023-12-01T10:30:00Z"
 *                       updatedAt: "2023-12-01T10:30:00Z"
 *                   timestamp: "2023-12-01T10:30:00Z"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               validation_error:
 *                 summary: Validation error
 *                 value:
 *                   success: false
 *                   message: "Validation failed"
 *                   error:
 *                     code: "VALIDATION_ERROR"
 *                     details:
 *                       - field: "title"
 *                         message: "Title is required"
 *                       - field: "content"
 *                         message: "Content exceeds maximum length"
 *                   timestamp: "2023-12-01T10:30:00Z"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/',
  requireEditor,
  documentLimiter,
  checkSubscriptionLimits('documents'),
  validateDocumentCreation,
  createDocument
);

/**
 * @route   PUT /api/documents/:id
 * @desc    Update a document with version tracking
 * @access  Private (Editor+)
 */
router.put('/:id',
  requireEditor,
  documentLimiter,
  validateObjectId('id'),
  validateDocumentAccess('edit'),
  validateDocumentUpdateWithVersioning,
  handleValidationErrors,
  updateDocument
);

/**
 * @route   DELETE /api/documents/:id
 * @desc    Delete a document (soft delete)
 * @access  Private (Admin or Owner)
 */
router.delete('/:id',
  validateObjectId('id'),
  handleValidationErrors,
  validateDocumentAccess('admin'),
  deleteDocument
);

/**
 * @route   POST /api/documents/:id/share
 * @desc    Share a document with another user
 * @access  Private (Admin or Owner)
 */
router.post('/:id/share',
  validateDocumentShare,
  shareDocument
);

/**
 * @route   DELETE /api/documents/:id/share/:userId
 * @desc    Remove document sharing
 * @access  Private (Admin or Owner)
 */
router.delete('/:id/share/:userId',
  [
    validateObjectId('id'),
    validateObjectId('userId'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { Document } = await import('../models/Document.js');
      const { Activity } = await import('../models/Activity.js');
      const { AppError } = await import('../middleware/errorHandler.js');

      const { id, userId: targetUserId } = req.params;
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

      // Check if user has permission to manage sharing
      if (!document.hasPermission(userId, 'admin') && document.owner.toString() !== userId) {
        throw new AppError('No permission to manage document sharing', 403, 'SHARE_ACCESS_DENIED');
      }

      // Remove sharing
      document.sharedWith = document.sharedWith.filter(
        share => share.user.toString() !== targetUserId
      );

      await document.save();

      // Log activity
      await Activity.logActivity(
        userId,
        organizationId,
        'document_unshared',
        `Document "${document.title}" sharing removed`,
        { documentId: document._id, targetUserId }
      );

      res.json({
        success: true,
        message: 'Document sharing removed successfully'
      });

    } catch (error) {
      const { logger } = await import('../config/logger.js');
      logger.error('Remove document sharing error:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to remove document sharing',
        code: 'UNSHARE_ERROR'
      });
    }
  }
);

/**
 * @route   GET /api/documents/:id/versions
 * @desc    Get document version history
 * @access  Private
 */
router.get('/:id/versions',
  validateObjectId('id'),
  handleValidationErrors,
  getDocumentVersions
);

/**
 * @route   GET /api/documents/:id/versions/:versionNumber
 * @desc    Get specific document version
 * @access  Private
 */
router.get('/:id/versions/:versionNumber',
  validateObjectId('id'),
  validateVersionNumber,
  handleValidationErrors,
  getDocumentVersion
);

/**
 * @route   POST /api/documents/:id/versions/:versionNumber/restore
 * @desc    Restore document to specific version
 * @access  Private (Editor+)
 */
router.post('/:id/versions/:versionNumber/restore',
  requireEditor,
  validateObjectId('id'),
  validateVersionRestore,
  handleValidationErrors,
  restoreDocumentVersion
);

/**
 * @route   GET /api/documents/:id/versions/compare
 * @desc    Compare two document versions
 * @access  Private
 */
router.get('/:id/versions/compare',
  validateObjectId('id'),
  validateVersionComparison,
  handleValidationErrors,
  compareDocumentVersions
);

/**
 * @route   GET /api/documents/:id/activity
 * @desc    Get document activity log
 * @access  Private
 */
router.get('/:id/activity',
  validateObjectId('id'),
  validateActivityQuery,
  validateDateRange,
  handleValidationErrors,
  getDocumentActivity
);

/**
 * @route   GET /api/documents/organization/activity
 * @desc    Get organization-wide activity log
 * @access  Private (Admin only)
 */
router.get('/organization/activity',
  requireAdmin,
  validateActivityQuery,
  validateDateRange,
  handleValidationErrors,
  getOrganizationActivity
);

/**
 * @route   POST /api/documents/:id/duplicate
 * @desc    Duplicate a document
 * @access  Private (Editor+)
 */
router.post('/:id/duplicate',
  [
    requireEditor,
    validateObjectId('id'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { Document } = await import('../models/Document.js');
      const { Activity } = await import('../models/Activity.js');
      const { AppError } = await import('../middleware/errorHandler.js');

      const { id } = req.params;
      const { title } = req.body;
      const userId = req.user.id;
      const organizationId = req.user.organization.id;

      const originalDocument = await Document.findOne({
        _id: id,
        organization: organizationId,
        status: { $ne: 'deleted' }
      });

      if (!originalDocument) {
        throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
      }

      // Check if user has permission to view original document
      if (!originalDocument.hasPermission(userId, 'viewer')) {
        throw new AppError('Access denied', 403, 'ACCESS_DENIED');
      }

      // Create duplicate
      const duplicateDocument = new Document({
        title: title || `Copy of ${originalDocument.title}`,
        content: originalDocument.content,
        contentType: originalDocument.contentType,
        owner: userId,
        organization: organizationId,
        folder: originalDocument.folder,
        tags: [...originalDocument.tags],
        visibility: 'private', // Always create as private
        status: 'draft'
      });

      await duplicateDocument.save();

      // Log activity
      await Activity.logActivity(
        userId,
        organizationId,
        'document_duplicated',
        `Document "${originalDocument.title}" duplicated as "${duplicateDocument.title}"`,
        {
          originalDocumentId: originalDocument._id,
          duplicateDocumentId: duplicateDocument._id
        }
      );

      // Populate response
      await duplicateDocument.populate([
        { path: 'owner', select: 'name email' },
        { path: 'folder', select: 'name path' }
      ]);

      res.status(201).json({
        success: true,
        message: 'Document duplicated successfully',
        data: { document: duplicateDocument }
      });

    } catch (error) {
      const { logger } = await import('../config/logger.js');
      logger.error('Duplicate document error:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to duplicate document',
        code: 'DUPLICATE_ERROR'
      });
    }
  }
);

export default router;
