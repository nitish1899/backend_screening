# Docker Setup Guide

This guide covers the complete Docker setup for the Collaborative Document Platform, including development and production configurations.

## 📋 Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 4GB RAM available for containers
- 10GB free disk space

## 🚀 Quick Start (Development)

1. **Clone and setup environment:**
```bash
git clone <repository-url>
cd collaborative-document-platform
cp .env.docker.example .env.docker
```

2. **Start development environment:**
```bash
docker-compose up --build
```

3. **Access the application:**
- API: http://localhost:5000
- MongoDB Express: http://localhost:8081 (admin/admin123)
- Redis Commander: http://localhost:8082

## 🏗️ Architecture Overview

### Multi-Stage Dockerfile

The Dockerfile uses multi-stage builds for optimization:

- **Base**: Node.js 18 Alpine with security hardening
- **Dependencies**: Production dependency installation
- **Development**: Full development environment with hot reload
- **Production-build**: Optimized build with cleanup
- **Production**: Minimal production image
- **Testing**: Testing environment with test dependencies

### Services

#### Core Services
- **app**: Node.js application server
- **mongodb**: MongoDB 6.0 database
- **redis**: Redis 7 for caching and sessions

#### Development Tools (Profile: tools)
- **mongo-express**: MongoDB web interface
- **redis-commander**: Redis web interface

#### Production Services (Profile: proxy)
- **nginx**: Reverse proxy with SSL termination

#### Monitoring (Profile: monitoring)
- **prometheus**: Metrics collection
- **grafana**: Metrics visualization

## 🔧 Configuration

### Environment Variables

Copy `.env.docker.example` to `.env.docker` and configure:

```bash
# Required changes for production
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
MONGO_ROOT_PASSWORD=secure_root_password_change_me
MONGO_APP_PASSWORD=secure_app_password_change_me
REDIS_PASSWORD=redis_production_password_change_me
```

### Database Initialization

The MongoDB container automatically runs initialization scripts:
- `scripts/mongo-init.js` (development)
- `scripts/mongo-init-prod.js` (production)

These scripts create:
- Application database and user
- Collections with validation schemas
- Optimized indexes for multi-tenancy
- Sample data (development only)

## 🏃‍♂️ Running the Application

### Development Mode

```bash
# Start all services
docker-compose up

# Start with tools (MongoDB Express, Redis Commander)
docker-compose --profile tools up

# Rebuild and start
docker-compose up --build

# View logs
docker-compose logs -f app
```

### Production Mode

```bash
# Start production environment
docker-compose -f docker-compose.prod.yml up -d

# With monitoring
docker-compose -f docker-compose.prod.yml --profile monitoring up -d

# With reverse proxy
docker-compose -f docker-compose.prod.yml --profile proxy up -d
```

### Testing

```bash
# Run tests in container
docker-compose run --rm app npm test

# Build and run test image
docker build --target testing -t collab-doc-test .
docker run --rm collab-doc-test
```

## 🔒 Security Considerations

### Production Security

1. **Change default passwords** in `.env.docker`
2. **Configure SSL certificates** in `nginx/ssl/`
3. **Enable MongoDB authentication**
4. **Use Redis password authentication**
5. **Configure firewall rules**

### SSL/TLS Setup

Place your SSL certificates in `nginx/ssl/`:
```
nginx/ssl/
├── cert.pem
└── key.pem
```

For development, generate self-signed certificates:
```bash
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem
```

## 📊 Monitoring and Logging

### Health Checks

All services include health checks:
- **App**: HTTP health endpoint
- **MongoDB**: Connection ping
- **Redis**: Increment operation
- **Nginx**: HTTP status check

### Log Management

Logs are stored in named volumes:
- Application logs: `app-logs` volume
- Nginx logs: `nginx-logs` volume
- MongoDB logs: Container logs

View logs:
```bash
# Application logs
docker-compose logs -f app

# All service logs
docker-compose logs -f

# Specific service
docker-compose logs -f mongodb
```

### Monitoring Stack

Enable monitoring with:
```bash
docker-compose -f docker-compose.prod.yml --profile monitoring up -d
```

Access:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin123)

## 🔧 Maintenance

### Database Backup

```bash
# Create backup
docker-compose exec mongodb mongodump --out /data/backup

# Restore backup
docker-compose exec mongodb mongorestore /data/backup
```

### Volume Management

```bash
# List volumes
docker volume ls

# Backup volume
docker run --rm -v collab_mongodb-data:/data -v $(pwd):/backup alpine tar czf /backup/mongodb-backup.tar.gz /data

# Restore volume
docker run --rm -v collab_mongodb-data:/data -v $(pwd):/backup alpine tar xzf /backup/mongodb-backup.tar.gz -C /
```

### Updates

```bash
# Pull latest images
docker-compose pull

# Rebuild and restart
docker-compose up --build -d

# Remove old images
docker image prune -f
```

## 🐛 Troubleshooting

### Common Issues

1. **Port conflicts**: Change ports in docker-compose.yml
2. **Memory issues**: Increase Docker memory limit
3. **Permission errors**: Check file ownership and permissions
4. **Network issues**: Verify Docker network configuration

### Debug Commands

```bash
# Check container status
docker-compose ps

# Inspect container
docker-compose exec app sh

# Check logs
docker-compose logs app

# Restart service
docker-compose restart app

# Check resource usage
docker stats
```

### Performance Tuning

1. **Increase MongoDB cache size** in `mongodb/mongod.conf`
2. **Adjust Redis memory limit** in `redis/redis.conf`
3. **Configure Nginx worker processes** in `nginx/nginx.prod.conf`
4. **Set appropriate resource limits** in docker-compose files

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [MongoDB Docker Hub](https://hub.docker.com/_/mongo)
- [Redis Docker Hub](https://hub.docker.com/_/redis)
- [Nginx Docker Hub](https://hub.docker.com/_/nginx)
