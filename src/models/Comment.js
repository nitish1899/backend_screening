import mongoose from 'mongoose';

const replySchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Reply content is required'],
    trim: true,
    maxlength: [1000, 'Reply cannot exceed 1000 characters']
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date
}, {
  timestamps: true
});

const commentSchema = new mongoose.Schema({
  document: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: [true, 'Document is required'],
    index: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: [true, 'Organization is required'],
    index: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Author is required'],
    index: true
  },
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    trim: true,
    maxlength: [2000, 'Comment cannot exceed 2000 characters']
  },
  type: {
    type: String,
    enum: ['general', 'suggestion', 'question', 'issue', 'approval'],
    default: 'general'
  },
  status: {
    type: String,
    enum: ['open', 'resolved', 'dismissed'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  position: {
    // For inline comments - position in document
    start: {
      type: Number,
      min: 0
    },
    end: {
      type: Number,
      min: 0
    },
    line: {
      type: Number,
      min: 1
    },
    selectedText: {
      type: String,
      maxlength: [500, 'Selected text cannot exceed 500 characters']
    }
  },
  mentions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notified: {
      type: Boolean,
      default: false
    }
  }],
  replies: [replySchema],
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    type: {
      type: String,
      enum: ['like', 'dislike', 'love', 'laugh', 'angry', 'sad'],
      required: true
    }
  }],
  tags: [{
    type: String,
    lowercase: true,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: Date,
  metadata: {
    version: {
      type: Number,
      default: 1
    },
    documentVersion: Number,
    ipAddress: String,
    userAgent: String
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Filter out deleted replies
      if (ret.replies) {
        ret.replies = ret.replies.filter(reply => !reply.isDeleted);
      }
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes for performance and multi-tenancy
commentSchema.index({ organization: 1, document: 1, createdAt: -1 });
commentSchema.index({ organization: 1, author: 1, createdAt: -1 });
commentSchema.index({ organization: 1, status: 1 });
commentSchema.index({ organization: 1, type: 1 });
commentSchema.index({ document: 1, status: 1 });
commentSchema.index({ document: 1, 'position.line': 1 });
commentSchema.index({ 'mentions.user': 1 });

// Virtual for reply count
commentSchema.virtual('replyCount').get(function() {
  return this.replies.filter(reply => !reply.isDeleted).length;
});

// Virtual for reaction summary
commentSchema.virtual('reactionSummary').get(function() {
  const summary = {};
  this.reactions.forEach(reaction => {
    summary[reaction.type] = (summary[reaction.type] || 0) + 1;
  });
  return summary;
});

// Pre-save middleware to handle mentions
commentSchema.pre('save', function(next) {
  if (this.isModified('content')) {
    // Extract mentions from content (@username)
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(this.content)) !== null) {
      mentions.push(match[1]);
    }
    
    // This would need to be enhanced to actually resolve usernames to user IDs
    // For now, we'll leave the mentions array as is
  }
  next();
});

// Static method to find comments by document
commentSchema.statics.findByDocument = function(documentId, organizationId, options = {}) {
  const { 
    status, 
    type, 
    author, 
    includeDeleted = false,
    limit = 50,
    skip = 0 
  } = options;
  
  const query = {
    document: documentId,
    organization: organizationId
  };
  
  if (!includeDeleted) {
    query.isDeleted = false;
  }
  
  if (status) query.status = status;
  if (type) query.type = type;
  if (author) query.author = author;
  
  return this.find(query)
    .populate('author', 'name email profilePicture')
    .populate('replies.author', 'name email profilePicture')
    .populate('resolvedBy', 'name email')
    .populate('mentions.user', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to find comments by organization
commentSchema.statics.findByOrganization = function(organizationId, options = {}) {
  const { 
    status, 
    type, 
    author, 
    document,
    startDate,
    endDate,
    limit = 100,
    skip = 0 
  } = options;
  
  const query = {
    organization: organizationId,
    isDeleted: false
  };
  
  if (status) query.status = status;
  if (type) query.type = type;
  if (author) query.author = author;
  if (document) query.document = document;
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .populate('author', 'name email')
    .populate('document', 'title')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Instance method to add reply
commentSchema.methods.addReply = function(authorId, content) {
  this.replies.push({
    author: authorId,
    content: content.trim()
  });
  
  return this.save();
};

// Instance method to add reaction
commentSchema.methods.addReaction = function(userId, reactionType) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());
  
  // Add new reaction
  this.reactions.push({
    user: userId,
    type: reactionType
  });
  
  return this.save();
};

// Instance method to resolve comment
commentSchema.methods.resolve = function(resolvedBy) {
  this.status = 'resolved';
  this.resolvedBy = resolvedBy;
  this.resolvedAt = new Date();
  
  return this.save();
};

// Instance method to soft delete
commentSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  
  return this.save();
};

export const Comment = mongoose.model('Comment', commentSchema);
