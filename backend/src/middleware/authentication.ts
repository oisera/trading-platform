import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { Logger } from '../utils/logger';
import { JWTPayload } from '../types';

const logger = Logger.getInstance();

export interface AuthRequest extends Request {
  user?: JWTPayload;
  ip?: string;
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, secret) as JWTPayload;
    req.user = decoded;
    next();
  } catch (error: any) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    logger.warn(`Token verification failed: ${error.message}`);
    throw new UnauthorizedError('Invalid or expired token');
  }
}

export function authorizeRole(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError('User not authenticated');
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Unauthorized access attempt by user ${req.user.id} - role ${req.user.role}`);
      throw new ForbiddenError('You do not have permission to access this resource');
    }

    next();
  };
}
