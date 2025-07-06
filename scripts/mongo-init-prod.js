// MongoDB initialization script for production environment
// This script sets up the database, collections, and indexes for production deployment

// Get environment variables or use defaults
const dbName = process.env.MONGO_DATABASE || 'collaborative_docs_prod';
const appUser = process.env.MONGO_APP_USERNAME || 'app_user_prod';
const appPassword = process.env.MONGO_APP_PASSWORD || 'secure_app_password_change_me';

// Switch to the application database
db = db.getSiblingDB(dbName);

// Create application user with appropriate permissions
db.createUser({
  user: appUser,
  pwd: appPassword,
  roles: [
    {
      role: 'readWrite',
      db: dbName
    }
  ]
});

print('✅ Created production application user');

// Create collections with strict validation schemas for production
db.createCollection('organizations', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'domain', 'slug', 'isActive', 'owner'],
      properties: {
        name: {
          bsonType: 'string',
          minLength: 2,
          maxLength: 100,
          description: 'Organization name must be 2-100 characters'
        },
        domain: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\\.[a-zA-Z]{2,}$',
          description: 'Valid domain is required'
        },
        slug: {
          bsonType: 'string',
          pattern: '^[a-z0-9-]+$',
          minLength: 2,
          maxLength: 50,
          description: 'Slug must be lowercase alphanumeric with hyphens'
        },
        isActive: {
          bsonType: 'bool',
          description: 'Organization active status is required'
        },
        owner: {
          bsonType: 'objectId',
          description: 'Organization owner is required'
        }
      }
    }
  }
});

db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'email', 'password', 'role', 'organization', 'isActive'],
      properties: {
        name: {
          bsonType: 'string',
          minLength: 2,
          maxLength: 100,
          description: 'Name must be 2-100 characters'
        },
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
          description: 'Valid email is required'
        },
        password: {
          bsonType: 'string',
          minLength: 60,
          maxLength: 60,
          description: 'Hashed password is required'
        },
        role: {
          enum: ['admin', 'editor', 'viewer'],
          description: 'Role must be admin, editor, or viewer'
        },
        organization: {
          bsonType: 'objectId',
          description: 'Organization reference is required'
        },
        isActive: {
          bsonType: 'bool',
          description: 'User active status is required'
        }
      }
    }
  }
});

db.createCollection('documents', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'content', 'owner', 'organization', 'status'],
      properties: {
        title: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 200,
          description: 'Title must be 1-200 characters'
        },
        content: {
          bsonType: 'string',
          description: 'Content is required'
        },
        status: {
          enum: ['draft', 'published', 'archived', 'deleted'],
          description: 'Status must be draft, published, archived, or deleted'
        },
        visibility: {
          enum: ['private', 'organization', 'public'],
          description: 'Visibility must be private, organization, or public'
        },
        owner: {
          bsonType: 'objectId',
          description: 'Owner reference is required'
        },
        organization: {
          bsonType: 'objectId',
          description: 'Organization reference is required'
        }
      }
    }
  }
});

db.createCollection('activities', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['user', 'organization', 'category', 'action', 'timestamp'],
      properties: {
        user: {
          bsonType: 'objectId',
          description: 'User reference is required'
        },
        organization: {
          bsonType: 'objectId',
          description: 'Organization reference is required'
        },
        category: {
          enum: ['document', 'user', 'organization', 'security', 'system'],
          description: 'Category must be document, user, organization, security, or system'
        },
        action: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 100,
          description: 'Action description is required'
        },
        severity: {
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Severity must be low, medium, high, or critical'
        },
        timestamp: {
          bsonType: 'date',
          description: 'Timestamp is required'
        }
      }
    }
  }
});

print('✅ Created production collections with strict validation');

// Create comprehensive indexes for production performance
// Organization indexes
db.organizations.createIndex({ domain: 1 }, { unique: true, background: true });
db.organizations.createIndex({ slug: 1 }, { unique: true, background: true });
db.organizations.createIndex({ isActive: 1 }, { background: true });
db.organizations.createIndex({ 'subscription.status': 1 }, { background: true });
db.organizations.createIndex({ owner: 1 }, { background: true });

