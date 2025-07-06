/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
 *         - organization
 *       properties:
 *         _id:
 *           type: string
 *           format: objectId
 *           description: Unique identifier for the user
 *           example: "507f1f77bcf86cd799439011"
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *           description: User's full name
 *           example: "John Doe"
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *           example: "john.doe@example.com"
 *         role:
 *           type: string
 *           enum: [admin, editor, viewer]
 *           default: viewer
 *           description: User's role within the organization
 *           example: "editor"
 *         organization:
 *           $ref: '#/components/schemas/OrganizationRef'
 *         isActive:
 *           type: boolean
 *           default: true
 *           description: Whether the user account is active
 *           example: true
 *         lastLogin:
 *           type: string
 *           format: date-time
 *           description: Last login timestamp
 *           example: "2023-12-01T10:30:00Z"
 *         profilePicture:
 *           type: string
 *           format: uri
 *           description: URL to user's profile picture
 *           example: "https://example.com/avatars/user123.jpg"
 *         preferences:
 *           $ref: '#/components/schemas/UserPreferences'
 *         emailVerified:
 *           type: boolean
 *           default: false
 *           description: Whether the user's email is verified
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: User creation timestamp
 *           example: "2023-11-01T09:00:00Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *           example: "2023-12-01T10:30:00Z"
 * 
 *     UserPreferences:
 *       type: object
 *       properties:
 *         theme:
 *           type: string
 *           enum: [light, dark, auto]
 *           default: light
 *           description: User's preferred theme
 *           example: "dark"
 *         notifications:
 *           type: object
 *           properties:
 *             email:
 *               type: boolean
 *               default: true
 *               description: Enable email notifications
 *               example: true
 *             push:
 *               type: boolean
 *               default: true
 *               description: Enable push notifications
 *               example: false
 *             documentShared:
 *               type: boolean
 *               default: true
 *               description: Notify when documents are shared
 *               example: true
 *             documentEdited:
 *               type: boolean
 *               default: true
 *               description: Notify when documents are edited
 *               example: true
 *         language:
 *           type: string
 *           default: en
 *           description: User's preferred language
 *           example: "en"
 * 
 *     Organization:
 *       type: object
 *       required:
 *         - name
 *         - domain
 *         - slug
 *       properties:
 *         _id:
 *           type: string
 *           format: objectId
 *           description: Unique identifier for the organization
 *           example: "507f1f77bcf86cd799439012"
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           description: Organization name
 *           example: "Acme Corporation"
 *         domain:
 *           type: string
 *           format: hostname
 *           description: Organization's domain
 *           example: "acme.com"
 *         slug:
 *           type: string
 *           pattern: "^[a-z0-9-]+$"
 *           description: URL-friendly organization identifier
 *           example: "acme-corp"
 *         description:
 *           type: string
 *           maxLength: 500
 *           description: Organization description
 *           example: "Leading provider of innovative solutions"
 *         logo:
 *           type: string
 *           format: uri
 *           description: URL to organization logo
 *           example: "https://example.com/logos/acme.png"
 *         settings:
 *           $ref: '#/components/schemas/OrganizationSettings'
 *         subscription:
 *           $ref: '#/components/schemas/Subscription'
 *         contactInfo:
 *           $ref: '#/components/schemas/ContactInfo'
 *         isActive:
 *           type: boolean
 *           default: true
 *           description: Whether the organization is active
 *           example: true
 *         stats:
 *           $ref: '#/components/schemas/OrganizationStats'
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Organization creation timestamp
 *           example: "2023-10-01T08:00:00Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *           example: "2023-12-01T10:30:00Z"
 * 
 *     OrganizationRef:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           format: objectId
 *           description: Organization ID
 *           example: "507f1f77bcf86cd799439012"
 *         name:
 *           type: string
 *           description: Organization name
 *           example: "Acme Corporation"
 *         slug:
 *           type: string
 *           description: Organization slug
 *           example: "acme-corp"
 * 
 *     OrganizationSettings:
 *       type: object
 *       properties:
 *         features:
 *           type: object
 *           properties:
 *             realTimeCollaboration:
 *               type: boolean
 *               default: true
 *               description: Enable real-time collaboration
 *               example: true
 *             documentVersioning:
 *               type: boolean
 *               default: true
 *               description: Enable document versioning
 *               example: true
 *             advancedSharing:
 *               type: boolean
 *               default: false
 *               description: Enable advanced sharing features
 *               example: false
 *         security:
 *           type: object
 *           properties:
 *             requireTwoFactor:
 *               type: boolean
 *               default: false
 *               description: Require two-factor authentication
 *               example: false
 *             sessionTimeout:
 *               type: integer
 *               minimum: 15
 *               maximum: 1440
 *               default: 480
 *               description: Session timeout in minutes
 *               example: 480
 *             passwordPolicy:
 *               type: object
 *               properties:
 *                 minLength:
 *                   type: integer
 *                   minimum: 6
 *                   maximum: 50
 *                   default: 8
 *                   description: Minimum password length
 *                   example: 8
 *                 requireSpecialChars:
 *                   type: boolean
 *                   default: true
 *                   description: Require special characters in passwords
 *                   example: true
 * 
 *     Subscription:
 *       type: object
 *       properties:
 *         plan:
 *           type: string
 *           enum: [free, basic, premium, enterprise]
 *           default: free
 *           description: Subscription plan
 *           example: "premium"
 *         status:
 *           type: string
 *           enum: [active, inactive, suspended, cancelled]
 *           default: active
 *           description: Subscription status
 *           example: "active"
 *         startDate:
 *           type: string
 *           format: date-time
 *           description: Subscription start date
 *           example: "2023-10-01T08:00:00Z"
 *         endDate:
 *           type: string
 *           format: date-time
 *           description: Subscription end date
 *           example: "2024-10-01T08:00:00Z"
 *         features:
 *           type: array
 *           items:
 *             type: string
 *             enum: [real_time_collaboration, version_history, advanced_sharing, api_access, sso, audit_logs]
 *           description: Available features
 *           example: ["real_time_collaboration", "version_history", "advanced_sharing"]
 * 
 *     ContactInfo:
 *       type: object
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: Contact email
 *           example: "contact@acme.com"
 *         phone:
 *           type: string
 *           description: Contact phone number
 *           example: "+1-555-123-4567"
 *         address:
 *           type: object
 *           properties:
 *             street:
 *               type: string
 *               description: Street address
 *               example: "123 Main St"
 *             city:
 *               type: string
 *               description: City
 *               example: "New York"
 *             state:
 *               type: string
 *               description: State or province
 *               example: "NY"
 *             country:
 *               type: string
 *               description: Country
 *               example: "USA"
 *             zipCode:
 *               type: string
 *               description: ZIP or postal code
 *               example: "10001"
 * 
 *     OrganizationStats:
 *       type: object
 *       properties:
 *         totalUsers:
 *           type: integer
 *           minimum: 0
 *           description: Total number of users
 *           example: 25
 *         totalDocuments:
 *           type: integer
 *           minimum: 0
 *           description: Total number of documents
 *           example: 150
 *         storageUsed:
 *           type: integer
 *           minimum: 0
 *           description: Storage used in bytes
 *           example: 1048576
 *
 *     Document:
 *       type: object
 *       required:
 *         - title
 *         - owner
 *         - organization
 *       properties:
 *         _id:
 *           type: string
 *           format: objectId
 *           description: Unique identifier for the document
 *           example: "507f1f77bcf86cd799439013"
 *         title:
 *           type: string
 *           minLength: 1
 *           maxLength: 200
 *           description: Document title
 *           example: "Project Requirements Document"
 *         content:
 *           type: string
 *           maxLength: 1048576
 *           description: Document content (max 1MB)
 *           example: "# Project Overview\n\nThis document outlines..."
 *         contentType:
 *           type: string
 *           enum: [text, markdown, html, json]
 *           default: text
 *           description: Content format type
 *           example: "markdown"
 *         owner:
 *           $ref: '#/components/schemas/UserRef'
 *         organization:
 *           $ref: '#/components/schemas/OrganizationRef'
 *         folder:
 *           $ref: '#/components/schemas/FolderRef'
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *             maxLength: 50
 *           description: Document tags
 *           example: ["requirements", "project", "planning"]
 *         status:
 *           type: string
 *           enum: [draft, published, archived, deleted]
 *           default: draft
 *           description: Document status
 *           example: "published"
 *         visibility:
 *           type: string
 *           enum: [private, organization, public]
 *           default: private
 *           description: Document visibility level
 *           example: "organization"
 *         sharedWith:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/DocumentShare'
 *           description: Users the document is shared with
 *         versions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/DocumentVersion'
 *           description: Document version history
 *         currentVersion:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *           description: Current version number
 *           example: 3
 *         isTemplate:
 *           type: boolean
 *           default: false
 *           description: Whether this document is a template
 *           example: false
 *         metadata:
 *           type: object
 *           properties:
 *             wordCount:
 *               type: integer
 *               description: Word count
 *               example: 1250
 *             readTime:
 *               type: integer
 *               description: Estimated read time in minutes
 *               example: 5
 *             lastEditedBy:
 *               $ref: '#/components/schemas/UserRef'
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Document creation timestamp
 *           example: "2023-11-15T14:30:00Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *           example: "2023-12-01T10:30:00Z"
 *
 *     DocumentShare:
 *       type: object
 *       required:
 *         - user
 *         - permission
 *         - sharedBy
 *       properties:
 *         user:
 *           $ref: '#/components/schemas/UserRef'
 *         permission:
 *           type: string
 *           enum: [viewer, editor, admin]
 *           description: Permission level for the shared user
 *           example: "editor"
 *         sharedBy:
 *           $ref: '#/components/schemas/UserRef'
 *         sharedAt:
 *           type: string
 *           format: date-time
 *           description: When the document was shared
 *           example: "2023-11-20T09:15:00Z"
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           description: When the share expires (optional)
 *           example: "2024-01-20T09:15:00Z"
 *         isActive:
 *           type: boolean
 *           default: true
 *           description: Whether the share is active
 *           example: true
 *
 *     DocumentVersion:
 *       type: object
 *       required:
 *         - version
 *         - content
 *         - createdBy
 *       properties:
 *         version:
 *           type: integer
 *           minimum: 1
 *           description: Version number
 *           example: 2
 *         content:
 *           type: string
 *           description: Content at this version
 *           example: "# Updated Project Overview\n\nThis document..."
 *         title:
 *           type: string
 *           description: Title at this version
 *           example: "Project Requirements Document v2"
 *         createdBy:
 *           $ref: '#/components/schemas/UserRef'
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Version creation timestamp
 *           example: "2023-11-25T16:45:00Z"
 *         changeLog:
 *           type: string
 *           maxLength: 500
 *           description: Description of changes made
 *           example: "Updated requirements based on stakeholder feedback"
 *         size:
 *           type: integer
 *           description: Content size in bytes
 *           example: 2048
 *
 *     UserRef:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           format: objectId
 *           description: User ID
 *           example: "507f1f77bcf86cd799439011"
 *         name:
 *           type: string
 *           description: User name
 *           example: "John Doe"
 *         email:
 *           type: string
 *           format: email
 *           description: User email
 *           example: "john.doe@example.com"
 *
 *     FolderRef:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           format: objectId
 *           description: Folder ID
 *           example: "507f1f77bcf86cd799439014"
 *         name:
 *           type: string
 *           description: Folder name
 *           example: "Project Documents"
 *         path:
 *           type: string
 *           description: Folder path
 *           example: "/projects/alpha"
 *
 *     Activity:
 *       type: object
 *       required:
 *         - user
 *         - organization
 *         - action
 *         - category
 *       properties:
 *         _id:
 *           type: string
 *           format: objectId
 *           description: Unique identifier for the activity
 *           example: "507f1f77bcf86cd799439015"
 *         user:
 *           $ref: '#/components/schemas/UserRef'
 *         organization:
 *           $ref: '#/components/schemas/OrganizationRef'
 *         document:
 *           $ref: '#/components/schemas/DocumentRef'
 *         action:
 *           type: string
 *           enum: [
 *             document_created, document_updated, document_viewed, document_shared,
 *             document_unshared, document_deleted, document_restored, document_archived,
 *             document_published, document_duplicated, document_exported,
 *             version_created, version_restored, version_viewed, version_compared,
 *             activity_viewed, organization_activity_viewed,
 *             user_invited, user_removed, user_role_changed,
 *             organization_created, organization_updated,
 *             login, logout, password_changed, profile_updated
 *           ]
 *           description: Type of activity performed
 *           example: "document_updated"
 *         details:
 *           type: string
 *           maxLength: 1000
 *           description: Additional details about the activity
 *           example: "Updated document title and content"
 *         metadata:
 *           type: object
 *           description: Additional metadata about the activity
 *           example: { "previousTitle": "Old Title", "newTitle": "New Title" }
 *         changes:
 *           type: object
 *           properties:
 *             before:
 *               type: object
 *               description: State before the change
 *             after:
 *               type: object
 *               description: State after the change
 *             fields:
 *               type: array
 *               items:
 *                 type: string
 *               description: Fields that were changed
 *               example: ["title", "content"]
 *         relatedUsers:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/UserRef'
 *           description: Users related to this activity
 *         severity:
 *           type: string
 *           enum: [low, medium, high, critical]
 *           default: low
 *           description: Activity severity level
 *           example: "medium"
 *         category:
 *           type: string
 *           enum: [document, user, organization, security, system]
 *           description: Activity category
 *           example: "document"
 *         isSystemGenerated:
 *           type: boolean
 *           default: false
 *           description: Whether this activity was system-generated
 *           example: false
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Activity tags
 *           example: ["important", "content-change"]
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Activity timestamp
 *           example: "2023-12-01T10:30:00Z"
 *
 *     Comment:
 *       type: object
 *       required:
 *         - document
 *         - organization
 *         - author
 *         - content
 *       properties:
 *         _id:
 *           type: string
 *           format: objectId
 *           description: Unique identifier for the comment
 *           example: "507f1f77bcf86cd799439016"
 *         document:
 *           $ref: '#/components/schemas/DocumentRef'
 *         organization:
 *           $ref: '#/components/schemas/OrganizationRef'
 *         author:
 *           $ref: '#/components/schemas/UserRef'
 *         content:
 *           type: string
 *           maxLength: 2000
 *           description: Comment content
 *           example: "This section needs more detail about the implementation approach."
 *         type:
 *           type: string
 *           enum: [general, suggestion, question, issue, approval]
 *           default: general
 *           description: Type of comment
 *           example: "suggestion"
 *         status:
 *           type: string
 *           enum: [open, resolved, dismissed]
 *           default: open
 *           description: Comment status
 *           example: "open"
 *         priority:
 *           type: string
 *           enum: [low, medium, high]
 *           default: medium
 *           description: Comment priority
 *           example: "high"
 *         position:
 *           type: object
 *           properties:
 *             start:
 *               type: integer
 *               minimum: 0
 *               description: Start position in document
 *               example: 150
 *             end:
 *               type: integer
 *               minimum: 0
 *               description: End position in document
 *               example: 200
 *             line:
 *               type: integer
 *               minimum: 1
 *               description: Line number in document
 *               example: 5
 *             selectedText:
 *               type: string
 *               maxLength: 500
 *               description: Selected text that was commented on
 *               example: "implementation approach"
 *         mentions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               user:
 *                 $ref: '#/components/schemas/UserRef'
 *               notified:
 *                 type: boolean
 *                 default: false
 *                 description: Whether the user was notified
 *                 example: true
 *         reactions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               user:
 *                 $ref: '#/components/schemas/UserRef'
 *               type:
 *                 type: string
 *                 enum: [like, dislike, love, laugh, angry, sad]
 *                 description: Reaction type
 *                 example: "like"
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *             maxLength: 30
 *           description: Comment tags
 *           example: ["urgent", "review"]
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Comment creation timestamp
 *           example: "2023-12-01T10:30:00Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *           example: "2023-12-01T10:35:00Z"
 *
 *     DocumentRef:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           format: objectId
 *           description: Document ID
 *           example: "507f1f77bcf86cd799439013"
 *         title:
 *           type: string
 *           description: Document title
 *           example: "Project Requirements Document"
 *
 *     # Common Response Schemas
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Operation completed successfully"
 *         data:
 *           type: object
 *           description: Response data (varies by endpoint)
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: "2023-12-01T10:30:00Z"
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "An error occurred"
 *         error:
 *           type: object
 *           properties:
 *             code:
 *               type: string
 *               example: "VALIDATION_ERROR"
 *             details:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   field:
 *                     type: string
 *                     example: "email"
 *                   message:
 *                     type: string
 *                     example: "Valid email is required"
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: "2023-12-01T10:30:00Z"
 *
 *     PaginatedResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             type: object
 *           description: Array of items (type varies by endpoint)
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *               example: 1
 *             limit:
 *               type: integer
 *               example: 20
 *             total:
 *               type: integer
 *               example: 150
 *             pages:
 *               type: integer
 *               example: 8
 *             hasNext:
 *               type: boolean
 *               example: true
 *             hasPrev:
 *               type: boolean
 *               example: false
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: "2023-12-01T10:30:00Z"
 *
 *     # Authentication Request/Response Schemas
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *           example: "john.doe@example.com"
 *         password:
 *           type: string
 *           minLength: 8
 *           description: User's password
 *           example: "SecurePassword123!"
 *
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
 *         - organizationName
 *         - organizationDomain
 *       properties:
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *           description: User's full name
 *           example: "John Doe"
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *           example: "john.doe@example.com"
 *         password:
 *           type: string
 *           minLength: 8
 *           description: User's password
 *           example: "SecurePassword123!"
 *         organizationName:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           description: Organization name
 *           example: "Acme Corporation"
 *         organizationDomain:
 *           type: string
 *           format: hostname
 *           description: Organization domain
 *           example: "acme.com"
 *
 *     AuthResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Login successful"
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               $ref: '#/components/schemas/User'
 *             tokens:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   description: JWT access token
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 refreshToken:
 *                   type: string
 *                   description: JWT refresh token
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 expiresIn:
 *                   type: integer
 *                   description: Token expiration time in seconds
 *                   example: 3600
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: "2023-12-01T10:30:00Z"
 *
 *     RefreshTokenRequest:
 *       type: object
 *       required:
 *         - refreshToken
 *       properties:
 *         refreshToken:
 *           type: string
 *           description: Valid refresh token
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *
 *     # Document Request Schemas
 *     CreateDocumentRequest:
 *       type: object
 *       required:
 *         - title
 *       properties:
 *         title:
 *           type: string
 *           minLength: 1
 *           maxLength: 200
 *           description: Document title
 *           example: "New Project Proposal"
 *         content:
 *           type: string
 *           maxLength: 1048576
 *           description: Initial document content
 *           example: "# Project Proposal\n\nThis document outlines..."
 *         contentType:
 *           type: string
 *           enum: [text, markdown, html, json]
 *           default: text
 *           description: Content format type
 *           example: "markdown"
 *         folder:
 *           type: string
 *           format: objectId
 *           description: Folder ID to place document in
 *           example: "507f1f77bcf86cd799439014"
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *             maxLength: 50
 *           description: Document tags
 *           example: ["proposal", "project", "planning"]
 *         visibility:
 *           type: string
 *           enum: [private, organization, public]
 *           default: private
 *           description: Document visibility level
 *           example: "organization"
 *         isTemplate:
 *           type: boolean
 *           default: false
 *           description: Whether this document is a template
 *           example: false
 *
 *     UpdateDocumentRequest:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           minLength: 1
 *           maxLength: 200
 *           description: Document title
 *           example: "Updated Project Proposal"
 *         content:
 *           type: string
 *           maxLength: 1048576
 *           description: Document content
 *           example: "# Updated Project Proposal\n\nThis document..."
 *         contentType:
 *           type: string
 *           enum: [text, markdown, html, json]
 *           description: Content format type
 *           example: "markdown"
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *             maxLength: 50
 *           description: Document tags
 *           example: ["proposal", "project", "planning", "updated"]
 *         status:
 *           type: string
 *           enum: [draft, published, archived]
 *           description: Document status
 *           example: "published"
 *         visibility:
 *           type: string
 *           enum: [private, organization, public]
 *           description: Document visibility level
 *           example: "organization"
 *         changeLog:
 *           type: string
 *           maxLength: 500
 *           description: Description of changes made
 *           example: "Updated requirements based on stakeholder feedback"
 *
 *     ShareDocumentRequest:
 *       type: object
 *       required:
 *         - userId
 *         - permission
 *       properties:
 *         userId:
 *           type: string
 *           format: objectId
 *           description: ID of user to share with
 *           example: "507f1f77bcf86cd799439017"
 *         permission:
 *           type: string
 *           enum: [viewer, editor, admin]
 *           description: Permission level to grant
 *           example: "editor"
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           description: When the share should expire (optional)
 *           example: "2024-01-20T09:15:00Z"
 *         message:
 *           type: string
 *           maxLength: 500
 *           description: Optional message to include with the share
 *           example: "Please review this document and provide feedback"
 *
 *     # Health Check Response
 *     HealthResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Server is healthy"
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: "2023-12-01T10:30:00Z"
 *         uptime:
 *           type: number
 *           description: Server uptime in seconds
 *           example: 86400.5
 *         environment:
 *           type: string
 *           description: Current environment
 *           example: "development"
 */
