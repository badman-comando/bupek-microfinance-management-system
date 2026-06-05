import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../types';
import { HTTP_STATUS, ErrorMessages } from '../constants';
import logger from '../config/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Decode JWT token
 */
const decodeToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * Generate JWT token
 */
export const generateToken = (user: User): string => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      branch_id: user.branch_id,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

/**
 * Authenticate token middleware
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    logger.warn('[Auth] No token provided');
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: ErrorMessages.TOKEN_REQUIRED,
    });
    return;
  }

  const decoded = decodeToken(token);

  if (!decoded) {
    logger.warn('[Auth] Invalid or expired token');
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: ErrorMessages.INVALID_TOKEN,
    });
    return;
  }

  (req as any).user = decoded;
  next();
};

/**
 * Auth middleware (alias for authenticateToken)
 */
export const authMiddleware = authenticateToken;

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const decoded = decodeToken(token);
    if (decoded) {
      (req as any).user = decoded;
    }
  }

  next();
};

/**
 * Check role middleware
 */
export const checkRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ErrorMessages.UNAUTHORIZED,
      });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      logger.warn(`[Auth] User ${user.id} denied access to role-restricted resource`);
      res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: ErrorMessages.FORBIDDEN,
      });
      return;
    }

    next();
  };
};

/**
 * Require permission middleware
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ErrorMessages.UNAUTHORIZED,
      });
      return;
    }

    // In production, check against database permissions
    // For now, we'll accept the request for authenticated users
    logger.debug(`[Auth] Permission check: ${permission} for user ${user.id}`);
    next();
  };
};
