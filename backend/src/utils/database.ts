import { Pool, PoolClient } from 'pg';
import { Logger } from './logger';

const logger = Logger.getInstance();

export class DatabasePool {
  private static instance: DatabasePool;
  private pool: Pool;

  private constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'trading_platform',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected pool error:', err);
    });
  }

  static getInstance(): DatabasePool {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new DatabasePool();
    }
    return DatabasePool.instance;
  }

  async testConnection(): Promise<void> {
    let client: PoolClient | null = null;
    try {
      client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      logger.info('Database connection successful');
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    } finally {
      if (client) client.release();
    }
  }

  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      if (duration > 1000) {
        logger.warn(`Slow query (${duration}ms): ${text.substring(0, 100)}`);
      }
      return result.rows as T[];
    } catch (error) {
      logger.error('Database query error:', { query: text, error });
      throw error;
    }
  }

  async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const results = await this.query<T>(text, params);
    return results.length > 0 ? results[0] : null;
  }

  async execute(text: string, params?: any[]): Promise<number> {
    try {
      const result = await this.pool.query(text, params);
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Database execute error:', { query: text, error });
      throw error;
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async closeConnection(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection pool closed');
  }
}
