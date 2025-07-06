import { logger } from '../config/logger.js';
import { Activity } from '../models/Activity.js';

/**
 * Multi-tenant audit utilities for detecting and preventing cross-organization data access
 */

// Track potentially dangerous queries that might bypass organization filtering
const auditQuery = (model, query, operation, userId, organizationId) => {
  const modelName = model.modelName;
  
  // Check if query includes organization filter
  const hasOrgFilter = query.organization || 
                      (query.$and && query.$and.some(condition => condition.organization)) ||
                      (query.$or && query.$or.some(condition => condition.organization));

  if (!hasOrgFilter && !isExemptModel(modelName)) {
    logger.warn(`Potential cross-tenant query detected`, {
      model: modelName,
      operation,
      query: JSON.stringify(query),
      userId,
      organizationId,
      timestamp: new Date().toISOString()
    });

    // Log security event
    logSecurityEvent({
      category: 'security',
      action: 'potential_cross_tenant_query',
      severity: 'medium',
      user: userId,
      organization: organizationId,
      metadata: {
        model: modelName,
        operation,
        query: JSON.stringify(query)
      }
    });

    return false;
  }

  return true;
};

// Models that are exempt from organization filtering (global models)
const isExemptModel = (modelName) => {
  const exemptModels = ['Organization', 'SystemLog', 'GlobalSettings'];
  return exemptModels.includes(modelName);
};

// Enhanced query wrapper that enforces organization filtering
export const createSecureQuery = (model, baseQuery = {}, organizationId) => {
  if (!organizationId) {
    throw new Error('Organization ID is required for secure queries');
  }

  if (isExemptModel(model.modelName)) {
    return baseQuery;
  }

  // Always add organization filter
  const secureQuery = {
    ...baseQuery,
    organization: organizationId
  };

  return secureQuery;
};

// Middleware to wrap Mongoose queries with audit logging
export const auditQueryMiddleware = function(next) {
  const query = this.getQuery();
  const model = this.model;
  const operation = this.op;
  
  // Get user context from request (if available)
  const req = this.options.req;
  const userId = req?.user?.id;
  const organizationId = req?.user?.organization?.id;

  if (userId && organizationId) {
    auditQuery(model, query, operation, userId, organizationId);
  }

  next();
};

// Validate that aggregation pipelines include organization filtering
export const validateAggregationPipeline = (pipeline, organizationId, modelName) => {
  if (isExemptModel(modelName)) {
    return true;
  }

  // Check if first stage includes organization match
  const firstStage = pipeline[0];
  if (!firstStage || !firstStage.$match) {
    logger.warn(`Aggregation pipeline missing $match stage for organization filtering`, {
      model: modelName,
      organizationId,
      pipeline: JSON.stringify(pipeline)
    });
    return false;
  }

  const matchStage = firstStage.$match;
  if (!matchStage.organization) {
    logger.warn(`Aggregation pipeline missing organization filter`, {
      model: modelName,
      organizationId,
      pipeline: JSON.stringify(pipeline)
    });
    return false;
  }

  return true;
};

// Enhanced population validation to prevent cross-tenant data exposure
export const validatePopulation = (populateOptions, organizationId) => {
  if (!Array.isArray(populateOptions)) {
    populateOptions = [populateOptions];
  }

  return populateOptions.map(option => {
    if (typeof option === 'string') {
      return option; // Simple field population
    }

    if (option.match && !option.match.organization) {
      // Add organization filter to population match
      option.match = {
        ...option.match,
        organization: organizationId
      };
    }

    return option;
  });
};

// Log security events for audit trail
const logSecurityEvent = async (eventData) => {
  try {
    await Activity.create({
      ...eventData,
      timestamp: new Date(),
      source: 'multi_tenant_audit'
    });
  } catch (error) {
    logger.error('Failed to log security event:', error);
  }
};

