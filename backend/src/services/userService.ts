import { DatabasePool } from '../utils/database';
import { User, Role } from '../types';
import { NotFoundError, ConflictError } from '../utils/errors';
import bcrypt from 'bcryptjs';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = Logger.getInstance();

export class UserService {
  private db: DatabasePool;

  constructor() {
    this.db = DatabasePool.getInstance();
  }

  async getUserById(userId: string): Promise<User> {
    const user = await this.db.queryOne<User>(
      'SELECT id, email, first_name, last_name, role_id, is_active, is_suspended, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    );

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.db.queryOne<User>(
      'SELECT id, email, first_name, last_name, role_id, is_active, is_suspended, created_at, updated_at FROM users WHERE email = $1',
      [email]
    );
  }

  async getUserWithPasswordHash(email: string): Promise<(User & { password_hash: string }) | null> {
    return this.db.queryOne<User & { password_hash: string }>(
      'SELECT id, email, first_name, last_name, role_id, is_active, is_suspended, password_hash, created_at, updated_at FROM users WHERE email = $1',
      [email]
    );
  }

  async getUserRole(userId: string): Promise<Role> {
    const role = await this.db.queryOne<Role>(
      `SELECT r.id, r.name, r.description, r.created_at 
       FROM roles r 
       JOIN users u ON u.role_id = r.id 
       WHERE u.id = $1`,
      [userId]
    );

    if (!role) {
      throw new NotFoundError('User role not found');
    }

    return role;
  }

  async createUser(
    email: string,
    firstName: string,
    lastName: string,
    passwordHash: string,
    roleId: string = 'user'
  ): Promise<User> {
    // Check if email already exists
    const existing = await this.getUserByEmail(email);
    if (existing) {
      throw new ConflictError('Email already registered');
    }

    const userId = uuidv4();
    const now = new Date();

    const user = await this.db.queryOne<User>(
      `INSERT INTO users (id, email, first_name, last_name, password_hash, role_id, is_active, is_suspended, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, false, $7, $8)
       RETURNING id, email, first_name, last_name, role_id, is_active, is_suspended, created_at, updated_at`,
      [userId, email, firstName, lastName, passwordHash, roleId, now, now]
    );

    if (!user) {
      throw new Error('Failed to create user');
    }

    logger.info(`User created: ${userId}`);
    return user;
  }

  async updateUserProfile(userId: string, firstName: string, lastName: string): Promise<User> {
    const user = await this.db.queryOne<User>(
      `UPDATE users SET first_name = $2, last_name = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, first_name, last_name, role_id, is_active, is_suspended, created_at, updated_at`,
      [userId, firstName, lastName]
    );

    if (!user) {
      throw new NotFoundError('User not found');
    }

    logger.info(`User profile updated: ${userId}`);
    return user;
  }

  async suspendUser(userId: string, reason: string): Promise<User> {
    const user = await this.db.queryOne<User>(
      `UPDATE users SET is_suspended = true, updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, first_name, last_name, role_id, is_active, is_suspended, created_at, updated_at`,
      [userId]
    );

    if (!user) {
      throw new NotFoundError('User not found');
    }

    logger.info(`User suspended: ${userId} - Reason: ${reason}`);
    return user;
  }

  async unsuspendUser(userId: string): Promise<User> {
    const user = await this.db.queryOne<User>(
      `UPDATE users SET is_suspended = false, updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, first_name, last_name, role_id, is_active, is_suspended, created_at, updated_at`,
      [userId]
    );

    if (!user) {
      throw new NotFoundError('User not found');
    }

    logger.info(`User unsuspended: ${userId}`);
    return user;
  }

  async getAllUsers(limit: number = 50, offset: number = 0): Promise<User[]> {
    return this.db.query<User>(
      'SELECT id, email, first_name, last_name, role_id, is_active, is_suspended, created_at, updated_at FROM users LIMIT $1 OFFSET $2',
      [limit, offset]
    );
  }
}
