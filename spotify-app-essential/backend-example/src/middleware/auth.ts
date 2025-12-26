/**
 * Authentication Middleware - JWT validation
 */

import { Request, Response, NextFunction } from 'express';
import TokenService from '../services/TokenService';
import { JWTPayload } from '../services/TokenService';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Middleware to authenticate JWT token
 */
export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // Verify token
    const decoded = TokenService.verifyToken(token);

    // Attach user to request
    req.user = decoded;

    next();

  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'TOKEN_EXPIRED') {
        res.status(401).json({
          success: false,
          message: 'Token expired',
          code: 'TOKEN_EXPIRED',
        });
        return;
      } else if (error.message === 'INVALID_TOKEN') {
        res.status(401).json({
          success: false,
          message: 'Invalid token',
          code: 'INVALID_TOKEN',
        });
        return;
      }
    }

    res.status(401).json({
      success: false,
      message: 'Authentication failed',
    });
  }
};

/**
 * Optional authentication - continues even if no token
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = TokenService.verifyToken(token);
      req.user = decoded;
    }

    next();

  } catch (error) {
    // Continue without user
    next();
  }
};
