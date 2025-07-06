import mongoose from 'mongoose';
import { Document } from '../src/models/Document.js';
import { Activity } from '../src/models/Activity.js';
import { User } from '../src/models/User.js';
import { Organization } from '../src/models/Organization.js';
import { generateChecksum, generateTextDiff, getVersionStatistics } from '../src/utils/versionControl.js';

// Demo script to showcase document versioning and activity logging functionality

async function runVersionControlDemo() {
  try {
    console.log('🚀 Starting Document Version Control Demo...\n');

    // Connect to MongoDB (using test database)
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/collaborative-docs-demo');
    console.log('✅ Connected to MongoDB\n');

    // Clean up existing demo data
    await Document.deleteMany({ title: { $regex: /^Demo/ } });
    await Organization.deleteMany({ name: 'Demo Organization' });
    await User.deleteMany({ email: 'demo@example.com' });
    await Activity.deleteMany({});

    // Create demo organization
    const demoOrg = await Organization.create({
      name: 'Demo Organization',
      domain: 'demo.com',
      settings: {
        maxUsers: 100,
        maxDocuments: 1000,
        features: ['collaboration', 'versioning', 'activity_logs']
      }
    });
    console.log('📁 Created demo organization:', demoOrg.name);

    // Create demo user
    const demoUser = await User.create({
      name: 'Demo User',
      email: 'demo@example.com',
      password: 'password123',
      organization: demoOrg._id,
      role: 'editor',
      isActive: true
    });
    console.log('👤 Created demo user:', demoUser.name);

    // Create initial document
    const document = await Document.create({
      title: 'Demo Document - Version Control Showcase',
      content: 'This is the initial content of our demo document.\nIt will be used to demonstrate version control features.',
      contentType: 'text',
      owner: demoUser._id,
      organization: demoOrg._id,
      status: 'draft'
    });
    console.log('📄 Created demo document:', document.title);

    // Demonstrate version creation
    console.log('\n🔄 Demonstrating Version Control Features:\n');

    // Version 1: Add more content
    const version1Content = `This is the initial content of our demo document.
It will be used to demonstrate version control features.

Version 1 Update:
- Added this new section
- Demonstrated automatic version tracking
- Content checksum: ${generateChecksum('version1')}`;

    await document.addVersion(version1Content, demoUser._id, 'Added new section and features list');
    console.log('✅ Created Version 1 - Added new section');

    // Version 2: Modify existing content
    const version2Content = `This is the UPDATED initial content of our demo document.
It will be used to demonstrate advanced version control features.

Version 2 Update:
- Modified the introduction
- Enhanced the features list
- Added version comparison capabilities
- Content checksum: ${generateChecksum('version2')}`;

    await document.addVersion(version2Content, demoUser._id, 'Enhanced content and added comparison features');
    console.log('✅ Created Version 2 - Enhanced content');

    // Version 3: Major restructure
    const version3Content = `# Demo Document - Version Control Showcase

## Introduction
This document demonstrates our advanced version control system.

## Features Demonstrated
1. **Automatic Version Tracking** - Every change creates a new version
2. **Content Checksums** - Integrity verification for each version
3. **Change Descriptions** - Detailed logs of what changed
4. **Version Comparison** - Diff generation between versions
5. **Activity Logging** - Comprehensive audit trail

## Version History
- Version 1: Initial content with basic features
- Version 2: Enhanced content and comparison capabilities  
- Version 3: Major restructure with markdown formatting

Content checksum: ${generateChecksum('version3')}`;

    await document.addVersion(version3Content, demoUser._id, 'Major restructure with markdown formatting');
    console.log('✅ Created Version 3 - Major restructure');

    // Reload document to get updated versions
    await document.populate('versions.editedBy', 'name email');

    // Display version statistics
    console.log('\n📊 Version Statistics:');
    const stats = getVersionStatistics(document);
    console.log(`- Total Versions: ${stats.totalVersions}`);
    console.log(`- Current Version: ${document.currentVersion}`);
    console.log(`- Average Size: ${stats.averageSize} bytes`);
    console.log(`- Total Size: ${stats.totalSize} bytes`);
    console.log(`- Size Growth: ${stats.sizeGrowth} bytes`);
    console.log(`- Contributors: ${stats.contributors}`);

    // Demonstrate version comparison
    console.log('\n🔍 Version Comparison (Version 1 vs Version 3):');
    const version1 = document.versions.find(v => v.versionNumber === 1);
    const version3 = document.versions.find(v => v.versionNumber === 3);
    
    if (version1 && version3) {
      const diff = generateTextDiff(version1.content, version3.content);
      console.log(`- Total Changes: ${diff.summary.totalChanges}`);
      console.log(`- Additions: ${diff.summary.additions} lines`);
      console.log(`- Deletions: ${diff.summary.deletions} lines`);
      console.log(`- Modifications: ${diff.summary.modifications} lines`);
      
      // Show first few changes
      console.log('\nFirst 3 changes:');
      diff.changes.slice(0, 3).forEach((change, index) => {
        console.log(`  ${index + 1}. Line ${change.lineNumber}: ${change.type}`);
        if (change.type === 'modification') {
          console.log(`     Old: "${change.oldContent}"`);
          console.log(`     New: "${change.newContent}"`);
        }
      });
    }

    // Demonstrate version restoration
    console.log('\n↩️  Demonstrating Version Restoration:');
    console.log('Restoring document to Version 2...');
    
    await document.restoreToVersion(2, demoUser._id, 'Demo: Restored to version 2 for demonstration');
    console.log(`✅ Document restored to Version 2, new current version: ${document.currentVersion}`);

    // Display activity log
    console.log('\n📋 Activity Log:');
    const activities = await Activity.find({
      organization: demoOrg._id,
      document: document._id
    })
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    activities.forEach((activity, index) => {
      const timestamp = activity.createdAt.toISOString().slice(0, 19).replace('T', ' ');
      console.log(`  ${index + 1}. [${timestamp}] ${activity.action}: ${activity.details}`);
      if (activity.metadata && Object.keys(activity.metadata).length > 0) {
        console.log(`     Metadata: ${JSON.stringify(activity.metadata)}`);
      }
    });

    // Demonstrate activity statistics
    console.log('\n📈 Activity Statistics:');
    const activityStats = await Activity.getActivityStats(demoOrg._id);
    activityStats.forEach(stat => {
      console.log(`\n${stat._id} Category:`);
      stat.actions.forEach(action => {
        console.log(`  - ${action.action}: ${action.count} times`);
      });
      console.log(`  Total: ${stat.totalCount} activities`);
    });

    // Export version data
    console.log('\n💾 Version Export Example:');
    const exportData = document.exportVersions({
      includeContent: false, // Exclude content for brevity
      includeMetadata: true
    });
    
    console.log(`Exported ${exportData.versions.length} versions for document "${exportData.documentTitle}"`);
    console.log('Export includes: version numbers, metadata, checksums, and statistics');

    console.log('\n🎉 Demo completed successfully!');
    console.log('\nKey Features Demonstrated:');
    console.log('✅ Automatic version creation with checksums');
    console.log('✅ Enhanced change tracking and descriptions');
    console.log('✅ Version comparison with detailed diffs');
    console.log('✅ Version restoration capabilities');
    console.log('✅ Comprehensive activity logging');
    console.log('✅ Activity statistics and analytics');
    console.log('✅ Version data export functionality');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runVersionControlDemo();
}

export { runVersionControlDemo };
