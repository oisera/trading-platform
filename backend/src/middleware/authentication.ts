import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import logger from '../config/logger';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    roleId: string;
    email: string;
  };
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw new UnauthorizedError('No token provided');
  }

  jwt.verify(token, process.env.JWT_SECRET || 'default-secret', (err: any, user: any) => {
    if (err) {
      logger.warn(`Invalid token attempt: ${err.message}`);
      throw new UnauthorizedError('Invalid token');
    }
    req.user = user;
    next();
  });
}

export function authorizeRole(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError('User not authenticated');
    }

    if (!allowedRoles.includes(req.user.roleId)) {
      logger.warn(`Unauthorized access attempt by user ${req.user.userId}`);
      throw new ForbiddenError('You do not have permission to access this resource');
    }

    next();
  };
}
