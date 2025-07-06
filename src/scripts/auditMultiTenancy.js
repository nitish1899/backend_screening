#!/usr/bin/env node

/**
 * Multi-tenancy audit script
 * Checks for potential cross-organization data leakage and isolation issues
 */

import { connectDB } from '../config/database.js';
import { logger } from '../config/logger.js';
import { auditDataIntegrity } from '../utils/multiTenantAudit.js';
import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { Document } from '../models/Document.js';
import { Activity } from '../models/Activity.js';

const runFullAudit = async () => {
  try {
    console.log('🔍 Starting multi-tenancy audit...\n');
    
    // Connect to database
    await connectDB();
    console.log('✅ Database connected\n');

    // Get all organizations
    const organizations = await Organization.find({ isActive: true });
    console.log(`📊 Found ${organizations.length} active organizations\n`);

    const auditResults = {
      timestamp: new Date(),
      organizationsAudited: organizations.length,
      totalIssues: 0,
      organizationResults: [],
      globalIssues: [],
      summary: {
        crossOrgDocuments: 0,
        crossOrgUsers: 0,
        crossOrgActivities: 0,
        orphanedRecords: 0,
        missingOrgFilters: 0
      }
    };

    // Audit each organization
    for (const org of organizations) {
      console.log(`🏢 Auditing organization: ${org.name} (${org.id})`);
      
      try {
        const orgAudit = await auditDataIntegrity(org.id);
        auditResults.organizationResults.push(orgAudit);
        auditResults.totalIssues += orgAudit.summary.issuesFound;
        
        console.log(`   📋 Documents: ${orgAudit.summary.documentsChecked}`);
        console.log(`   👥 Users: ${orgAudit.summary.usersChecked}`);
        console.log(`   📝 Activities: ${orgAudit.summary.activitiesChecked}`);
        console.log(`   ⚠️  Issues: ${orgAudit.summary.issuesFound}\n`);
        
        // Count specific issue types
        orgAudit.issues.forEach(issue => {
          switch (issue.type) {
            case 'cross_org_document_owner':
            case 'cross_org_document_share':
              auditResults.summary.crossOrgDocuments++;
              break;
            case 'cross_org_activity':
              auditResults.summary.crossOrgActivities++;
              break;
          }
        });
        
      } catch (error) {
        console.error(`❌ Error auditing organization ${org.name}:`, error.message);
        auditResults.globalIssues.push({
          type: 'audit_error',
          organizationId: org.id,
          organizationName: org.name,
          error: error.message
        });
      }
    }

    // Check for orphaned records (records without valid organization references)
    console.log('🔍 Checking for orphaned records...\n');
    
    const orphanedAudit = await checkOrphanedRecords();
    auditResults.summary.orphanedRecords = orphanedAudit.totalOrphaned;
    auditResults.globalIssues.push(...orphanedAudit.issues);

    // Check for missing organization indexes
    console.log('🔍 Checking database indexes...\n');
    
    const indexAudit = await checkDatabaseIndexes();
    auditResults.globalIssues.push(...indexAudit.issues);

    // Generate report
    console.log('📊 AUDIT SUMMARY');
    console.log('================');
    console.log(`Organizations audited: ${auditResults.organizationsAudited}`);
    console.log(`Total issues found: ${auditResults.totalIssues}`);
    console.log(`Cross-org documents: ${auditResults.summary.crossOrgDocuments}`);
    console.log(`Cross-org activities: ${auditResults.summary.crossOrgActivities}`);
    console.log(`Orphaned records: ${auditResults.summary.orphanedRecords}`);
    console.log(`Global issues: ${auditResults.globalIssues.length}\n`);

    if (auditResults.totalIssues > 0 || auditResults.globalIssues.length > 0) {
      console.log('⚠️  ISSUES DETECTED - Review required!');
      
      // Log detailed issues
      if (auditResults.totalIssues > 0) {
        console.log('\n🔍 Organization-specific issues:');
        auditResults.organizationResults.forEach(orgResult => {
          if (orgResult.issues.length > 0) {
            console.log(`\n  ${orgResult.organizationId}:`);
            orgResult.issues.forEach(issue => {
              console.log(`    - ${issue.type}: ${JSON.stringify(issue)}`);
            });
          }
        });
      }

      if (auditResults.globalIssues.length > 0) {
        console.log('\n🔍 Global issues:');
        auditResults.globalIssues.forEach(issue => {
          console.log(`  - ${issue.type}: ${issue.description || JSON.stringify(issue)}`);
        });
      }
    } else {
      console.log('✅ No multi-tenancy issues detected!');
    }

    // Save audit results
    const auditFileName = `audit-${new Date().toISOString().split('T')[0]}.json`;
    const fs = await import('fs');
    fs.writeFileSync(auditFileName, JSON.stringify(auditResults, null, 2));
    console.log(`\n📄 Detailed audit results saved to: ${auditFileName}`);

    return auditResults;

  } catch (error) {
    console.error('❌ Audit failed:', error);
    logger.error('Multi-tenancy audit failed:', error);
    throw error;
  }
};

