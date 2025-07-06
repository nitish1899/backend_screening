import mongoose from 'mongoose';

const versionSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true
    },
    title: String,
    versionNumber: {
        type: Number,
        required: true
    },
    changeDescription: {
        type: String,
        maxlength: [500, 'Change description cannot exceed 500 characters']
    },
    editedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    size: {
        type: Number,
        default: 0
    },
    checksum: String
}, {
    timestamps: true
});

const shareSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    permission: {
        type: String,
        enum: {
            values: ['viewer', 'editor', 'admin'],
            message: 'Permission must be viewer, editor, or admin'
        },
        default: 'viewer'
    },
    sharedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sharedAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: Date,
    isActive: {
        type: Boolean,
        default: true
    }
});

const documentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Document title is required'],
        trim: true,
        minlength: [1, 'Title must be at least 1 character long'],
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    content: {
        type: String,
        default: '',
        maxlength: [1048576, 'Content cannot exceed 1MB'] // 1MB limit
    },
    contentType: {
        type: String,
        enum: ['text', 'markdown', 'html', 'json'],
        default: 'text'
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Document owner is required'],
        index: true
    },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'Organization is required'],
        index: true
    },
    folder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder',
        default: null
    },
    tags: [{
        type: String,
        trim: true,
        lowercase: true,
        maxlength: [50, 'Tag cannot exceed 50 characters']
    }],
    status: {
        type: String,
        enum: {
            values: ['draft', 'published', 'archived', 'deleted'],
            message: 'Status must be draft, published, archived, or deleted'
        },
        default: 'draft'
    },
    visibility: {
        type: String,
        enum: {
            values: ['private', 'organization', 'public'],
            message: 'Visibility must be private, organization, or public'
        },
        default: 'private'
    },
    sharedWith: [shareSchema],
    versions: [versionSchema],
    currentVersion: {
        type: Number,
        default: 1,
        min: 1
    },
    isTemplate: {
        type: Boolean,
        default: false
    },
    templateCategory: {
        type: String,
        enum: ['meeting', 'project', 'report', 'proposal', 'other'],
        required: function () { return this.isTemplate; }
    },
    metadata: {
        size: {
            type: Number,
            default: 0,
            min: 0
        },
        wordCount: {
            type: Number,
            default: 0,
            min: 0
        },
        readTime: {
            type: Number,
            default: 0,
            min: 0
        },
        language: {
            type: String,
            default: 'en'
        },
        lastEditedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        collaborators: [{
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            lastAccessed: {
                type: Date,
                default: Date.now
            },
            role: {
                type: String,
                enum: ['viewer', 'editor'],
                default: 'viewer'
            }
        }]
    },
    settings: {
        allowComments: {
            type: Boolean,
            default: true
        },
        allowDownload: {
            type: Boolean,
            default: true
        },
        allowPrint: {
            type: Boolean,
            default: true
        },
        allowCopy: {
            type: Boolean,
            default: true
        },
        trackChanges: {
            type: Boolean,
            default: false
        },
        autoSave: {
            type: Boolean,
            default: true
        },
        autoSaveInterval: {
            type: Number,
            default: 30000, // 30 seconds
            min: 5000 // minimum 5 seconds
        }
    },
    encryption: {
        isEncrypted: {
            type: Boolean,
            default: false
        },
        algorithm: String,
        keyId: String
    },
    publishedAt: Date,
    archivedAt: Date,
    deletedAt: Date
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            // Don't expose encryption details
            if (ret.encryption) {
                delete ret.encryption.keyId;
            }
            return ret;
        }
    },
    toObject: { virtuals: true }
});

// Indexes for performance and multi-tenancy
documentSchema.index({ organization: 1, owner: 1 });
documentSchema.index({ organization: 1, status: 1 });
documentSchema.index({ organization: 1, visibility: 1 });
documentSchema.index({ organization: 1, title: 'text', content: 'text' });
documentSchema.index({ organization: 1, tags: 1 });
documentSchema.index({ organization: 1, createdAt: -1 });
documentSchema.index({ organization: 1, updatedAt: -1 });
documentSchema.index({ 'sharedWith.user': 1, 'sharedWith.isActive': 1 });
documentSchema.index({ owner: 1, status: 1 });
documentSchema.index({ isTemplate: 1, templateCategory: 1 });

// Virtual for version count
documentSchema.virtual('versionCount').get(function () {
    return this.versions.length;
});

// Virtual for latest version
documentSchema.virtual('latestVersion').get(function () {
    return this.versions[this.versions.length - 1];
});

// Virtual for shared user count
documentSchema.virtual('sharedUserCount').get(function () {
    return this.sharedWith.filter(share => share.isActive).length;
});

// Pre-save middleware to update metadata
documentSchema.pre('save', function (next) {
    if (this.isModified('content')) {
        // Update word count
        this.metadata.wordCount = this.content.split(/\s+/).filter(word => word.length > 0).length;

        // Update size
        this.metadata.size = Buffer.byteLength(this.content, 'utf8');

        // Update read time (average 200 words per minute)
        this.metadata.readTime = Math.ceil(this.metadata.wordCount / 200);
    }
    next();
});

// Static method to find documents by organization with proper isolation
documentSchema.statics.findByOrganization = function (organizationId, userId, options = {}) {
    const query = {
        organization: organizationId,
        $or: [
            { owner: userId },
            { visibility: 'organization' },
            { 'sharedWith.user': userId, 'sharedWith.isActive': true }
        ],
        status: { $ne: 'deleted' }
    };

    return this.find(query, null, options)
        .populate('owner', 'name email')
        .populate('metadata.lastEditedBy', 'name email')
        .populate('sharedWith.user', 'name email');
};

