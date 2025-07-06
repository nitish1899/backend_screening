# Multi-stage Dockerfile for Collaborative Document Platform
# Stage 1: Base image with Node.js
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies for better performance and security
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Stage 2: Dependencies installation
FROM base AS dependencies

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --only=production --silent && \
    npm cache clean --force

# Stage 3: Development image
FROM base AS development

# Copy package files
COPY package*.json ./

# Install all dependencies including dev dependencies
RUN npm ci --silent && \
    npm cache clean --force

# Copy source code
COPY --chown=nodejs:nodejs . .

# Create necessary directories
RUN mkdir -p logs uploads temp && \
    chown -R nodejs:nodejs logs uploads temp

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Start application in development mode
CMD ["dumb-init", "npm", "run", "dev"]

# Stage 4: Production build
FROM base AS production-build

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --silent && \
    npm cache clean --force

# Copy source code
COPY --chown=nodejs:nodejs . .

# Remove development files and unnecessary directories
RUN rm -rf \
    tests \
    docs \
    demo \
    .git \
    .gitignore \
    README.md \
    *.md \
    .eslintrc.js \
    jest.config.js \
    nodemon.json

# Stage 5: Production image
FROM base AS production

# Set NODE_ENV to production
ENV NODE_ENV=production
ENV PORT=5000

# Copy production dependencies
COPY --from=production-build --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --from=production-build --chown=nodejs:nodejs /app/src ./src
COPY --from=production-build --chown=nodejs:nodejs /app/package*.json ./

# Create necessary directories with proper permissions
RUN mkdir -p logs uploads temp && \
    chown -R nodejs:nodejs logs uploads temp && \
    chmod 755 logs uploads temp

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check for production
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Start application
CMD ["dumb-init", "node", "src/server.js"]

# Stage 6: Testing image
FROM development AS testing

# Copy test files
COPY --chown=nodejs:nodejs tests ./tests

# Install additional testing dependencies if needed
RUN npm install --silent

# Run tests
CMD ["npm", "test"]

# Labels for better container management
LABEL maintainer="your-email@example.com"
LABEL version="1.0.0"
LABEL description="Collaborative Document Platform - Multi-tenant real-time document collaboration"
LABEL org.opencontainers.image.source="https://github.com/your-org/collaborative-document-platform"
LABEL org.opencontainers.image.documentation="https://github.com/your-org/collaborative-document-platform/blob/main/README.md"
LABEL org.opencontainers.image.licenses="MIT"
