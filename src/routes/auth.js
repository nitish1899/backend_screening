import express from 'express';
import {
  register,
  login,
  refreshToken,
  logout,
  getProfile
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import {
  validateUserRegistration,
  validateUserLogin,
  handleValidationErrors,
  sanitizeInput
} from '../middleware/validation.js';
import { body } from 'express-validator';

const router = express.Router();

// Apply rate limiting to all auth routes
router.use(authLimiter);

// Apply input sanitization to all routes
router.use(sanitizeInput);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register new user and organization
 *     description: |
 *       Register a new user and create a new organization. This endpoint creates both
 *       the user account and the organization in a single transaction. The user becomes
 *       the admin of the newly created organization.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *           examples:
 *             example1:
 *               summary: Complete registration
 *               value:
 *                 name: "John Doe"
 *                 email: "john.doe@acme.com"
 *                 password: "SecurePassword123!"
 *                 organizationName: "Acme Corporation"
 *                 organizationDomain: "acme.com"
 *     responses:
 *       201:
 *         description: User and organization created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *             examples:
 *               success:
 *                 summary: Successful registration
 *                 value:
 *                   success: true
 *                   message: "User and organization created successfully"
 *                   data:
 *                     user:
 *                       _id: "507f1f77bcf86cd799439011"
 *                       name: "John Doe"
 *                       email: "john.doe@acme.com"
 *                       role: "admin"
 *                       organization:
 *                         _id: "507f1f77bcf86cd799439012"
 *                         name: "Acme Corporation"
 *                         slug: "acme-corp"
 *                       isActive: true
 *                       emailVerified: false
 *                       createdAt: "2023-12-01T10:30:00Z"
 *                     tokens:
 *                       accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                       refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                       expiresIn: 3600
 *                   timestamp: "2023-12-01T10:30:00Z"
 *       400:
 *         description: Validation error or user/organization already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               validation_error:
 *                 summary: Validation error
 *                 value:
 *                   success: false
 *                   message: "Validation failed"
 *                   error:
 *                     code: "VALIDATION_ERROR"
 *                     details:
 *                       - field: "email"
 *                         message: "Valid email is required"
 *                       - field: "password"
 *                         message: "Password must be at least 8 characters long"
 *                   timestamp: "2023-12-01T10:30:00Z"
 *               user_exists:
 *                 summary: User already exists
 *                 value:
 *                   success: false
 *                   message: "User with this email already exists"
 *                   error:
 *                     code: "USER_EXISTS"
 *                   timestamp: "2023-12-01T10:30:00Z"
 *       429:
 *         description: Too many registration attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/register',
  validateUserRegistration,
  register
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: User login
 *     description: |
 *       Authenticate a user with email and password. Returns JWT tokens for
 *       accessing protected endpoints. The access token should be included
 *       in the Authorization header for subsequent requests.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           examples:
 *             example1:
 *               summary: Valid login credentials
 *               value:
 *                 email: "john.doe@acme.com"
 *                 password: "SecurePassword123!"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *             examples:
 *               success:
 *                 summary: Successful login
 *                 value:
 *                   success: true
 *                   message: "Login successful"
 *                   data:
 *                     user:
 *                       _id: "507f1f77bcf86cd799439011"
 *                       name: "John Doe"
 *                       email: "john.doe@acme.com"
 *                       role: "editor"
 *                       organization:
 *                         _id: "507f1f77bcf86cd799439012"
 *                         name: "Acme Corporation"
 *                         slug: "acme-corp"
 *                       isActive: true
 *                       lastLogin: "2023-12-01T10:30:00Z"
 *                     tokens:
 *                       accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                       refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                       expiresIn: 3600
 *                   timestamp: "2023-12-01T10:30:00Z"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Invalid credentials or inactive account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalid_credentials:
 *                 summary: Invalid email or password
 *                 value:
 *                   success: false
 *                   message: "Invalid email or password"
 *                   error:
 *                     code: "INVALID_CREDENTIALS"
 *                   timestamp: "2023-12-01T10:30:00Z"
 *               account_inactive:
 *                 summary: Account is inactive
 *                 value:
 *                   success: false
 *                   message: "Account is inactive. Please contact your administrator."
 *                   error:
 *                     code: "ACCOUNT_INACTIVE"
 *                   timestamp: "2023-12-01T10:30:00Z"
 *       429:
 *         description: Too many login attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login',
  validateUserLogin,
  login
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Authentication]
 *     summary: Refresh access token
 *     description: |
 *       Generate a new access token using a valid refresh token.
 *       Use this endpoint when the access token expires to get a new one
 *       without requiring the user to log in again.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *           examples:
 *             example1:
 *               summary: Valid refresh token
 *               value:
 *                 refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Token refreshed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                     expiresIn:
 *                       type: integer
 *                       example: 3600
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2023-12-01T10:30:00Z"
 *       400:
 *         description: Validation error or missing refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Invalid or expired refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalid_token:
 *                 summary: Invalid refresh token
 *                 value:
 *                   success: false
 *                   message: "Invalid or expired refresh token"
 *                   error:
 *                     code: "INVALID_REFRESH_TOKEN"
 *                   timestamp: "2023-12-01T10:30:00Z"
 *       429:
 *         description: Too many refresh attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/refresh',
  [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required'),
    handleValidationErrors
  ],
  refreshToken
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: User logout
 *     description: |
 *       Log out the current user and invalidate their refresh token.
 *       This endpoint requires authentication and will blacklist the
 *       provided refresh token to prevent its future use.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token to invalidate (optional)
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *           examples:
 *             with_refresh_token:
 *               summary: Logout with refresh token
 *               value:
 *                 refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *             without_refresh_token:
 *               summary: Logout without refresh token
 *               value: {}
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             examples:
 *               success:
 *                 summary: Successful logout
 *                 value:
 *                   success: true
 *                   message: "Logout successful"
 *                   timestamp: "2023-12-01T10:30:00Z"
 *       401:
 *         description: Unauthorized - invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/logout',
  authenticate,
  [
    body('refreshToken')
      .optional()
      .isString()
      .withMessage('Refresh token must be a string'),
    handleValidationErrors
  ],
  logout
);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     tags: [Authentication]
 *     summary: Get current user profile
 *     description: |
 *       Retrieve the profile information of the currently authenticated user.
 *       This includes user details, organization information, and preferences.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Profile retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2023-12-01T10:30:00Z"
 *             examples:
 *               success:
 *                 summary: Successful profile retrieval
 *                 value:
 *                   success: true
 *                   message: "Profile retrieved successfully"
 *                   data:
 *                     user:
 *                       _id: "507f1f77bcf86cd799439011"
 *                       name: "John Doe"
 *                       email: "john.doe@acme.com"
 *                       role: "editor"
 *                       organization:
 *                         _id: "507f1f77bcf86cd799439012"
 *                         name: "Acme Corporation"
 *                         slug: "acme-corp"
 *                       isActive: true
 *                       lastLogin: "2023-12-01T09:00:00Z"
 *                       preferences:
 *                         theme: "dark"
 *                         notifications:
 *                           email: true
 *                           push: false
 *                           documentShared: true
 *                           documentEdited: true
 *                         language: "en"
 *                       emailVerified: true
 *                       createdAt: "2023-11-01T09:00:00Z"
 *                       updatedAt: "2023-12-01T10:30:00Z"
 *                   timestamp: "2023-12-01T10:30:00Z"
 *       401:
 *         description: Unauthorized - invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missing_token:
 *                 summary: Missing authorization token
 *                 value:
 *                   success: false
 *                   message: "Access token is required"
 *                   error:
 *                     code: "MISSING_TOKEN"
 *                   timestamp: "2023-12-01T10:30:00Z"
 *               invalid_token:
 *                 summary: Invalid authorization token
 *                 value:
 *                   success: false
 *                   message: "Invalid or expired token"
 *                   error:
 *                     code: "INVALID_TOKEN"
 *                   timestamp: "2023-12-01T10:30:00Z"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/profile',
  authenticate,
  getProfile
);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile',
  authenticate,
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters'),
    body('preferences.theme')
      .optional()
      .isIn(['light', 'dark', 'auto'])
      .withMessage('Theme must be light, dark, or auto'),
    body('preferences.language')
      .optional()
      .isIn(['en', 'es', 'fr', 'de'])
      .withMessage('Language must be a supported language code'),
    body('preferences.notifications.email')
      .optional()
      .isBoolean()
      .withMessage('Email notifications preference must be boolean'),
    body('preferences.notifications.push')
      .optional()
      .isBoolean()
      .withMessage('Push notifications preference must be boolean'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { User } = await import('../models/User.js');
      const { Activity } = await import('../models/Activity.js');
      const { logger } = await import('../config/logger.js');

      const userId = req.user.id;
      const updates = req.body;

      // Remove sensitive fields that shouldn't be updated via this endpoint
      delete updates.email;
      delete updates.password;
      delete updates.role;
      delete updates.organization;
      delete updates.isActive;
      delete updates.emailVerified;

      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updates },
        { new: true, runValidators: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Log activity
      await Activity.logActivity(
        userId,
        req.user.organization.id,
        'profile_updated',
        'User profile updated',
        { updatedFields: Object.keys(updates) }
      );

      logger.info(`User profile updated: ${user.email}`);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            preferences: user.preferences,
            updatedAt: user.updatedAt
          }
        }
      });

    } catch (error) {
      const { logger } = await import('../config/logger.js');
      logger.error('Profile update error:', error);

      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors: Object.values(error.errors).map(err => ({
            field: err.path,
            message: err.message
          }))
        });
      }

      res.status(500).json({
        success: false,
        message: 'Profile update failed',
        code: 'UPDATE_ERROR'
      });
    }
  }
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password',
  authenticate,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Password confirmation does not match');
        }
        return true;
      }),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { User } = await import('../models/User.js');
      const { Activity } = await import('../models/Activity.js');
      const { logger } = await import('../config/logger.js');

      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      // Get user with password
      const user = await User.findById(userId).select('+password');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect',
          code: 'INVALID_CURRENT_PASSWORD'
        });
      }

      // Update password
      user.password = newPassword;
      await user.save();

      // Log activity
      await Activity.logActivity(
        userId,
        req.user.organization.id,
        'password_changed',
        'User password changed',
        { ip: req.ip }
      );

      logger.info(`Password changed for user: ${user.email}`);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      const { logger } = await import('../config/logger.js');
      logger.error('Password change error:', error);

      res.status(500).json({
        success: false,
        message: 'Password change failed',
        code: 'PASSWORD_CHANGE_ERROR'
      });
    }
  }
);

export default router;
