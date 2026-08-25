import Joi from 'joi';
import { Logger } from './logger';

const logger = Logger.getInstance();

export class Validator {
  static validateEmail(email: string): boolean {
    const schema = Joi.string().email().required();
    const { error } = schema.validate(email);
    return !error;
  }

  static validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (password.length < 8) errors.push('Password must be at least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('Password must contain uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('Password must contain lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('Password must contain digit');
    if (!/[!@#$%^&*]/.test(password)) errors.push('Password must contain special character');
    return { valid: errors.length === 0, errors };
  }

  static validateSchema<T>(
    data: any,
    schema: Joi.Schema
  ): { valid: boolean; errors?: Record<string, string>; data?: T } {
    const { error, value } = schema.validate(data, { abortEarly: false });
    if (error) {
      const errors: Record<string, string> = {};
      error.details.forEach((detail) => {
        errors[detail.path.join('.')] = detail.message;
      });
      return { valid: false, errors };
    }
    return { valid: true, data: value as T };
  }

  static sanitizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  static sanitizeString(str: string): string {
    return str.trim().replace(/[<>"']/g, '');
  }
}
