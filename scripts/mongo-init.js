// MongoDB initialization script for development environment
// This script sets up the database, collections, and indexes for the collaborative document platform

// Switch to the application database
db = db.getSiblingDB('collaborative_docs_dev');

// Create application user with appropriate permissions
db.createUser({
  user: 'app_user',
  pwd: 'app_password_dev',
  roles: [
    {
      role: 'readWrite',
      db: 'collaborative_docs_dev'
    }
  ]
});

print('✅ Created application user');

// Create collections with validation schemas
db.createCollection('organizations', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'domain', 'slug', 'isActive'],
      properties: {
        name: {
          bsonType: 'string',
          description: 'Organization name is required'
        },
        domain: {
          bsonType: 'string',
          description: 'Organization domain is required'
        },
        slug: {
          bsonType: 'string',
          description: 'Organization slug is required'
        },
        isActive: {
          bsonType: 'bool',
          description: 'Organization active status is required'
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
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
          description: 'Valid email is required'
        },
        role: {
          enum: ['admin', 'editor', 'viewer'],
          description: 'Role must be admin, editor, or viewer'
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
        status: {
          enum: ['draft', 'published', 'archived', 'deleted'],
          description: 'Status must be draft, published, archived, or deleted'
        },
        visibility: {
          enum: ['private', 'organization', 'public'],
          description: 'Visibility must be private, organization, or public'
        }
      }
    }
  }
});

db.createCollection('activities', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['user', 'organization', 'category', 'action'],
      properties: {
        category: {
          enum: ['document', 'user', 'organization', 'security', 'system'],
          description: 'Category must be document, user, organization, security, or system'
        },
        severity: {
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Severity must be low, medium, high, or critical'
        }
      }
    }
  }
});

print('✅ Created collections with validation schemas');

// Create indexes for optimal performance and multi-tenancy
// Organization indexes
db.organizations.createIndex({ domain: 1 }, { unique: true });
db.organizations.createIndex({ slug: 1 }, { unique: true });
db.organizations.createIndex({ isActive: 1 });
db.organizations.createIndex({ 'subscription.status': 1 });

// User indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ organization: 1 });
db.users.createIndex({ organization: 1, isActive: 1 });
db.users.createIndex({ organization: 1, role: 1 });
db.users.createIndex({ 'resetPasswordToken': 1 }, { sparse: true });

// Document indexes
db.documents.createIndex({ organization: 1 });
db.documents.createIndex({ organization: 1, owner: 1 });
db.documents.createIndex({ organization: 1, status: 1 });
db.documents.createIndex({ organization: 1, visibility: 1 });
db.documents.createIndex({ organization: 1, 'sharedWith.user': 1 });
db.documents.createIndex({ organization: 1, folder: 1 });
db.documents.createIndex({ organization: 1, tags: 1 });
db.documents.createIndex({ organization: 1, updatedAt: -1 });
db.documents.createIndex({ 
  organization: 1, 
  title: 'text', 
  content: 'text', 
  tags: 'text' 
}, { 
  name: 'document_search_index',
  weights: { title: 10, tags: 5, content: 1 }
});

// Activity indexes
db.activities.createIndex({ organization: 1 });
db.activities.createIndex({ organization: 1, user: 1 });
db.activities.createIndex({ organization: 1, category: 1 });
db.activities.createIndex({ organization: 1, action: 1 });
db.activities.createIndex({ organization: 1, createdAt: -1 });
db.activities.createIndex({ organization: 1, severity: 1 });
db.activities.createIndex({ organization: 1, document: 1 });

// Compound indexes for common queries
db.documents.createIndex({ organization: 1, owner: 1, status: 1 });
db.documents.createIndex({ organization: 1, 'sharedWith.user': 1, 'sharedWith.isActive': 1 });
db.activities.createIndex({ organization: 1, user: 1, createdAt: -1 });

print('✅ Created performance and multi-tenancy indexes');

// Create TTL indexes for cleanup
db.activities.createIndex({ createdAt: 1 }, { expireAfterSeconds: 31536000 }); // 1 year
db.users.createIndex({ 'resetPasswordExpires': 1 }, { expireAfterSeconds: 0 });

print('✅ Created TTL indexes for automatic cleanup');

// Insert sample data for development
const sampleOrg = {
  name: 'Sample Organization',
  domain: 'sample.local',
  slug: 'sample',
  isActive: true,
  subscription: {
    plan: 'pro',
    status: 'active',
    features: ['real_time_collaboration', 'advanced_permissions', 'api_access']
  },
  settings: {
    allowPublicDocuments: false,
    maxUsersPerOrg: 100,
    maxDocumentsPerOrg: 1000
  },
  createdAt: new Date(),
  updatedAt: new Date()
};

const orgResult = db.organizations.insertOne(sampleOrg);
print('✅ Created sample organization: ' + orgResult.insertedId);

// Create sample admin user
const sampleUser = {
  name: 'Admin User',
  email: 'admin@sample.local',
  password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uDjO', // password123
  role: 'admin',
  organization: orgResult.insertedId,
  isActive: true,
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

const userResult = db.users.insertOne(sampleUser);
print('✅ Created sample admin user: ' + userResult.insertedId);

// Update organization with owner
db.organizations.updateOne(
  { _id: orgResult.insertedId },
  { $set: { owner: userResult.insertedId } }
);

print('✅ Database initialization completed successfully');
print('📊 Collections created: organizations, users, documents, activities');
print('🔍 Indexes created for optimal multi-tenant performance');
print('👤 Sample admin user: admin@sample.local / password123');
print('🏢 Sample organization: Sample Organization (sample.local)');
