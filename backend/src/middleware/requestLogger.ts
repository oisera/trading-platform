import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const { method, path, ip } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const level = status >= 400 ? 'warn' : 'info';
    logger.log(level, `${method} ${path} - ${status} (${duration}ms)`, { ip });
  });

  next();
}
