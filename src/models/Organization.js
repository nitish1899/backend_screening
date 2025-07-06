import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Organization name is required'],
    unique: true,
    trim: true,
    minlength: [2, 'Organization name must be at least 2 characters long'],
    maxlength: [100, 'Organization name cannot exceed 100 characters']
  },
  domain: {
    type: String,
    required: [true, 'Organization domain is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/, 'Please enter a valid domain']
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    trim: true
  },
  logo: {
    type: String,
    default: null
  },
  settings: {
    allowPublicDocuments: {
      type: Boolean,
      default: false
    },
    maxUsersPerOrg: {
      type: Number,
      default: 100,
      min: [1, 'Must allow at least 1 user'],
      max: [10000, 'Cannot exceed 10000 users']
    },
    maxDocumentsPerOrg: {
      type: Number,
      default: 1000,
      min: [1, 'Must allow at least 1 document'],
      max: [100000, 'Cannot exceed 100000 documents']
    },
    documentRetentionDays: {
      type: Number,
      default: 365,
      min: [1, 'Retention must be at least 1 day']
    },
    allowedFileTypes: [{
      type: String,
      enum: ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf']
    }],
    maxFileSize: {
      type: Number,
      default: 10485760, // 10MB in bytes
      min: [1024, 'File size must be at least 1KB']
    }
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'premium', 'enterprise'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'cancelled'],
      default: 'active'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: Date,
    features: [{
      type: String,
      enum: ['real_time_collaboration', 'version_history', 'advanced_sharing', 'api_access', 'sso', 'audit_logs']
    }]
  },
  contactInfo: {
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phone: String,
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  stats: {
    totalUsers: {
      type: Number,
      default: 0,
      min: 0
    },
    totalDocuments: {
      type: Number,
      default: 0,
      min: 0
    },
    storageUsed: {
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

// Indexes for performance
organizationSchema.index({ isActive: 1 });
organizationSchema.index({ 'subscription.status': 1 });

// Virtual for display name
organizationSchema.virtual('displayName').get(function () {
  return this.name;
});

// Virtual for user count
organizationSchema.virtual('userCount', {
  ref: 'User',
  localField: '_id',
  foreignField: 'organization',
  count: true
});

// Virtual for document count
organizationSchema.virtual('documentCount', {
  ref: 'Document',
  localField: '_id',
  foreignField: 'organization',
  count: true
});

// Pre-save middleware to generate slug
organizationSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }
  next();
});

// Static method to find active organizations
organizationSchema.statics.findActive = function (options = {}) {
  return this.find({ isActive: true }, null, options);
};

// Static method to find by domain
organizationSchema.statics.findByDomain = function (domain) {
  return this.findOne({
    domain: domain.toLowerCase(),
    isActive: true
  });
};

// Instance method to check if feature is enabled
organizationSchema.methods.hasFeature = function (feature) {
  return this.subscription.features.includes(feature);
};

// Instance method to update stats
organizationSchema.methods.updateStats = async function () {
  const User = mongoose.model('User');
  const Document = mongoose.model('Document');

  const [userCount, documentCount] = await Promise.all([
    User.countDocuments({ organization: this._id, isActive: true }),
    Document.countDocuments({ organization: this._id })
  ]);

  this.stats.totalUsers = userCount;
  this.stats.totalDocuments = documentCount;

  return this.save({ validateBeforeSave: false });
};

export const Organization = mongoose.model('Organization', organizationSchema);
