import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';
import { Activity } from '../models/Activity.js';
import { logger } from '../config/logger.js';
import redisClient from '../config/redis.js';

// Generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });
};

// Generate refresh token
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  });
};

// Store refresh token in Redis
const storeRefreshToken = async (userId, refreshToken) => {
  if (redisClient.isConnectionReady()) {
    const key = `refresh_token:${userId}`;
    await redisClient.set(key, refreshToken, 7 * 24 * 60 * 60); // 7 days
  }
};

// Register new user and organization
export const register = async (req, res) => {
  try {
    const { name, email, password, organizationName, organizationDomain, role = 'admin' } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
        code: 'USER_EXISTS'
      });
    }

    // Check if organization domain already exists
    const existingOrg = await Organization.findOne({ domain: organizationDomain });
    if (existingOrg) {
      return res.status(400).json({
        success: false,
        message: 'Organization with this domain already exists',
        code: 'ORGANIZATION_EXISTS'
      });
    }

    // Create organization first
    const organization = new Organization({
      name: organizationName,
      domain: organizationDomain,
      slug: organizationDomain.split('.')[0].toLowerCase(),
      settings: {
        allowPublicSharing: true,
        requireEmailVerification: false,
        defaultDocumentVisibility: 'private'
      }
    });

    await organization.save();

    // Create user
    const user = new User({
      name,
      email,
      password,
      role,
      organization: organization._id,
      isActive: true,
      emailVerified: false // In production, implement email verification
    });

    await user.save();

    // Update organization with owner
    organization.owner = user._id;
    await organization.save();

    // Log activity
    await Activity.logActivity(
      user._id,
      organization._id,
      'user_registered',
      'User registered and organization created',
      { userRole: role, organizationDomain }
    );

    // Generate tokens
    const tokenPayload = {
      id: user._id,
      email: user.email,
      role: user.role,
      organizationId: organization._id
    };

    const accessToken = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken({ id: user._id });

    // Store refresh token
    await storeRefreshToken(user._id, refreshToken);

    // Update last login
    await user.updateLastLogin();

    logger.info(`User registered successfully: ${email}`);

    res.status(201).json({
      success: true,
      message: 'User and organization created successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified
        },
        organization: {
          id: organization._id,
          name: organization.name,
          domain: organization.domain,
          slug: organization.slug
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '24h'
        }
      }
    });

  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
};

// Login user
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user with organization
    const user = await User.findOne({ email })
      .populate('organization', 'name domain slug isActive subscription')
      .select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account is deactivated',
        code: 'USER_INACTIVE'
      });
    }

    // Check if organization is active
    if (!user.organization.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Organization is inactive',
        code: 'ORGANIZATION_INACTIVE'
      });
    }

    // Generate tokens
    const tokenPayload = {
      id: user._id,
      email: user.email,
      role: user.role,
      organizationId: user.organization._id
    };

    const accessToken = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken({ id: user._id });

    // Store refresh token
    await storeRefreshToken(user._id, refreshToken);

    // Update last login
    await user.updateLastLogin();

    // Log activity
    await Activity.logActivity(
      user._id,
      user.organization._id,
      'user_login',
      'User logged in',
      { ip: req.ip, userAgent: req.get('User-Agent') }
    );

    logger.info(`User logged in successfully: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
          preferences: user.preferences
        },
        organization: {
          id: user.organization._id,
          name: user.organization.name,
          domain: user.organization.domain,
          slug: user.organization.slug,
          subscription: user.organization.subscription
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '24h'
        }
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
};

// Refresh access token
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required',
        code: 'REFRESH_TOKEN_REQUIRED'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Check if refresh token exists in Redis
    if (redisClient.isConnectionReady()) {
      const storedToken = await redisClient.get(`refresh_token:${decoded.id}`);
      if (storedToken !== refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token',
          code: 'INVALID_REFRESH_TOKEN'
        });
      }
    }

    // Get user
    const user = await User.findById(decoded.id)
      .populate('organization', 'name domain slug isActive subscription');

    if (!user || !user.isActive || !user.organization.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User or organization is inactive',
        code: 'USER_INACTIVE'
      });
    }

    // Generate new access token
    const tokenPayload = {
      id: user._id,
      email: user.email,
      role: user.role,
      organizationId: user.organization._id
    };

    const accessToken = generateToken(tokenPayload);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
      }
    });

  } catch (error) {
    logger.error('Token refresh error:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Token refresh failed',
      code: 'REFRESH_ERROR'
    });
  }
};

// Logout user
export const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const accessToken = req.token;
    const userId = req.user.id;

    // Blacklist access token
    if (redisClient.isConnectionReady() && accessToken) {
      const decoded = jwt.decode(accessToken);
      const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
      if (expiresIn > 0) {
        await redisClient.set(`blacklist:${accessToken}`, 'true', expiresIn);
      }
    }

    // Remove refresh token
    if (redisClient.isConnectionReady() && refreshToken) {
      await redisClient.del(`refresh_token:${userId}`);
    }

    // Log activity
    await Activity.logActivity(
      userId,
      req.user.organization.id,
      'user_logout',
      'User logged out',
      { ip: req.ip }
    );

    logger.info(`User logged out: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
};

// Get current user profile
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('organization', 'name domain slug subscription')
      .select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
          preferences: user.preferences,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt
        },
        organization: {
          id: user.organization._id,
          name: user.organization.name,
          domain: user.organization.domain,
          slug: user.organization.slug,
          subscription: user.organization.subscription
        }
      }
    });

  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
      code: 'PROFILE_ERROR'
    });
  }
};