// Static method to find accessible documents for a user
documentSchema.statics.findAccessible = function (userId, organizationId, permission = 'viewer') {
    const query = {
        organization: organizationId,
        $or: [
            { owner: userId },
            {
                'sharedWith.user': userId,
                'sharedWith.isActive': true,
                'sharedWith.permission': permission === 'editor' ? { $in: ['editor', 'admin'] } : { $in: ['viewer', 'editor', 'admin'] }
            }
        ],
        status: { $ne: 'deleted' }
    };

    return this.find(query);
};

// Instance method to check if user has permission
documentSchema.methods.hasPermission = function (userId, permission = 'viewer') {
    // Owner has all permissions
    if (this.owner.toString() === userId.toString()) {
        return true;
    }

    // Check shared permissions
    const share = this.sharedWith.find(s =>
        s.user.toString() === userId.toString() && s.isActive
    );

    if (!share) return false;

    const permissionLevels = { viewer: 1, editor: 2, admin: 3 };
    const requiredLevel = permissionLevels[permission] || 1;
    const userLevel = permissionLevels[share.permission] || 1;

    return userLevel >= requiredLevel;
};

// Instance method to add version with enhanced tracking
documentSchema.methods.addVersion = function (content, editedBy, changeDescription = '') {
    const { generateChecksum, logVersionActivity } = require('../utils/versionControl.js');

    const versionNumber = this.versions.length + 1;
    const checksum = generateChecksum(content);

    const versionData = {
        content,
        title: this.title,
        versionNumber,
        changeDescription,
        editedBy,
        size: Buffer.byteLength(content, 'utf8'),
        checksum
    };

    this.versions.push(versionData);
    this.currentVersion = versionNumber;
    this.content = content;
    this.metadata.lastEditedBy = editedBy;

    // Keep only the last N versions to prevent unlimited growth
    const maxVersions = parseInt(process.env.MAX_VERSIONS_PER_DOCUMENT) || 50;
    if (this.versions.length > maxVersions) {
        this.versions = this.versions.slice(-maxVersions);
    }

    // Log version creation activity
    logVersionActivity('version_created', {
        userId: editedBy,
        organizationId: this.organization,
        documentId: this._id,
        documentTitle: this.title,
        versionNumber,
        details: `Created version ${versionNumber}: ${changeDescription}`,
        metadata: { checksum, size: versionData.size }
    });

    return this.save();
};

// Instance method to get version by number
documentSchema.methods.getVersion = function (versionNumber) {
    return this.versions.find(v => v.versionNumber === versionNumber);
};

// Instance method to restore to specific version
documentSchema.methods.restoreToVersion = function (versionNumber, userId, changeDescription = '') {
    const { logVersionActivity } = require('../utils/versionControl.js');

    const targetVersion = this.getVersion(versionNumber);
    if (!targetVersion) {
        throw new Error(`Version ${versionNumber} not found`);
    }

    // Create new version with restored content
    const restoreDescription = changeDescription || `Restored to version ${versionNumber}`;
    this.addVersion(targetVersion.content, userId, restoreDescription);

    // Update current content
    this.content = targetVersion.content;
    this.title = targetVersion.title || this.title;

    // Log restore activity
    logVersionActivity('version_restored', {
        userId,
        organizationId: this.organization,
        documentId: this._id,
        documentTitle: this.title,
        versionNumber: this.currentVersion,
        details: `Restored document to version ${versionNumber}`,
        metadata: { restoredFromVersion: versionNumber }
    });

    return this.save();
};

// Instance method to get version statistics
documentSchema.methods.getVersionStats = function () {
    const { getVersionStatistics } = require('../utils/versionControl.js');
    return getVersionStatistics(this);
};

// Instance method to cleanup old versions
documentSchema.methods.cleanupVersions = function (retentionPolicy = {}) {
    const { cleanupOldVersions } = require('../utils/versionControl.js');
    return cleanupOldVersions(this, retentionPolicy);
};

// Instance method to export version data
documentSchema.methods.exportVersions = function (options = {}) {
    const { exportVersionData } = require('../utils/versionControl.js');
    return exportVersionData(this, options);
};

// Instance method to share document
documentSchema.methods.shareWith = function (userId, permission, sharedBy) {
    // Remove existing share if any
    this.sharedWith = this.sharedWith.filter(s => s.user.toString() !== userId.toString());

    // Add new share
    this.sharedWith.push({
        user: userId,
        permission,
        sharedBy,
        isActive: true
    });

    return this.save();
};

// Instance method to revoke access
documentSchema.methods.revokeAccess = function (userId) {
    const share = this.sharedWith.find(s => s.user.toString() === userId.toString());
    if (share) {
        share.isActive = false;
    }
    return this.save();
};

// Instance method to update collaborator activity
documentSchema.methods.updateCollaboratorActivity = function (userId, role = 'viewer') {
    let collaborator = this.metadata.collaborators.find(c =>
        c.user.toString() === userId.toString()
    );

    if (collaborator) {
        collaborator.lastAccessed = new Date();
        collaborator.role = role;
    } else {
        this.metadata.collaborators.push({
            user: userId,
            lastAccessed: new Date(),
            role
        });
    }

    return this.save({ validateBeforeSave: false });
};

export const Document = mongoose.model('Document', documentSchema);
