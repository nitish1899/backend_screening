import crypto from 'crypto';
import { Activity } from '../models/Activity.js';

/**
 * Generate checksum for content
 * @param {string} content - Content to generate checksum for
 * @returns {string} SHA-256 checksum
 */
export const generateChecksum = (content) => {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
};

/**
 * Calculate content size in bytes
 * @param {string} content - Content to calculate size for
 * @returns {number} Size in bytes
 */
export const calculateContentSize = (content) => {
  return Buffer.byteLength(content, 'utf8');
};

/**
 * Generate a simple diff between two text strings
 * @param {string} oldText - Original text
 * @param {string} newText - New text
 * @returns {Object} Diff object with changes
 */
export const generateTextDiff = (oldText, newText) => {
  const changes = [];
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  
  const maxLines = Math.max(oldLines.length, newLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i] || '';
    const newLine = newLines[i] || '';
    
    if (oldLine !== newLine) {
      changes.push({
        lineNumber: i + 1,
        type: !oldLine ? 'addition' : !newLine ? 'deletion' : 'modification',
        oldContent: oldLine,
        newContent: newLine
      });
    }
  }
  
  return {
    changes,
    summary: {
      totalChanges: changes.length,
      additions: changes.filter(c => c.type === 'addition').length,
      deletions: changes.filter(c => c.type === 'deletion').length,
      modifications: changes.filter(c => c.type === 'modification').length
    }
  };
};

/**
 * Create a version snapshot with metadata
 * @param {Object} document - Document object
 * @param {string} userId - User ID making the change
 * @param {string} changeDescription - Description of changes
 * @returns {Object} Version object
 */
export const createVersionSnapshot = (document, userId, changeDescription = '') => {
  const content = document.content || '';
  
  return {
    content,
    title: document.title,
    versionNumber: (document.versions?.length || 0) + 1,
    changeDescription,
    editedBy: userId,
    size: calculateContentSize(content),
    checksum: generateChecksum(content),
    createdAt: new Date()
  };
};

/**
 * Validate version restore operation
 * @param {Object} document - Document object
 * @param {number} versionNumber - Version number to restore
 * @param {string} userId - User ID performing restore
 * @returns {Object} Validation result
 */
export const validateVersionRestore = (document, versionNumber, userId) => {
  const errors = [];
  
  if (!document) {
    errors.push('Document not found');
  }
  
  if (!document.versions || document.versions.length === 0) {
    errors.push('No versions available for this document');
  }
  
  const targetVersion = document.versions.find(v => v.versionNumber === versionNumber);
  if (!targetVersion) {
    errors.push(`Version ${versionNumber} not found`);
  }
  
  if (document.currentVersion === versionNumber) {
    errors.push('Cannot restore to current version');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    targetVersion
  };
};

/**
 * Get version statistics for a document
 * @param {Object} document - Document object
 * @returns {Object} Version statistics
 */
export const getVersionStatistics = (document) => {
  if (!document.versions || document.versions.length === 0) {
    return {
      totalVersions: 0,
      oldestVersion: null,
      newestVersion: null,
      averageSize: 0,
      totalSize: 0,
      contributors: []
    };
  }
  
  const versions = document.versions;
  const totalSize = versions.reduce((sum, v) => sum + (v.size || 0), 0);
  const contributors = [...new Set(versions.map(v => v.editedBy?.toString()).filter(Boolean))];
  
  return {
    totalVersions: versions.length,
    oldestVersion: versions[0],
    newestVersion: versions[versions.length - 1],
    averageSize: Math.round(totalSize / versions.length),
    totalSize,
    contributors: contributors.length,
    sizeGrowth: versions.length > 1 ? 
      ((versions[versions.length - 1].size || 0) - (versions[0].size || 0)) : 0
  };
};

/**
 * Clean up old versions based on retention policy
 * @param {Object} document - Document object
 * @param {Object} retentionPolicy - Retention policy settings
 * @returns {Array} Removed versions
 */
export const cleanupOldVersions = (document, retentionPolicy = {}) => {
  const {
    maxVersions = 50,
    maxAge = 365, // days
    keepMajorVersions = true
  } = retentionPolicy;
  
  if (!document.versions || document.versions.length <= maxVersions) {
    return [];
  }
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAge);
  
  const versionsToKeep = [];
  const versionsToRemove = [];
  
  // Sort versions by creation date (newest first)
  const sortedVersions = [...document.versions].sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );
  
  sortedVersions.forEach((version, index) => {
    const shouldKeep = 
      index < maxVersions || // Keep within max limit
      new Date(version.createdAt) > cutoffDate || // Keep recent versions
      (keepMajorVersions && version.changeDescription?.toLowerCase().includes('major'));
    
    if (shouldKeep) {
      versionsToKeep.push(version);
    } else {
      versionsToRemove.push(version);
    }
  });
  
  // Update document versions
  document.versions = versionsToKeep.sort((a, b) => a.versionNumber - b.versionNumber);
  
  return versionsToRemove;
};

/**
 * Log version-related activity
 * @param {string} action - Activity action
 * @param {Object} params - Activity parameters
 */
export const logVersionActivity = async (action, params) => {
  const {
    userId,
    organizationId,
    documentId,
    documentTitle,
    versionNumber,
    details,
    metadata = {}
  } = params;
  
  try {
    await Activity.logActivity({
      user: userId,
      organization: organizationId,
      document: documentId,
      action,
      details: details || `${action.replace('_', ' ')} for document "${documentTitle}"`,
      category: 'document',
      severity: action.includes('restored') ? 'medium' : 'low',
      metadata: {
        versionNumber,
        ...metadata
      }
    });
  } catch (error) {
    console.error('Failed to log version activity:', error);
  }
};

/**
 * Export version data for backup or migration
 * @param {Object} document - Document object
 * @param {Object} options - Export options
 * @returns {Object} Exported version data
 */
export const exportVersionData = (document, options = {}) => {
  const {
    includeContent = true,
    includeMetadata = true,
    versionRange = null
  } = options;
  
  let versions = document.versions || [];
  
  if (versionRange) {
    const { start, end } = versionRange;
    versions = versions.filter(v => 
      v.versionNumber >= start && v.versionNumber <= end
    );
  }
  
  return {
    documentId: document._id,
    documentTitle: document.title,
    currentVersion: document.currentVersion,
    exportDate: new Date(),
    versions: versions.map(version => ({
      versionNumber: version.versionNumber,
      ...(includeContent && { content: version.content }),
      ...(includeMetadata && {
        title: version.title,
        changeDescription: version.changeDescription,
        editedBy: version.editedBy,
        size: version.size,
        checksum: version.checksum,
        createdAt: version.createdAt
      })
    })),
    statistics: getVersionStatistics(document)
  };
};
