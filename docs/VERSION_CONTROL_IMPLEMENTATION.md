# Document Version Control Implementation

## Overview

This document outlines the comprehensive document version control system implemented for the collaborative document platform. The system provides robust version tracking, comparison, restoration, and activity logging capabilities.

## Core Features

### 1. Automatic Version Creation
- **Trigger**: Every document update automatically creates a new version
- **Metadata**: Each version includes content, title, change description, editor, size, checksum, and timestamp
- **Integrity**: SHA-256 checksums ensure content integrity
- **Retention**: Configurable version retention policies prevent unlimited growth

### 2. Version Management
- **Numbering**: Sequential version numbers starting from 1
- **Current Version Tracking**: Document maintains reference to current version
- **Size Tracking**: Byte-level size calculation for each version
- **Editor Attribution**: Each version tracks who made the changes

### 3. Version Comparison
- **Diff Generation**: Line-by-line comparison between any two versions
- **Change Types**: Identifies additions, deletions, and modifications
- **Statistics**: Provides summary of total changes, additions, deletions, modifications
- **Context**: Shows line numbers and content for each change

### 4. Version Restoration
- **Selective Restore**: Restore document to any previous version
- **New Version Creation**: Restoration creates a new version (no history loss)
- **Change Tracking**: Restoration is logged as a new activity
- **Validation**: Prevents restoration to current version or non-existent versions

### 5. Activity Logging
- **Comprehensive Tracking**: All version operations are logged
- **Severity Levels**: Activities categorized by importance (low, medium, high)
- **Metadata**: Rich metadata including version numbers, checksums, file sizes
- **Organization-wide**: Activity logs available at document and organization levels

## API Endpoints

### Version Control Endpoints

```javascript
// Get all versions of a document
GET /api/documents/:id/versions

// Get specific version
GET /api/documents/:id/versions/:versionNumber

// Restore to specific version
POST /api/documents/:id/versions/:versionNumber/restore

// Compare two versions
GET /api/documents/:id/versions/compare?version1=1&version2=2
```

### Activity Logging Endpoints

```javascript
// Get document activity log
GET /api/documents/:id/activity

// Get organization-wide activity
GET /api/documents/organization/activity
```

## Implementation Details

### Database Schema

#### Version Schema (embedded in Document)
```javascript
{
  content: String,           // Version content
  title: String,            // Document title at time of version
  versionNumber: Number,    // Sequential version number
  changeDescription: String, // Description of changes made
  editedBy: ObjectId,       // User who made the changes
  size: Number,             // Content size in bytes
  checksum: String,         // SHA-256 content checksum
  createdAt: Date          // Version creation timestamp
}
```

#### Activity Schema
```javascript
{
  user: ObjectId,           // User who performed action
  organization: ObjectId,   // Organization context
  document: ObjectId,       // Document affected
  action: String,          // Action type (version_created, version_restored, etc.)
  details: String,         // Human-readable description
  category: String,        // Activity category
  severity: String,        // Importance level
  metadata: Object,        // Additional structured data
  createdAt: Date         // Activity timestamp
}
```

### Utility Functions

#### Version Control Utils (`src/utils/versionControl.js`)
- `generateChecksum(content)` - Creates SHA-256 hash
- `calculateContentSize(content)` - Calculates byte size
- `generateTextDiff(oldText, newText)` - Creates line-by-line diff
- `createVersionSnapshot(document, userId, description)` - Creates version object
- `validateVersionRestore(document, versionNumber, userId)` - Validates restore operation
- `getVersionStatistics(document)` - Generates version analytics
- `cleanupOldVersions(document, policy)` - Implements retention policies
- `exportVersionData(document, options)` - Exports version data

### Enhanced Document Model Methods

```javascript
// Create new version with enhanced tracking
document.addVersion(content, editedBy, changeDescription)

// Get specific version by number
document.getVersion(versionNumber)

// Restore to previous version
document.restoreToVersion(versionNumber, userId, changeDescription)

// Get version statistics
document.getVersionStats()

// Cleanup old versions
document.cleanupVersions(retentionPolicy)

// Export version data
document.exportVersions(options)
```

