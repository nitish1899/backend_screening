import mongoose from 'mongoose';

const folderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Folder name is required'],
    trim: true,
    minlength: [1, 'Folder name must be at least 1 character long'],
    maxlength: [100, 'Folder name cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Folder owner is required'],
    index: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: [true, 'Organization is required'],
    index: true
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null,
    index: true
  },
  path: {
    type: String,
    required: true,
    index: true
  },
  level: {
    type: Number,
    default: 0,
    min: 0,
    max: 10 // Limit folder nesting depth
  },
  color: {
    type: String,
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color must be a valid hex color'],
    default: '#3498db'
  },
  icon: {
    type: String,
    maxlength: [50, 'Icon name cannot exceed 50 characters'],
    default: 'folder'
  },
  sharedWith: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    permission: {
      type: String,
      enum: ['viewer', 'editor', 'admin'],
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
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  visibility: {
    type: String,
    enum: ['private', 'organization', 'public'],
    default: 'private'
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  archivedAt: Date,
  stats: {
    documentCount: {
      type: Number,
      default: 0,
      min: 0
    },
    subfolderCount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalSize: {
      type: Number,
      default: 0,
      min: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance and multi-tenancy
folderSchema.index({ organization: 1, owner: 1 });
folderSchema.index({ organization: 1, parent: 1 });
folderSchema.index({ organization: 1, path: 1 });
folderSchema.index({ organization: 1, name: 1 });
folderSchema.index({ organization: 1, visibility: 1 });
folderSchema.index({ 'sharedWith.user': 1, 'sharedWith.isActive': 1 });

// Virtual for full path display
folderSchema.virtual('fullPath').get(function() {
  return this.path + '/' + this.name;
});

// Virtual for document count
folderSchema.virtual('documents', {
  ref: 'Document',
  localField: '_id',
  foreignField: 'folder',
  count: true
});

// Virtual for subfolder count
folderSchema.virtual('subfolders', {
  ref: 'Folder',
  localField: '_id',
  foreignField: 'parent',
  count: true
});

// Pre-save middleware to update path and level
folderSchema.pre('save', async function(next) {
  if (this.isModified('parent') || this.isNew) {
    if (this.parent) {
      const parentFolder = await this.constructor.findById(this.parent);
      if (parentFolder) {
        this.path = parentFolder.fullPath;
        this.level = parentFolder.level + 1;
        
        // Prevent circular references
        if (this.path.includes(this._id.toString())) {
          return next(new Error('Circular folder reference detected'));
        }
        
        // Check depth limit
        if (this.level > 10) {
          return next(new Error('Maximum folder depth exceeded'));
        }
      }
    } else {
      this.path = '';
      this.level = 0;
    }
  }
  next();
});

// Static method to find folders by organization
folderSchema.statics.findByOrganization = function(organizationId, userId, options = {}) {
  const query = {
    organization: organizationId,
    isArchived: false,
    $or: [
      { owner: userId },
      { visibility: 'organization' },
      { 'sharedWith.user': userId, 'sharedWith.isActive': true }
    ]
  };
  
  return this.find(query, null, options)
    .populate('owner', 'name email')
    .populate('parent', 'name path')
    .sort({ name: 1 });
};

// Static method to get folder tree
folderSchema.statics.getFolderTree = function(organizationId, userId, parentId = null) {
  const query = {
    organization: organizationId,
    parent: parentId,
    isArchived: false,
    $or: [
      { owner: userId },
      { visibility: 'organization' },
      { 'sharedWith.user': userId, 'sharedWith.isActive': true }
    ]
  };
  
  return this.find(query)
    .populate('owner', 'name email')
    .sort({ name: 1 });
};

// Instance method to check if user has permission
folderSchema.methods.hasPermission = function(userId, permission = 'viewer') {
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

// Instance method to update stats
folderSchema.methods.updateStats = async function() {
  const Document = mongoose.model('Document');
  
  const [documentCount, subfolderCount] = await Promise.all([
    Document.countDocuments({ folder: this._id, status: { $ne: 'deleted' } }),
    this.constructor.countDocuments({ parent: this._id, isArchived: false })
  ]);
  
  this.stats.documentCount = documentCount;
  this.stats.subfolderCount = subfolderCount;
  
  return this.save({ validateBeforeSave: false });
};

export const Folder = mongoose.model('Folder', folderSchema);
