import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Basic OpenAPI definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Collaborative Document Platform API',
    version: '1.0.0',
    description: `
      A comprehensive, scalable, real-time, multi-tenant collaborative document platform API.
      
      ## Features
      - **Multi-tenant Architecture**: Complete data isolation between organizations
      - **Real-time Collaboration**: WebSocket-based real-time document editing
      - **Document Versioning**: Complete version history with restore capabilities
      - **Advanced Sharing**: Granular permission controls and sharing options
      - **Activity Tracking**: Comprehensive audit logs and activity monitoring
      - **Role-based Access Control**: Admin, Editor, and Viewer roles
      - **Rate Limiting**: Built-in protection against abuse
      - **Input Validation**: Comprehensive request validation and sanitization
      
      ## Authentication
      This API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:
      \`Authorization: Bearer <your-jwt-token>\`
      
      ## Multi-tenancy
      All endpoints automatically enforce multi-tenancy based on the authenticated user's organization.
      Users can only access resources within their own organization.
      
      ## Rate Limiting
      - General API: 100 requests per 15 minutes
      - Authentication endpoints: 5 requests per 15 minutes
      - Document operations: 50 requests per 15 minutes
      
      ## Error Handling
      The API returns consistent error responses with appropriate HTTP status codes and detailed error messages.
    `,
    contact: {
      name: 'API Support',
      email: 'support@collaborativedocs.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: process.env.API_BASE_URL || 'http://localhost:5000',
      description: 'Development server'
    },
    {
      url: 'https://api.collaborativedocs.com',
      description: 'Production server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from login endpoint'
      }
    },
    parameters: {
      organizationId: {
        name: 'organizationId',
        in: 'path',
        required: true,
        schema: {
          type: 'string',
          format: 'objectId'
        },
        description: 'Organization ID'
      },
      documentId: {
        name: 'id',
        in: 'path',
        required: true,
        schema: {
          type: 'string',
          format: 'objectId'
        },
        description: 'Document ID'
      },
      userId: {
        name: 'id',
        in: 'path',
        required: true,
        schema: {
          type: 'string',
          format: 'objectId'
        },
        description: 'User ID'
      },
      page: {
        name: 'page',
        in: 'query',
        schema: {
          type: 'integer',
          minimum: 1,
          default: 1
        },
        description: 'Page number for pagination'
      },
      limit: {
        name: 'limit',
        in: 'query',
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20
        },
        description: 'Number of items per page'
      },
      search: {
        name: 'search',
        in: 'query',
        schema: {
          type: 'string',
          maxLength: 100
        },
        description: 'Search query string'
      },
      sortBy: {
        name: 'sortBy',
        in: 'query',
        schema: {
          type: 'string',
          enum: ['createdAt', 'updatedAt', 'title', 'name']
        },
        description: 'Field to sort by'
      },
      sortOrder: {
        name: 'sortOrder',
        in: 'query',
        schema: {
          type: 'string',
          enum: ['asc', 'desc'],
          default: 'desc'
        },
        description: 'Sort order'
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and authorization endpoints'
    },
    {
      name: 'Documents',
      description: 'Document management, versioning, and collaboration'
    },
    {
      name: 'Organizations',
      description: 'Organization management and member administration'
    },
    {
      name: 'Users',
      description: 'User management and profile operations'
    },
    {
      name: 'Health',
      description: 'System health and monitoring endpoints'
    }
  ]
};

// Options for swagger-jsdoc
const options = {
  definition: swaggerDefinition,
  apis: [
    path.join(__dirname, '../routes/*.js'),
    path.join(__dirname, '../models/*.js'),
    path.join(__dirname, './swagger-schemas.js'),
    path.join(__dirname, '../app.js')
  ]
};

// Initialize swagger-jsdoc
const specs = swaggerJSDoc(options);

// Swagger UI options
const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    docExpansion: 'none',
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2
  },
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .scheme-container { margin: 20px 0; }
  `,
  customSiteTitle: 'Collaborative Document Platform API Documentation'
};

export { specs, swaggerUi, swaggerUiOptions };