### Enhanced Activity Model Methods

```javascript
// Track document changes with severity detection
Activity.trackDocumentChange(userId, organizationId, documentId, changes, metadata)

// Get activity statistics
Activity.getActivityStats(organizationId, filters)

// Get user activity summary
Activity.getUserActivitySummary(userId, organizationId, dateRange)
```

## Validation and Security

### Input Validation
- **Version Numbers**: Must be positive integers within valid range
- **Change Descriptions**: Optional but recommended for audit trail
- **Date Ranges**: Validated for activity queries
- **Pagination**: Limits and offsets validated for performance

### Access Control
- **Document Access**: Users can only access versions of documents they have permission to view
- **Organization Isolation**: Activity logs are isolated by organization
- **Role-based Access**: Admin-only endpoints for organization-wide activities

### Data Integrity
- **Checksums**: Content integrity verification
- **Atomic Operations**: Version creation and document updates are atomic
- **Validation**: Comprehensive input validation prevents data corruption

## Performance Considerations

### Version Retention
- **Default Limit**: 50 versions per document (configurable)
- **Cleanup Policies**: Automatic cleanup of old versions based on age and count
- **Major Version Preservation**: Option to preserve versions marked as "major"

### Database Optimization
- **Indexing**: Optimized indexes for version queries and activity lookups
- **Pagination**: All list endpoints support pagination
- **Selective Loading**: Version content can be excluded from listings for performance

### Caching Strategy
- **Version Statistics**: Cached and updated incrementally
- **Activity Summaries**: Cached with TTL for frequently accessed data
- **Diff Results**: Large diffs can be cached for repeated comparisons

## Testing

### Test Coverage
- **Unit Tests**: Individual utility functions and model methods
- **Integration Tests**: Full API endpoint testing with real database
- **Performance Tests**: Version creation and comparison under load
- **Security Tests**: Access control and data isolation validation

### Test Scenarios
- Version creation with various content types and sizes
- Version comparison with different change patterns
- Version restoration with validation edge cases
- Activity logging with concurrent operations
- Retention policy enforcement
- Export functionality with different options

## Usage Examples

### Creating Versions
```javascript
// Automatic version creation on document update
const updatedDoc = await Document.findByIdAndUpdate(
  documentId,
  { content: newContent, title: newTitle },
  { new: true }
);

// Manual version creation
await document.addVersion(
  newContent,
  userId,
  'Added new section on version control'
);
```

### Comparing Versions
```javascript
const diff = generateTextDiff(version1.content, version2.content);
console.log(`Total changes: ${diff.summary.totalChanges}`);
diff.changes.forEach(change => {
  console.log(`Line ${change.lineNumber}: ${change.type}`);
});
```

### Restoring Versions
```javascript
await document.restoreToVersion(
  previousVersionNumber,
  userId,
  'Reverted problematic changes'
);
```

### Activity Monitoring
```javascript
const activities = await Activity.find({
  organization: orgId,
  document: docId,
  action: { $in: ['version_created', 'version_restored'] }
}).sort({ createdAt: -1 });
```

## Future Enhancements

### Planned Features
- **Branch and Merge**: Git-like branching for collaborative editing
- **Visual Diff**: Rich text diff visualization in the UI
- **Version Tagging**: Named tags for important versions
- **Automated Backups**: Scheduled exports of version data
- **Advanced Analytics**: Machine learning insights on editing patterns

### Performance Improvements
- **Incremental Diffs**: Store only changes between versions
- **Compression**: Content compression for older versions
- **Distributed Storage**: Move old versions to cheaper storage tiers
- **Async Processing**: Background processing for large operations

This implementation provides a robust foundation for document version control with comprehensive tracking, comparison, and restoration capabilities while maintaining performance and security standards.
