# Collaborative Document Platform - Backend

A scalable, multi-tenant collaborative document platform built with Node.js, Express, MongoDB, and Socket.IO. This backend provides comprehensive APIs for document management, real-time collaboration, user authentication, and organization management.

## 🚀 Features

### Core Functionality

- **Multi-tenant Architecture** - Complete data isolation between organizations
- **Real-time Collaboration** - WebSocket-based live document editing
- **Document Management** - Full CRUD operations with versioning and history
- **User Authentication** - JWT-based auth with refresh tokens
- **Role-based Access Control** - Admin, Editor, and Viewer roles
- **Document Sharing** - Granular permission management
- **Activity Tracking** - Comprehensive audit logs and monitoring

### Technical Features

- **RESTful API** - Well-structured endpoints with comprehensive documentation
- **Interactive API Documentation** - Swagger/OpenAPI 3.0 with live testing
- **Rate Limiting** - Built-in protection against abuse
- **Input Validation** - Robust request sanitization and validation
- **Error Handling** - Centralized error management with detailed logging
- **Database Optimization** - Efficient MongoDB queries with proper indexing
- **Security** - Helmet.js, CORS, input sanitization, and JWT security

## 📋 Prerequisites

- **Node.js** >= 16.0.0
- **MongoDB** >= 5.0.0
- **Redis** >= 6.0.0 (for session management and caching)
- **npm** or **yarn** package manager

## 🛠️ Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/nitish1899/backend_screening.git
   cd backend_screening
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Setup**

   ```bash
   cp .env.example .env
   ```

   Configure the following environment variables in `.env`:

   ```env
   # Server Configuration
   NODE_ENV=development
   PORT=5000
   CLIENT_URL=http://localhost:3000

   # Database
   MONGODB_URI=mongodb://localhost:27017/collaborative_docs
   MONGODB_TEST_URI=mongodb://localhost:27017/collaborative_docs_test

   # Redis
   REDIS_URL=redis://localhost:6379

   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key
   JWT_REFRESH_SECRET=your-super-secret-refresh-key
   JWT_EXPIRE=1h
   JWT_REFRESH_EXPIRE=7d

   # Email Configuration (optional)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   ```

4. **Start MongoDB and Redis**

   ```bash
   # MongoDB
   mongod

   # Redis
   redis-server
   ```

## 🚀 Running the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 📚 API Documentation

### Interactive Documentation

Once the server is running, visit:

- **Swagger UI**: `http://localhost:5000/api-docs`
- **OpenAPI Spec**: `http://localhost:5000/api-docs.json`

### API Endpoints Overview

#### Authentication

- `POST /api/auth/register` - Register new user and organization
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get current user profile

#### Documents

- `GET /api/documents` - Get all documents (with pagination and filtering)
- `GET /api/documents/:id` - Get single document
- `POST /api/documents` - Create new document
- `PUT /api/documents/:id` - Update document
- `DELETE /api/documents/:id` - Delete document
- `POST /api/documents/:id/share` - Share document with user
- `GET /api/documents/:id/versions` - Get document version history
- `POST /api/documents/:id/versions/:version/restore` - Restore document version

#### Organizations

- `GET /api/organizations/profile` - Get organization profile
- `PUT /api/organizations/profile` - Update organization
- `GET /api/organizations/members` - Get organization members
- `POST /api/organizations/members/invite` - Invite new member
- `PUT /api/organizations/members/:id/role` - Update member role
- `DELETE /api/organizations/members/:id` - Remove member

#### Users

- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/activity` - Get user activity history

### Rate Limits

- **General API**: 100 requests per 15 minutes
- **Authentication**: 5 requests per 15 minutes
- **Document Operations**: 50 requests per 15 minutes

## 🏗️ Project Structure

```
src/
├── config/           # Configuration files
│   ├── database.js   # MongoDB connection
│   ├── logger.js     # Winston logger setup
│   ├── swagger.js    # API documentation config
│   └── swagger-schemas.js # OpenAPI schemas
├── controllers/      # Route controllers
├── middleware/       # Custom middleware
│   ├── auth.js       # Authentication middleware
│   ├── rateLimiter.js # Rate limiting
│   └── validation.js # Input validation
├── models/          # Mongoose models
│   ├── User.js      # User model
│   ├── Organization.js # Organization model
│   ├── Document.js  # Document model
│   └── Activity.js  # Activity logging model
├── routes/          # API routes
│   ├── auth.js      # Authentication routes
│   ├── documents.js # Document management
│   ├── organizations.js # Organization management
│   └── users.js     # User management
├── utils/           # Utility functions
│   ├── collaboration.js # WebSocket handlers
│   └── helpers.js   # Common helpers
├── app.js           # Express app setup
└── server.js        # Server entry point
```

## 🔧 Configuration

### Database Indexes

The application automatically creates necessary indexes for optimal performance:

- User email uniqueness
- Organization domain uniqueness
- Document search optimization
- Activity timestamp indexing

### Security Features

- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - Request throttling
- **Input Sanitization** - XSS and injection prevention
- **JWT Security** - Secure token handling

## 🧪 Testing

The project includes comprehensive test suites:

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e
```

### Coverage Requirements

- **Global**: 80% minimum
- **Controllers**: 85% minimum
- **Middleware**: 90% minimum

## 🚀 Deployment

### Docker Support

```bash
# Build image
docker build -t collaborative-docs-backend .

# Run container
docker run -p 5000:5000 --env-file .env collaborative-docs-backend
```

### Environment Variables for Production

Ensure these are properly configured:

- Set `NODE_ENV=production`
- Use strong JWT secrets
- Configure proper database URLs
- Set up email service credentials
- Configure CORS for your frontend domain

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- Check the [API Documentation](http://localhost:5000/api-docs)
- Review the test files for usage examples
- Open an issue for bug reports or feature requests

## 🔄 Version History

- **v1.0.0** - Initial release with core functionality
  - Multi-tenant document management
  - Real-time collaboration
  - Comprehensive API documentation
  - JWT authentication
  - Role-based access control
