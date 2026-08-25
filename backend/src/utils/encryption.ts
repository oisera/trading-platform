import crypto from 'crypto';
import { Logger } from './logger';

const logger = Logger.getInstance();

export class Encryption {
  private static encryptionKey: Buffer;

  static initialize(): void {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      logger.error('ENCRYPTION_KEY not set in environment variables');
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    if (key.length !== 32) {
      logger.error(`ENCRYPTION_KEY must be exactly 32 characters, got ${key.length}`);
      throw new Error('ENCRYPTION_KEY must be exactly 32 characters');
    }

    this.encryptionKey = Buffer.from(key);
  }

  static encrypt(plaintext: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption not initialized');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  static decrypt(encryptedData: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption not initialized');
    }

    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
