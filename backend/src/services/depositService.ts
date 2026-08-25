import { DatabasePool } from '../utils/database';
import { Deposit } from '../types';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = Logger.getInstance();

export class DepositService {
  private db: DatabasePool;

  constructor() {
    this.db = DatabasePool.getInstance();
  }

  async getUserDeposits(userId: string, limit: number = 50): Promise<Deposit[]> {
    return this.db.query<Deposit>(
      'SELECT * FROM deposits WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
  }

  async getDepositById(depositId: string): Promise<Deposit> {
    const deposit = await this.db.queryOne<Deposit>(
      'SELECT * FROM deposits WHERE id = $1',
      [depositId]
    );

    if (!deposit) {
      throw new NotFoundError('Deposit not found');
    }

    return deposit;
  }

  async createDeposit(
    userId: string,
    accountId: string,
    amount: number,
    paymentMethod: 'bank_transfer' | 'credit_card' | 'wire_transfer',
    notes?: string
  ): Promise<Deposit> {
    if (amount <= 0) {
      throw new BadRequestError('Deposit amount must be greater than 0');
    }

    const depositId = uuidv4();
    const referenceId = this.generateReferenceId();
    const now = new Date();

    const deposit = await this.db.queryOne<Deposit>(
      `INSERT INTO deposits (id, user_id, account_id, amount, payment_method, status, reference_id, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9)
       RETURNING *`,
      [depositId, userId, accountId, amount, paymentMethod, referenceId, notes || null, now, now]
    );

    if (!deposit) {
      throw new Error('Failed to create deposit');
    }

    logger.info(`Deposit created: ${depositId} for user ${userId} - Amount: ${amount} ${paymentMethod}`);
    return deposit;
  }

  async completeDeposit(depositId: string, accountId: string, amount: number): Promise<Deposit> {
    return this.db.transaction(async (client) => {
      const now = new Date();

      const deposit = await this.db.queryOne<Deposit>(
        `UPDATE deposits SET status = 'completed', credited_at = $2, updated_at = $2 WHERE id = $1 RETURNING *`,
        [depositId, now]
      );

      if (!deposit) {
        throw new NotFoundError('Deposit not found');
      }

      // Update account balance
      await this.db.query(
        `UPDATE trading_accounts SET total_balance = total_balance + $2, available_balance = available_balance + $2, updated_at = $3 WHERE id = $1`,
        [accountId, amount, now]
      );

      // Create transaction record
      const account = await this.db.queryOne(
        'SELECT total_balance FROM trading_accounts WHERE id = $1',
        [accountId]
      );

      if (account) {
        await this.db.query(
          `INSERT INTO transactions (id, account_id, user_id, type, amount, description, balance_after, created_at)
           VALUES ($1, $2, $3, 'deposit', $4, $5, $6, $7)`,
          [uuidv4(), accountId, deposit.user_id, amount, `Deposit via ${deposit.payment_method}`, account.total_balance, now]
        );
      }

      logger.info(`Deposit completed: ${depositId} - Amount: ${amount}`);
      return deposit;
    });
  }

  async failDeposit(depositId: string): Promise<Deposit> {
    const deposit = await this.db.queryOne<Deposit>(
      `UPDATE deposits SET status = 'failed', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [depositId]
    );

    if (!deposit) {
      throw new NotFoundError('Deposit not found');
    }

    logger.info(`Deposit failed: ${depositId}`);
    return deposit;
  }

  private generateReferenceId(): string {
    return `DEP-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  }
}
