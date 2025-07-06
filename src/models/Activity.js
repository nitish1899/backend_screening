import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User is required for activity tracking'],
        index: true
    },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'Organization is required for activity tracking'],
        index: true
    },
    document: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
        index: true
    },
    action: {
        type: String,
        enum: {
            values: [
                'document_created', 'document_updated', 'document_viewed', 'document_shared',
                'document_unshared', 'document_deleted', 'document_restored', 'document_archived',
                'document_published', 'document_duplicated', 'document_exported',
                'version_created', 'version_restored', 'version_viewed', 'version_compared',
                'activity_viewed', 'organization_activity_viewed',
                'user_invited', 'user_removed', 'user_role_changed',
                'organization_created', 'organization_updated',
                'login', 'logout', 'password_changed', 'profile_updated'
            ],
            message: 'Invalid activity action'
        },
        required: [true, 'Action is required'],
        index: true
    },
    details: {
        type: String,
        maxlength: [1000, 'Details cannot exceed 1000 characters'],
        default: ''
    },
    metadata: {
        ipAddress: {
            type: String,
            validate: {
                validator: function (v) {
                    if (!v) return true;
                    // Basic IP validation (IPv4 and IPv6)
                    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
                    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
                    return ipv4Regex.test(v) || ipv6Regex.test(v);
                },
                message: 'Invalid IP address format'
            }
        },
        userAgent: {
            type: String,
            maxlength: [500, 'User agent cannot exceed 500 characters']
        },
        sessionId: String,
        deviceType: {
            type: String,
            enum: ['desktop', 'mobile', 'tablet', 'unknown'],
            default: 'unknown'
        },
        browser: String,
        os: String,
        location: {
            country: String,
            city: String,
            timezone: String
        }
    },
    changes: {
        before: mongoose.Schema.Types.Mixed,
        after: mongoose.Schema.Types.Mixed,
        fields: [String]
    },
    relatedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low'
    },
    category: {
        type: String,
        enum: ['document', 'user', 'organization', 'security', 'system'],
        required: true,
        index: true
    },
    isSystemGenerated: {
        type: Boolean,
        default: false
    },
    tags: [{
        type: String,
        lowercase: true,
        trim: true
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance and multi-tenancy
activitySchema.index({ organization: 1, createdAt: -1 });
activitySchema.index({ organization: 1, user: 1, createdAt: -1 });
activitySchema.index({ organization: 1, document: 1, createdAt: -1 });
activitySchema.index({ organization: 1, action: 1, createdAt: -1 });
activitySchema.index({ organization: 1, category: 1, createdAt: -1 });
activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ document: 1, createdAt: -1 });
activitySchema.index({ createdAt: -1 }); // For cleanup operations
activitySchema.index({ severity: 1, createdAt: -1 });

// TTL index for automatic cleanup (optional - remove old activities after 1 year)
activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 }); // 365 days

// Virtual for human-readable action
activitySchema.virtual('actionDisplay').get(function () {
    return this.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
});

// Static method to log activity with proper multi-tenancy
activitySchema.statics.logActivity = async function (data) {
    const {
        user,
        organization,
        document,
        action,
        details = '',
        metadata = {},
        changes = {},
        relatedUsers = [],
        severity = 'low',
        category,
        tags = []
    } = data;

    // Determine category if not provided
    let activityCategory = category;
    if (!activityCategory) {
        if (action.startsWith('document_')) activityCategory = 'document';
        else if (action.startsWith('user_')) activityCategory = 'user';
        else if (action.startsWith('organization_')) activityCategory = 'organization';
        else if (['login', 'logout', 'password_changed'].includes(action)) activityCategory = 'security';
        else activityCategory = 'system';
    }

    try {
        const activity = new this({
            user,
            organization,
            document,
            action,
            details,
            metadata,
            changes,
            relatedUsers,
            severity,
            category: activityCategory,
            tags
        });

        return await activity.save();
    } catch (error) {
        console.error('Failed to log activity:', error);
        // Don't throw error to prevent breaking main functionality
        return null;
    }
};

// Static method to get activities for organization
activitySchema.statics.getOrganizationActivities = function (organizationId, options = {}) {
    const {
        limit = 50,
        skip = 0,
        category,
        action,
        user,
        document,
        startDate,
        endDate,
        severity
    } = options;

    const query = { organization: organizationId };

    if (category) query.category = category;
    if (action) query.action = action;
    if (user) query.user = user;
    if (document) query.document = document;
    if (severity) query.severity = severity;

    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    return this.find(query)
        .populate('user', 'name email')
        .populate('document', 'title')
        .populate('relatedUsers', 'name email')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);
};

// Static method to get user activities
activitySchema.statics.getUserActivities = function (userId, organizationId, options = {}) {
    const { limit = 20, skip = 0 } = options;

    return this.find({
        user: userId,
        organization: organizationId
    })
        .populate('document', 'title')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);
};

// Static method to get document activities
activitySchema.statics.getDocumentActivities = function (documentId, organizationId, options = {}) {
    const { limit = 30, skip = 0 } = options;

    return this.find({
        document: documentId,
        organization: organizationId
    })
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);
};

// Static method to get activity statistics
activitySchema.statics.getActivityStats = async function (organizationId, options = {}) {
    const { startDate, endDate, category, action } = options;

    const matchQuery = { organization: organizationId };

    if (startDate || endDate) {
        matchQuery.createdAt = {};
        if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
        if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    if (category) matchQuery.category = category;
    if (action) matchQuery.action = action;

    const stats = await this.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: {
                    category: '$category',
                    action: '$action'
                },
                count: { $sum: 1 },
                lastActivity: { $max: '$createdAt' },
                users: { $addToSet: '$user' }
            }
        },
        {
            $group: {
                _id: '$_id.category',
                actions: {
                    $push: {
                        action: '$_id.action',
                        count: '$count',
                        lastActivity: '$lastActivity',
                        uniqueUsers: { $size: '$users' }
                    }
                },
                totalCount: { $sum: '$count' }
            }
        },
        { $sort: { totalCount: -1 } }
    ]);

    return stats;
};

// Static method to get user activity summary
activitySchema.statics.getUserActivitySummary = async function (userId, organizationId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const summary = await this.aggregate([
        {
            $match: {
                user: userId,
                organization: organizationId,
                createdAt: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                },
                activities: { $sum: 1 },
                categories: { $addToSet: '$category' },
                actions: { $addToSet: '$action' }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    return summary;
};

// Static method to track document changes
activitySchema.statics.trackDocumentChange = async function (documentId, userId, organizationId, changes, action = 'document_updated') {
    const changeDetails = {
        fieldsChanged: Object.keys(changes),
        changeCount: Object.keys(changes).length
    };

    // Determine severity based on changes
    let severity = 'low';
    if (changes.content || changes.title) severity = 'medium';
    if (changes.status === 'deleted' || changes.visibility) severity = 'high';

    return await this.logActivity({
        user: userId,
        organization: organizationId,
        document: documentId,
        action,
        details: `Document updated: ${changeDetails.fieldsChanged.join(', ')}`,
        changes: {
            before: changes.before || {},
            after: changes.after || {},
            fields: changeDetails.fieldsChanged
        },
        metadata: changeDetails,
        category: 'document',
        severity
    });
};

export const Activity = mongoose.model('Activity', activitySchema);
