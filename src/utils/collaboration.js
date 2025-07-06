import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { Document } from '../models/Document.js';
import { Activity } from '../models/Activity.js';
import { logger } from '../config/logger.js';

// Store active connections and document sessions
const activeConnections = new Map(); // userId -> socket
const documentSessions = new Map(); // documentId -> Set of userIds
const documentLocks = new Map(); // documentId -> { userId, timestamp }
const userCursors = new Map(); // documentId -> Map(userId -> cursorPosition)
const pendingOperations = new Map(); // documentId -> Array of operations

// Operational Transform utilities
class OperationalTransform {
  static transformOperation(op1, op2) {
    // Simple operational transform for text operations
    if (op1.type === 'insert' && op2.type === 'insert') {
      if (op1.position <= op2.position) {
        return {
          ...op2,
          position: op2.position + op1.content.length
        };
      }
      return op2;
    }

    if (op1.type === 'delete' && op2.type === 'insert') {
      if (op1.position < op2.position) {
        return {
          ...op2,
          position: Math.max(op1.position, op2.position - op1.length)
        };
      }
      return op2;
    }

    if (op1.type === 'insert' && op2.type === 'delete') {
      if (op1.position <= op2.position) {
        return {
          ...op2,
          position: op2.position + op1.content.length
        };
      }
      return op2;
    }

    if (op1.type === 'delete' && op2.type === 'delete') {
      if (op1.position < op2.position) {
        return {
          ...op2,
          position: Math.max(op1.position, op2.position - op1.length),
          length: op2.length
        };
      } else if (op1.position >= op2.position + op2.length) {
        return {
          ...op2,
          position: op2.position,
          length: op2.length
        };
      }
      // Overlapping deletes - complex case
      return null; // Skip conflicting operation
    }

    return op2;
  }

  static applyOperation(content, operation) {
    try {
      switch (operation.type) {
        case 'insert':
          return content.slice(0, operation.position) +
            operation.content +
            content.slice(operation.position);

        case 'delete':
          return content.slice(0, operation.position) +
            content.slice(operation.position + operation.length);

        case 'replace':
          return content.slice(0, operation.position) +
            operation.content +
            content.slice(operation.position + operation.oldLength);

        default:
          return content;
      }
    } catch (error) {
      logger.error('Error applying operation:', error);
      return content;
    }
  }
}

// Authentication middleware for WebSocket
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id)
      .populate('organization', 'name domain isActive subscription')
      .select('-password');

    if (!user || !user.isActive) {
      return next(new Error('User not found or inactive'));
    }

    if (!user.organization) {
      return next(new Error('User organization not found'));
    }

    if (!user.organization.isActive) {
      return next(new Error('Organization is inactive'));
    }

    // Validate organization subscription status
    if (user.organization.subscription && user.organization.subscription.status !== 'active') {
      return next(new Error('Organization subscription is not active'));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    socket.organizationId = user.organization._id.toString();
    socket.organizationDomain = user.organization.domain;

    // Log WebSocket connection for audit
    logger.info(`WebSocket connection established`, {
      userId: socket.userId,
      organizationId: socket.organizationId,
      organizationDomain: socket.organizationDomain,
      userAgent: socket.handshake.headers['user-agent'],
      ip: socket.handshake.address
    });

    next();
  } catch (error) {
    logger.error('WebSocket authentication error:', error);
    next(new Error('Authentication failed'));
  }
};

// Check document access permissions with enhanced organization isolation
const checkDocumentAccess = async (userId, documentId, organizationId, permission = 'view') => {
  try {
    const document = await Document.findOne({
      _id: documentId,
      organization: organizationId,
      status: { $ne: 'deleted' }
    }).populate('owner', 'name email organization');

    if (!document) {
      return { hasAccess: false, error: 'Document not found' };
    }

    // Double-check organization isolation
    if (document.organization.toString() !== organizationId.toString()) {
      logger.warn(`WebSocket cross-organization access attempt: User ${userId} tried to access document ${documentId} from different organization`);
      return { hasAccess: false, error: 'Cross-organization access denied' };
    }

    // Verify document owner belongs to same organization
    if (document.owner.organization && document.owner.organization.toString() !== organizationId.toString()) {
      logger.warn(`Document owner organization mismatch: Document ${documentId} owner belongs to different organization`);
      return { hasAccess: false, error: 'Document owner organization mismatch' };
    }

    // Owner has full access
    if (document.owner._id.toString() === userId) {
      return { hasAccess: true, document, role: 'owner' };
    }

    // Check shared access
    const sharedAccess = document.sharedWith.find(
      share => share.user.toString() === userId && share.isActive
    );

    if (!sharedAccess) {
      // Check if document is organization-wide visible
      if (document.visibility === 'organization' && permission === 'view') {
        return { hasAccess: true, document, role: 'viewer' };
      }
      return { hasAccess: false, error: 'Access denied' };
    }

    // Check if access has expired
    if (sharedAccess.expiresAt && new Date() > sharedAccess.expiresAt) {
      return { hasAccess: false, error: 'Access expired' };
    }

    // Check permission level
    const permissionLevels = { view: 1, comment: 2, edit: 3 };
    const requiredLevel = permissionLevels[permission] || 1;
    const userLevel = permissionLevels[sharedAccess.permission] || 1;

    if (userLevel < requiredLevel) {
      return { hasAccess: false, error: 'Insufficient permissions' };
    }

    return {
      hasAccess: true,
      document,
      role: 'collaborator',
      permission: sharedAccess.permission
    };

  } catch (error) {
    logger.error('Error checking document access:', error);
    return { hasAccess: false, error: 'Access check failed' };
  }
};