const checkOrphanedRecords = async () => {
  const results = {
    totalOrphaned: 0,
    issues: []
  };

  try {
    // Get all valid organization IDs
    const validOrgIds = await Organization.find({ isActive: true }).distinct('_id');
    const validOrgIdStrings = validOrgIds.map(id => id.toString());

    // Check documents with invalid organization references
    const orphanedDocs = await Document.find({
      organization: { $nin: validOrgIds }
    });

    if (orphanedDocs.length > 0) {
      results.totalOrphaned += orphanedDocs.length;
      results.issues.push({
        type: 'orphaned_documents',
        count: orphanedDocs.length,
        description: `Found ${orphanedDocs.length} documents with invalid organization references`,
        documentIds: orphanedDocs.map(doc => doc._id)
      });
    }

    // Check users with invalid organization references
    const orphanedUsers = await User.find({
      organization: { $nin: validOrgIds }
    });

    if (orphanedUsers.length > 0) {
      results.totalOrphaned += orphanedUsers.length;
      results.issues.push({
        type: 'orphaned_users',
        count: orphanedUsers.length,
        description: `Found ${orphanedUsers.length} users with invalid organization references`,
        userIds: orphanedUsers.map(user => user._id)
      });
    }

    // Check activities with invalid organization references
    const orphanedActivities = await Activity.find({
      organization: { $nin: validOrgIds }
    });

    if (orphanedActivities.length > 0) {
      results.totalOrphaned += orphanedActivities.length;
      results.issues.push({
        type: 'orphaned_activities',
        count: orphanedActivities.length,
        description: `Found ${orphanedActivities.length} activities with invalid organization references`,
        activityIds: orphanedActivities.map(activity => activity._id)
      });
    }

  } catch (error) {
    results.issues.push({
      type: 'orphaned_check_error',
      description: `Error checking for orphaned records: ${error.message}`
    });
  }

  return results;
};

const checkDatabaseIndexes = async () => {
  const results = {
    issues: []
  };

  try {
    const mongoose = await import('mongoose');
    const db = mongoose.connection.db;

    // Check if organization indexes exist on key collections
    const collections = ['documents', 'users', 'activities'];
    
    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const indexes = await collection.indexes();
        
        const hasOrgIndex = indexes.some(index => 
          index.key && index.key.organization
        );

        if (!hasOrgIndex) {
          results.issues.push({
            type: 'missing_organization_index',
            collection: collectionName,
            description: `Collection '${collectionName}' is missing organization index for optimal multi-tenant queries`
          });
        }
      } catch (error) {
        results.issues.push({
          type: 'index_check_error',
          collection: collectionName,
          description: `Error checking indexes for ${collectionName}: ${error.message}`
        });
      }
    }

  } catch (error) {
    results.issues.push({
      type: 'database_index_error',
      description: `Error accessing database for index check: ${error.message}`
    });
  }

  return results;
};

// Run audit if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runFullAudit()
    .then(() => {
      console.log('\n✅ Audit completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Audit failed:', error);
      process.exit(1);
    });
}

export { runFullAudit, checkOrphanedRecords, checkDatabaseIndexes };
