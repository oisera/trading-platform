import winston from 'winston';
import fs from 'fs';
import path from 'path';

const logDir = process.env.LOG_DIR || './logs';

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(
    (info) =>
      `${info.timestamp} ${info.level.toUpperCase()}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
  )
);

export class Logger {
  private static instance: winston.Logger;

  static getInstance(): winston.Logger {
    if (!Logger.instance) {
      Logger.instance = winston.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: logFormat,
        transports: [
          new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error'
          }),
          new winston.transports.File({
            filename: path.join(logDir, 'combined.log')
          }),
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            )
          })
        ]
      });
    }
    return Logger.instance;
  }
}
