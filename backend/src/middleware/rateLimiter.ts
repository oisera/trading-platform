import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW || '60000');
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX || '10');

export const rateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs,
  max: maxRequests,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health check
    return req.path === '/health';
  },
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({ error: 'Too many requests', retryAfter: res.getHeader('Retry-After') });
  }
});
