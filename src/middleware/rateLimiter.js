import rateLimit from 'express-rate-limit';
import { logger } from '../config/logger.js';
import redisClient from '../config/redis.js';

// Redis store for rate limiting (if Redis is available)
const createRedisStore = () => {
  if (!redisClient.isConnectionReady()) {
    return undefined;
  }

  return {
    incr: async (key) => {
      const client = redisClient.getClient();
      const current = await client.incr(key);
      if (current === 1) {
        await client.expire(key, 900); // 15 minutes
      }
      return { totalHits: current, resetTime: new Date(Date.now() + 900000) };
    },
    decrement: async (key) => {
      const client = redisClient.getClient();
      return await client.decr(key);
    },
    resetKey: async (key) => {
      const client = redisClient.getClient();
      return await client.del(key);
    }
  };
};

// Custom key generator that includes organization for multi-tenancy
const createKeyGenerator = (prefix = 'rl') => {
  return (req) => {
    const ip = req.ip || req.connection.remoteAddress;
    const userId = req.user?.id || 'anonymous';
    const orgId = req.user?.organization?.id || 'no-org';
    return `${prefix}:${orgId}:${userId}:${ip}`;
  };
};

// Custom handler for rate limit exceeded
const rateLimitHandler = (req, res) => {
  logger.warn(`Rate limit exceeded for ${req.ip}`, {
    ip: req.ip,
    userId: req.user?.id,
    organizationId: req.user?.organization?.id,
    path: req.path,
    method: req.method
  });

  res.status(429).json({
    success: false,
    message: 'Too many requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: Math.round(req.rateLimit.resetTime / 1000)
  });
};

// General rate limiter
export const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  keyGenerator: createKeyGenerator('general'),
  handler: rateLimitHandler,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  }
});

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  keyGenerator: createKeyGenerator('auth'),
  handler: rateLimitHandler,
  skipSuccessfulRequests: true // Don't count successful requests
});

// Rate limiter for document operations
export const documentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each user to 30 document operations per minute
  message: 'Too many document operations, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  keyGenerator: createKeyGenerator('document'),
  handler: rateLimitHandler
});

// Rate limiter for real-time collaboration
export const collaborationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each user to 100 collaboration events per minute
  message: 'Too many collaboration events, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  keyGenerator: createKeyGenerator('collab'),
  handler: rateLimitHandler
});

// Rate limiter for file uploads
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each user to 10 uploads per 15 minutes
  message: 'Too many file uploads, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  keyGenerator: createKeyGenerator('upload'),
  handler: rateLimitHandler
});

// Rate limiter for API endpoints
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each user to 1000 API calls per 15 minutes
  message: 'API rate limit exceeded, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  keyGenerator: createKeyGenerator('api'),
  handler: rateLimitHandler
});

// Rate limiter for search operations
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // limit each user to 20 searches per minute
  message: 'Too many search requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  keyGenerator: createKeyGenerator('search'),
  handler: rateLimitHandler
});

// Rate limiter for comment operations
export const commentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 15, // limit each user to 15 comments per minute
  message: 'Too many comments, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  keyGenerator: createKeyGenerator('comment'),
  handler: rateLimitHandler
});

// Dynamic rate limiter based on user role
export const createRoleBasedLimiter = (limits) => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req) => {
      const userRole = req.user?.role || 'viewer';
      return limits[userRole] || limits.viewer || 100;
    },
    message: 'Rate limit exceeded for your user role.',
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore(),
    keyGenerator: createKeyGenerator('role'),
    handler: rateLimitHandler
  });
};

// Organization-based rate limiter
export const createOrgLimiter = (maxPerOrg = 1000) => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: maxPerOrg,
    message: 'Organization rate limit exceeded.',
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore(),
    keyGenerator: (req) => {
      const orgId = req.user?.organization?.id || 'no-org';
      return `org:${orgId}`;
    },
    handler: rateLimitHandler
  });
};

// Middleware to apply different rate limits based on subscription plan
export const subscriptionBasedLimiter = (req, res, next) => {
  const subscription = req.user?.organization?.subscription;
  
  if (!subscription) {
    return generalLimiter(req, res, next);
  }

  const limits = {
    free: { windowMs: 15 * 60 * 1000, max: 100 },
    basic: { windowMs: 15 * 60 * 1000, max: 500 },
    premium: { windowMs: 15 * 60 * 1000, max: 2000 },
    enterprise: { windowMs: 15 * 60 * 1000, max: 10000 }
  };

  const planLimits = limits[subscription.plan] || limits.free;
  
  const dynamicLimiter = rateLimit({
    ...planLimits,
    message: `Rate limit exceeded for ${subscription.plan} plan.`,
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore(),
    keyGenerator: createKeyGenerator(`plan-${subscription.plan}`),
    handler: rateLimitHandler
  });

  return dynamicLimiter(req, res, next);
};