// Validate document sharing to prevent cross-organization exposure
export const validateDocumentSharing = (document, targetUserIds, organizationId) => {
  const errors = [];

  // Ensure document belongs to the organization
  if (document.organization.toString() !== organizationId.toString()) {
    errors.push('Document does not belong to the current organization');
  }

  // Validate that all target users belong to the same organization
  // This would need to be called with user validation
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Create organization-scoped database connection wrapper
export const createOrgScopedModel = (Model, organizationId) => {
  return {
    find: (query = {}, ...args) => {
      const secureQuery = createSecureQuery(Model, query, organizationId);
      return Model.find(secureQuery, ...args);
    },
    
    findOne: (query = {}, ...args) => {
      const secureQuery = createSecureQuery(Model, query, organizationId);
      return Model.findOne(secureQuery, ...args);
    },
    
    findById: (id, ...args) => {
      const secureQuery = createSecureQuery(Model, { _id: id }, organizationId);
      return Model.findOne(secureQuery, ...args);
    },
    
    countDocuments: (query = {}, ...args) => {
      const secureQuery = createSecureQuery(Model, query, organizationId);
      return Model.countDocuments(secureQuery, ...args);
    },
    
    aggregate: (pipeline, ...args) => {
      if (!validateAggregationPipeline(pipeline, organizationId, Model.modelName)) {
        throw new Error('Aggregation pipeline must include organization filtering');
      }
      return Model.aggregate(pipeline, ...args);
    },
    
    create: (doc, ...args) => {
      if (Array.isArray(doc)) {
        doc = doc.map(d => ({ ...d, organization: organizationId }));
      } else {
        doc = { ...doc, organization: organizationId };
      }
      return Model.create(doc, ...args);
    },
    
    updateOne: (query = {}, update, ...args) => {
      const secureQuery = createSecureQuery(Model, query, organizationId);
      return Model.updateOne(secureQuery, update, ...args);
    },
    
    updateMany: (query = {}, update, ...args) => {
      const secureQuery = createSecureQuery(Model, query, organizationId);
      return Model.updateMany(secureQuery, update, ...args);
    },
    
    deleteOne: (query = {}, ...args) => {
      const secureQuery = createSecureQuery(Model, query, organizationId);
      return Model.deleteOne(secureQuery, ...args);
    },
    
    deleteMany: (query = {}, ...args) => {
      const secureQuery = createSecureQuery(Model, query, organizationId);
      return Model.deleteMany(secureQuery, ...args);
    }
  };
};

// Audit existing data for cross-tenant contamination
export const auditDataIntegrity = async (organizationId) => {
  const results = {
    organizationId,
    timestamp: new Date(),
    issues: [],
    summary: {
      documentsChecked: 0,
      usersChecked: 0,
      activitiesChecked: 0,
      issuesFound: 0
    }
  };

  try {
    const { Document } = await import('../models/Document.js');
    const { User } = await import('../models/User.js');
    const { Activity } = await import('../models/Activity.js');

    // Check documents
    const documents = await Document.find({ organization: organizationId });
    results.summary.documentsChecked = documents.length;

    for (const doc of documents) {
      // Check if owner belongs to same organization
      const owner = await User.findById(doc.owner);
      if (owner && owner.organization.toString() !== organizationId.toString()) {
        results.issues.push({
          type: 'cross_org_document_owner',
          documentId: doc._id,
          ownerId: doc.owner,
          ownerOrganization: owner.organization
        });
      }

      // Check shared users
      for (const share of doc.sharedWith) {
        const sharedUser = await User.findById(share.user);
        if (sharedUser && sharedUser.organization.toString() !== organizationId.toString()) {
          results.issues.push({
            type: 'cross_org_document_share',
            documentId: doc._id,
            sharedUserId: share.user,
            sharedUserOrganization: sharedUser.organization
          });
        }
      }
    }

    // Check users
    const users = await User.find({ organization: organizationId });
    results.summary.usersChecked = users.length;

    // Check activities
    const activities = await Activity.find({ organization: organizationId });
    results.summary.activitiesChecked = activities.length;

    for (const activity of activities) {
      const user = await User.findById(activity.user);
      if (user && user.organization.toString() !== organizationId.toString()) {
        results.issues.push({
          type: 'cross_org_activity',
          activityId: activity._id,
          userId: activity.user,
          userOrganization: user.organization
        });
      }
    }

    results.summary.issuesFound = results.issues.length;

    // Log audit results
    logger.info(`Data integrity audit completed for organization ${organizationId}`, results.summary);

    if (results.issues.length > 0) {
      logger.warn(`Data integrity issues found for organization ${organizationId}`, {
        issueCount: results.issues.length,
        issues: results.issues
      });
    }

    return results;
  } catch (error) {
    logger.error('Data integrity audit failed:', error);
    throw error;
  }
};

export default {
  auditQuery,
  createSecureQuery,
  auditQueryMiddleware,
  validateAggregationPipeline,
  validatePopulation,
  validateDocumentSharing,
  createOrgScopedModel,
  auditDataIntegrity
};
