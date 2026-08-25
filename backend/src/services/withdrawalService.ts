import { DatabasePool } from '../utils/database';
import { Withdrawal } from '../types';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = Logger.getInstance();

export class WithdrawalService {
  private db: DatabasePool;

  constructor() {
    this.db = DatabasePool.getInstance();
  }

  async getUserWithdrawals(userId: string, limit: number = 50): Promise<Withdrawal[]> {
    return this.db.query<Withdrawal>(
      'SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
  }

  async getWithdrawalById(withdrawalId: string): Promise<Withdrawal> {
    const withdrawal = await this.db.queryOne<Withdrawal>(
      'SELECT * FROM withdrawals WHERE id = $1',
      [withdrawalId]
    );

    if (!withdrawal) {
      throw new NotFoundError('Withdrawal not found');
    }

    return withdrawal;
  }

  async requestWithdrawal(
    userId: string,
    accountId: string,
    amount: number,
    beneficiaryName: string,
    beneficiaryAccount: string,
    beneficiaryBank?: string
  ): Promise<Withdrawal> {
    if (amount <= 0) {
      throw new BadRequestError('Withdrawal amount must be greater than 0');
    }

    // Check available balance
    const account = await this.db.queryOne<any>(
      'SELECT available_balance FROM trading_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    if (account.available_balance < amount) {
      throw new BadRequestError('Insufficient available balance');
    }

    const withdrawalId = uuidv4();
    const now = new Date();

    const withdrawal = await this.db.queryOne<Withdrawal>(
      `INSERT INTO withdrawals (id, user_id, account_id, amount, beneficiary_name, beneficiary_account, beneficiary_bank, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9)
       RETURNING *`,
      [withdrawalId, userId, accountId, amount, beneficiaryName, beneficiaryAccount, beneficiaryBank || null, now, now]
    );

    if (!withdrawal) {
      throw new Error('Failed to create withdrawal request');
    }

    logger.info(`Withdrawal requested: ${withdrawalId} for user ${userId} - Amount: ${amount}`);
    return withdrawal;
  }

  async approveWithdrawal(withdrawalId: string, adminUserId: string, approvalNotes: string): Promise<Withdrawal> {
    const withdrawal = await this.db.queryOne<Withdrawal>(
      `UPDATE withdrawals 
       SET status = 'approved', approved_at = NOW(), approved_by = $2, approval_notes = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [withdrawalId, adminUserId, approvalNotes]
    );

    if (!withdrawal) {
      throw new NotFoundError('Withdrawal not found');
    }

    logger.info(`Withdrawal approved: ${withdrawalId} by admin ${adminUserId}`);
    return withdrawal;
  }

  async rejectWithdrawal(
    withdrawalId: string,
    adminUserId: string,
    reasonCode: string,
    rejectionNotes: string
  ): Promise<Withdrawal> {
    const withdrawal = await this.db.queryOne<Withdrawal>(
      `UPDATE withdrawals 
       SET status = 'rejected', rejected_at = NOW(), rejected_by = $2, rejection_reason_code = $3, rejection_notes = $4, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [withdrawalId, adminUserId, reasonCode, rejectionNotes]
    );

    if (!withdrawal) {
      throw new NotFoundError('Withdrawal not found');
    }

    logger.info(`Withdrawal rejected: ${withdrawalId} by admin ${adminUserId} - Reason: ${reasonCode}`);
    return withdrawal;
  }

  async completeWithdrawal(withdrawalId: string, accountId: string): Promise<Withdrawal> {
    return this.db.transaction(async (client) => {
      const now = new Date();

      const withdrawal = await this.db.queryOne<Withdrawal>(
        `UPDATE withdrawals SET status = 'completed', completed_at = $2, updated_at = $2 WHERE id = $1 RETURNING *`,
        [withdrawalId, now]
      );

      if (!withdrawal) {
        throw new NotFoundError('Withdrawal not found');
      }

      // Update account balance
      await this.db.query(
        `UPDATE trading_accounts SET available_balance = available_balance - $2, total_balance = total_balance - $2, updated_at = $3 WHERE id = $1`,
        [accountId, withdrawal.amount, now]
      );

      // Create transaction record
      const account = await this.db.queryOne(
        'SELECT total_balance FROM trading_accounts WHERE id = $1',
        [accountId]
      );

      if (account) {
        await this.db.query(
          `INSERT INTO transactions (id, account_id, user_id, type, amount, description, balance_after, created_at)
           VALUES ($1, $2, $3, 'withdrawal', $4, $5, $6, $7)`,
          [uuidv4(), accountId, withdrawal.user_id, withdrawal.amount, `Withdrawal to ${withdrawal.beneficiary_account}`, account.total_balance, now]
        );
      }

      logger.info(`Withdrawal completed: ${withdrawalId} - Amount: ${withdrawal.amount}`);
      return withdrawal;
    });
  }

  async getPendingWithdrawals(limit: number = 50): Promise<Withdrawal[]> {
    return this.db.query<Withdrawal>(
      'SELECT * FROM withdrawals WHERE status = \'pending\' ORDER BY created_at ASC LIMIT $1',
      [limit]
    );
  }
}
