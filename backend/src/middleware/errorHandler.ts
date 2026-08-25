import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  logger.error(`Error on ${req.method} ${req.path}:`, err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      errors: err.errors,
      statusCode: err.statusCode
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      statusCode: 401
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      statusCode: 401
    });
  }

  // Database errors
  if ((err as any).code === 'ECONNREFUSED') {
    return res.status(503).json({
      error: 'Database connection failed',
      statusCode: 503
    });
  }

  // Default error
  res.status(500).json({
    error: 'Internal server error',
    statusCode: 500,
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
}
