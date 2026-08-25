import pool from '../config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger';

export class AuthService {
  async register(email: string, password: string, firstName: string, lastName: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if user exists
      const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        throw new Error('Email already registered');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Get user role ID
      const roleResult = await client.query('SELECT id FROM roles WHERE name = $1', ['user']);
      const roleId = roleResult.rows[0].id;

      // Create user
      const userId = uuidv4();
      const result = await client.query(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, role_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, first_name, last_name`,
        [userId, email, passwordHash, firstName, lastName, roleId]
      );

      // Create demo account
      const accountNumber = `DEMO-${email.split('@')[0]}-${uuidv4().slice(0, 8)}`;
      await client.query(
        `INSERT INTO trading_accounts (user_id, account_type, account_number, total_balance, available_balance)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'demo', accountNumber, '10000.00', '10000.00']
      );

      // Create real account
      const realAccountNumber = `REAL-${email.split('@')[0]}-${uuidv4().slice(0, 8)}`;
      await client.query(
        `INSERT INTO trading_accounts (user_id, account_type, account_number)
         VALUES ($1, $2, $3)`,
        [userId, 'real', realAccountNumber]
      );

      await client.query('COMMIT');

      logger.info(`User registered: ${email}`);
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Registration error: ${error}`);
      throw error;
    } finally {
      client.release();
    }
  }

  async login(email: string, password: string) {
    const result = await pool.query(
      `SELECT u.id, u.email, u.password_hash, u.role_id, r.name as role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = $1 AND u.is_active = true`,
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      throw new Error('Invalid email or password');
    }

    // Generate tokens
    const token = jwt.sign(
      { userId: user.id, roleId: user.role_id, email: user.email },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: process.env.JWT_EXPIRY || '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d' }
    );

    logger.info(`User logged in: ${email}`);

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role_name,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || 'default-secret') as any;

      const user = await pool.query('SELECT id, email, role_id FROM users WHERE id = $1', [
        decoded.userId,
      ]);

      if (user.rows.length === 0) {
        throw new Error('User not found');
      }

      const newToken = jwt.sign(
        { userId: user.rows[0].id, roleId: user.rows[0].role_id, email: user.rows[0].email },
        process.env.JWT_SECRET || 'default-secret',
        { expiresIn: process.env.JWT_EXPIRY || '15m' }
      );

      return { token: newToken };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }
}

export default new AuthService();
