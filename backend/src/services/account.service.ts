import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger';

export class AccountService {
  async getAccountsByUserId(userId: string) {
    const result = await pool.query(
      `SELECT id, user_id, account_type, account_number, status, 
              total_balance, available_balance, currency, created_at, updated_at
       FROM trading_accounts
       WHERE user_id = $1
       ORDER BY account_type DESC`,
      [userId]
    );
    return result.rows;
  }

  async getAccount(accountId: string, userId: string) {
    const result = await pool.query(
      `SELECT id, user_id, account_type, account_number, status, 
              total_balance, available_balance, currency, created_at, updated_at
       FROM trading_accounts
       WHERE id = $1 AND user_id = $2`,
      [accountId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Account not found');
    }

    return result.rows[0];
  }

  async getAccountBalance(accountId: string) {
    const result = await pool.query(
      `SELECT total_balance, available_balance FROM trading_accounts WHERE id = $1`,
      [accountId]
    );

    if (result.rows.length === 0) {
      throw new Error('Account not found');
    }

    return result.rows[0];
  }

  async updateBalance(accountId: string, amount: number, type: 'add' | 'subtract') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const account = await client.query(
        'SELECT total_balance, available_balance FROM trading_accounts WHERE id = $1 FOR UPDATE',
        [accountId]
      );

      if (account.rows.length === 0) {
        throw new Error('Account not found');
      }

      const currentBalance = parseFloat(account.rows[0].total_balance);
      const currentAvailable = parseFloat(account.rows[0].available_balance);

      const newBalance = type === 'add' ? currentBalance + amount : currentBalance - amount;
      const newAvailable = type === 'add' ? currentAvailable + amount : currentAvailable - amount;

      if (newBalance < 0 || newAvailable < 0) {
        throw new Error('Insufficient balance');
      }

      await client.query(
        `UPDATE trading_accounts 
         SET total_balance = $1, available_balance = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [newBalance, newAvailable, accountId]
      );

      await client.query('COMMIT');
      logger.info(`Balance updated for account ${accountId}: ${type} ${amount}`);

      return { totalBalance: newBalance, availableBalance: newAvailable };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Balance update error: ${error}`);
      throw error;
    } finally {
      client.release();
    }
  }

  async getTransactionHistory(accountId: string, userId: string, limit: number = 50, offset: number = 0) {
    const result = await pool.query(
      `SELECT id, type, amount, description, balance_before, balance_after, created_at
       FROM transactions
       WHERE account_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [accountId, userId, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM transactions WHERE account_id = $1 AND user_id = $2',
      [accountId, userId]
    );

    return {
      transactions: result.rows,
      total: parseInt(countResult.rows[0].total),
    };
  }

  async addTransaction(accountId: string, userId: string, type: string, amount: number, description: string) {
    const account = await pool.query(
      'SELECT total_balance FROM trading_accounts WHERE id = $1',
      [accountId]
    );

    const balanceBefore = parseFloat(account.rows[0].total_balance);
    const balanceAfter = balanceBefore + amount;

    const result = await pool.query(
      `INSERT INTO transactions (id, account_id, user_id, type, amount, description, balance_before, balance_after)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [uuidv4(), accountId, userId, type, amount, description, balanceBefore, balanceAfter]
    );

    return result.rows[0];
  }

  async suspendAccount(accountId: string, reason: string) {
    const result = await pool.query(
      `UPDATE trading_accounts 
       SET status = 'suspended', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [accountId]
    );

    logger.info(`Account suspended: ${accountId}, Reason: ${reason}`);
    return result.rows[0];
  }

  async unsuspendAccount(accountId: string) {
    const result = await pool.query(
      `UPDATE trading_accounts 
       SET status = 'active', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [accountId]
    );

    logger.info(`Account unsuspended: ${accountId}`);
    return result.rows[0];
  }
}

export default new AccountService();