// Process pending operations for a document
const processPendingOperations = async (documentId) => {
  const operations = pendingOperations.get(documentId) || [];
  if (operations.length === 0) return;

  try {
    // Get current document
    const document = await Document.findById(documentId);
    if (!document) return;

    let content = document.content;
    const processedOps = [];

    // Apply operations in order with conflict resolution
    for (let i = 0; i < operations.length; i++) {
      const currentOp = operations[i];

      // Transform against all previous operations
      let transformedOp = currentOp;
      for (let j = 0; j < i; j++) {
        const prevOp = processedOps[j];
        if (prevOp) {
          transformedOp = OperationalTransform.transformOperation(prevOp, transformedOp);
          if (!transformedOp) break; // Skip conflicting operation
        }
      }

      if (transformedOp) {
        content = OperationalTransform.applyOperation(content, transformedOp);
        processedOps.push(transformedOp);
      }
    }

    // Update document with new content
    document.content = content;
    document.version += 1;
    document.updatedAt = new Date();
    await document.save();

    // Clear processed operations
    pendingOperations.delete(documentId);

    return { success: true, newContent: content, version: document.version };

  } catch (error) {
    logger.error('Error processing pending operations:', error);
    return { success: false, error: error.message };
  }
};

// WebSocket event handlers
export const initializeWebSocket = (io) => {
  // Apply authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    logger.info(`User ${socket.user.name} connected via WebSocket`);

    // Store active connection
    activeConnections.set(socket.userId, socket);

    // Handle joining a document room
    socket.on('join-document', async (data) => {
      try {
        const { documentId } = data;

        if (!documentId) {
          socket.emit('error', { message: 'Document ID required' });
          return;
        }

        // Check access permissions
        const accessCheck = await checkDocumentAccess(
          socket.userId,
          documentId,
          socket.organizationId,
          'view'
        );

        if (!accessCheck.hasAccess) {
          socket.emit('error', { message: accessCheck.error });
          return;
        }

        const { document, permission } = accessCheck;

        // Join document room
        socket.join(`document:${documentId}`);
        socket.currentDocument = documentId;
        socket.documentPermission = permission;

        // Add user to document session
        if (!documentSessions.has(documentId)) {
          documentSessions.set(documentId, new Set());
        }
        documentSessions.get(documentId).add(socket.userId);

        // Initialize cursor tracking for document
        if (!userCursors.has(documentId)) {
          userCursors.set(documentId, new Map());
        }

        // Get current active users in document
        const activeUsers = Array.from(documentSessions.get(documentId))
          .map(userId => {
            const userSocket = activeConnections.get(userId);
            return userSocket ? {
              id: userId,
              name: userSocket.user.name,
              email: userSocket.user.email,
              permission: userSocket.documentPermission,
              cursor: userCursors.get(documentId).get(userId) || null
            } : null;
          })
          .filter(Boolean);

        // Send document data and active users
        socket.emit('document-joined', {
          document: {
            id: document._id,
            title: document.title,
            content: document.content,
            version: document.version,
            lastModified: document.updatedAt
          },
          activeUsers,
          permission
        });

        // Notify other users about new collaborator
        socket.to(`document:${documentId}`).emit('user-joined', {
          user: {
            id: socket.userId,
            name: socket.user.name,
            email: socket.user.email,
            permission
          }
        });

        logger.info(`User ${socket.user.name} joined document ${documentId}`);

      } catch (error) {
        logger.error('Error joining document:', error);
        socket.emit('error', { message: 'Failed to join document' });
      }
    });

    // Handle document editing operations
    socket.on('document-operation', async (data) => {
      try {
        const { documentId, operation } = data;

        if (!documentId || !operation) {
          socket.emit('error', { message: 'Document ID and operation required' });
          return;
        }

        // Check edit permissions
        const accessCheck = await checkDocumentAccess(
          socket.userId,
          documentId,
          socket.organizationId,
          'edit'
        );

        if (!accessCheck.hasAccess) {
          socket.emit('error', { message: accessCheck.error });
          return;
        }

        // Add operation to pending queue
        if (!pendingOperations.has(documentId)) {
          pendingOperations.set(documentId, []);
        }

        const operationWithMeta = {
          ...operation,
          userId: socket.userId,
          timestamp: new Date(),
          id: `${socket.userId}-${Date.now()}-${Math.random()}`
        };

        pendingOperations.get(documentId).push(operationWithMeta);

        // Broadcast operation to other users in the document
        socket.to(`document:${documentId}`).emit('document-operation', {
          operation: operationWithMeta,
          user: {
            id: socket.userId,
            name: socket.user.name
          }
        });

        // Process operations periodically (debounced)
        setTimeout(async () => {
          const result = await processPendingOperations(documentId);
          if (result && result.success) {
            // Broadcast updated content to all users
            socket.to(`document:${documentId}`).emit('document-updated', {
              content: result.newContent,
              version: result.version
            });

            socket.emit('document-updated', {
              content: result.newContent,
              version: result.version
            });
          }
        }, 500); // 500ms debounce

        // Log activity
        await Activity.create({
          user: socket.userId,
          organization: socket.organizationId,
          action: 'document_edit',
          resource: 'document',
          resourceId: documentId,
          details: {
            operation: operation.type,
            position: operation.position,
            contentLength: operation.content?.length || operation.length
          }
        });

      } catch (error) {
        logger.error('Error processing document operation:', error);
        socket.emit('error', { message: 'Failed to process operation' });
      }
    });

    // Handle cursor position updates
    socket.on('cursor-position', (data) => {
      try {
        const { documentId, position } = data;

        if (!documentId || position === undefined) {
          return;
        }

        // Update cursor position
        if (userCursors.has(documentId)) {
          userCursors.get(documentId).set(socket.userId, position);

          // Broadcast cursor position to other users
          socket.to(`document:${documentId}`).emit('cursor-update', {
            userId: socket.userId,
            userName: socket.user.name,
            position
          });
        }

      } catch (error) {
        logger.error('Error updating cursor position:', error);
      }
    });

    // Handle leaving a document
    socket.on('leave-document', (data) => {
      try {
        const { documentId } = data;

        if (documentId && socket.currentDocument === documentId) {
          // Remove from document session
          if (documentSessions.has(documentId)) {
            documentSessions.get(documentId).delete(socket.userId);

            // Clean up empty sessions
            if (documentSessions.get(documentId).size === 0) {
              documentSessions.delete(documentId);
              userCursors.delete(documentId);
              documentLocks.delete(documentId);
            }
          }

          // Remove cursor
          if (userCursors.has(documentId)) {
            userCursors.get(documentId).delete(socket.userId);
          }

          // Leave socket room
          socket.leave(`document:${documentId}`);

          // Notify other users
          socket.to(`document:${documentId}`).emit('user-left', {
            userId: socket.userId,
            userName: socket.user.name
          });

          socket.currentDocument = null;
          socket.documentPermission = null;

          logger.info(`User ${socket.user.name} left document ${documentId}`);
        }

      } catch (error) {
        logger.error('Error leaving document:', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      try {
        logger.info(`User ${socket.user.name} disconnected from WebSocket`);

        // Clean up active connection
        activeConnections.delete(socket.userId);

        // Clean up document sessions
        if (socket.currentDocument) {
          const documentId = socket.currentDocument;

          if (documentSessions.has(documentId)) {
            documentSessions.get(documentId).delete(socket.userId);

            // Clean up empty sessions
            if (documentSessions.get(documentId).size === 0) {
              documentSessions.delete(documentId);
              userCursors.delete(documentId);
              documentLocks.delete(documentId);
            }
          }

          // Remove cursor
          if (userCursors.has(documentId)) {
            userCursors.get(documentId).delete(socket.userId);
          }

          // Notify other users
          socket.to(`document:${documentId}`).emit('user-left', {
            userId: socket.userId,
            userName: socket.user.name
          });
        }

      } catch (error) {
        logger.error('Error handling disconnect:', error);
      }
    });

  });
};
