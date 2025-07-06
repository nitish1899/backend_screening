import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { logger } from '../config/logger.js';
import redisClient from '../config/redis.js';

// Main authentication middleware
export const authenticate = async (req, res, next) => {
  try {
    console.log('AUTH: Starting authentication');
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('AUTH: No auth header or invalid format');
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.split(' ')[1];
    console.log('AUTH: Extracted token:', token.substring(0, 20) + '...');

    // Check if token is blacklisted (for logout functionality)
    console.log('AUTH: Checking Redis connection');
    console.log('AUTH: redisClient:', typeof redisClient, redisClient);
    console.log('AUTH: redisClient.isConnectionReady:', typeof redisClient.isConnectionReady);

    if (redisClient.isConnectionReady()) {
      console.log('AUTH: Redis is ready, checking blacklist');
      const isBlacklisted = await redisClient.exists(`blacklist:${token}`);
      console.log('AUTH: Blacklist check result:', isBlacklisted);
      if (isBlacklisted) {
        return res.status(401).json({
          success: false,
          message: 'Token has been invalidated.',
          code: 'TOKEN_BLACKLISTED'
        });
      }
    } else {
      console.log('AUTH: Redis not ready, skipping blacklist check');
    }

    // Verify JWT token
    console.log('AUTH: Verifying JWT token');
    console.log('AUTH: JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('AUTH: JWT decoded:', decoded);

    // Fetch user details with organization
    console.log('AUTH: Fetching user details');
    console.log('AUTH: User model:', typeof User, User);
    const user = await User.findById(decoded.id)
      .populate('organization', 'name domain slug isActive subscription')
      .select('-password');
    console.log('AUTH: User fetched:', user ? 'SUCCESS' : 'NULL');

    if (!user) {
      console.log('AUTH: User not found');
      return res.status(401).json({
        success: false,
        message: 'User not found.',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account is deactivated.',
        code: 'USER_INACTIVE'
      });
    }

    if (!user.organization.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Organization is inactive.',
        code: 'ORGANIZATION_INACTIVE'
      });
    }

    // Add user info to request
    req.user = {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      organization: {
        id: user.organization._id,
        name: user.organization.name,
        domain: user.organization.domain,
        slug: user.organization.slug,
        subscription: user.organization.subscription
      },
      preferences: user.preferences
    };

    req.token = token;

    // Update last login if it's been more than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (!user.lastLogin || user.lastLogin < oneHourAgo) {
      user.updateLastLogin().catch(err =>
        logger.error('Failed to update last login:', err)
      );
    }

    next();
  } catch (error) {
    logger.error('Authentication error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.',
        code: 'INVALID_TOKEN'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired.',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication failed.',
      code: 'AUTH_ERROR'
    });
  }
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  try {
    await authenticate(req, res, next);
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

// Middleware to check if user is authenticated (alias for authenticate)
export const requireAuth = authenticate;

// Default export for backward compatibility
export default authenticate;