// User indexes
db.users.createIndex({ email: 1 }, { unique: true, background: true });
db.users.createIndex({ organization: 1 }, { background: true });
db.users.createIndex({ organization: 1, isActive: 1 }, { background: true });
db.users.createIndex({ organization: 1, role: 1 }, { background: true });
db.users.createIndex({ organization: 1, email: 1 }, { background: true });
db.users.createIndex({ 'resetPasswordToken': 1 }, { sparse: true, background: true });
db.users.createIndex({ 'emailVerificationToken': 1 }, { sparse: true, background: true });

// Document indexes
db.documents.createIndex({ organization: 1 }, { background: true });
db.documents.createIndex({ organization: 1, owner: 1 }, { background: true });
db.documents.createIndex({ organization: 1, status: 1 }, { background: true });
db.documents.createIndex({ organization: 1, visibility: 1 }, { background: true });
db.documents.createIndex({ organization: 1, 'sharedWith.user': 1 }, { background: true });
db.documents.createIndex({ organization: 1, folder: 1 }, { background: true });
db.documents.createIndex({ organization: 1, tags: 1 }, { background: true });
db.documents.createIndex({ organization: 1, updatedAt: -1 }, { background: true });
db.documents.createIndex({ organization: 1, createdAt: -1 }, { background: true });

// Full-text search index for documents
db.documents.createIndex({ 
  organization: 1, 
  title: 'text', 
  content: 'text', 
  tags: 'text' 
}, { 
  name: 'document_search_index',
  weights: { title: 10, tags: 5, content: 1 },
  background: true
});

// Activity indexes
db.activities.createIndex({ organization: 1 }, { background: true });
db.activities.createIndex({ organization: 1, user: 1 }, { background: true });
db.activities.createIndex({ organization: 1, category: 1 }, { background: true });
db.activities.createIndex({ organization: 1, action: 1 }, { background: true });
db.activities.createIndex({ organization: 1, timestamp: -1 }, { background: true });
db.activities.createIndex({ organization: 1, severity: 1 }, { background: true });
db.activities.createIndex({ organization: 1, document: 1 }, { background: true });

// Compound indexes for complex queries
db.documents.createIndex({ organization: 1, owner: 1, status: 1 }, { background: true });
db.documents.createIndex({ organization: 1, 'sharedWith.user': 1, 'sharedWith.isActive': 1 }, { background: true });
db.activities.createIndex({ organization: 1, user: 1, timestamp: -1 }, { background: true });
db.activities.createIndex({ organization: 1, category: 1, timestamp: -1 }, { background: true });

print('✅ Created production-optimized indexes');

// Create TTL indexes for automatic cleanup
db.activities.createIndex({ timestamp: 1 }, { expireAfterSeconds: 31536000, background: true }); // 1 year
db.users.createIndex({ 'resetPasswordExpires': 1 }, { expireAfterSeconds: 0, background: true });
db.users.createIndex({ 'emailVerificationExpires': 1 }, { expireAfterSeconds: 0, background: true });

print('✅ Created TTL indexes for automatic cleanup');

// Set up database-level settings for production
db.runCommand({
  collMod: 'organizations',
  validationLevel: 'strict',
  validationAction: 'error'
});

db.runCommand({
  collMod: 'users',
  validationLevel: 'strict',
  validationAction: 'error'
});

db.runCommand({
  collMod: 'documents',
  validationLevel: 'strict',
  validationAction: 'error'
});

db.runCommand({
  collMod: 'activities',
  validationLevel: 'strict',
  validationAction: 'error'
});

print('✅ Set strict validation for all collections');

print('🚀 Production database initialization completed successfully');
print('📊 Collections: organizations, users, documents, activities');
print('🔍 Production-optimized indexes created');
print('🔒 Strict validation enabled');
print('⚠️  Remember to:');
print('   - Change default passwords');
print('   - Configure SSL/TLS');
print('   - Set up backup strategy');
print('   - Configure monitoring');
