import { DatabasePool } from '../utils/database';
import { Transaction } from '../types';
import { NotFoundError } from '../utils/errors';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

export class TransactionService {
  private db: DatabasePool;

  constructor() {
    this.db = DatabasePool.getInstance();
  }

  async getAccountTransactions(accountId: string, limit: number = 100): Promise<Transaction[]> {
    return this.db.query<Transaction>(
      'SELECT * FROM transactions WHERE account_id = $1 ORDER BY created_at DESC LIMIT $2',
      [accountId, limit]
    );
  }

  async getUserTransactions(userId: string, limit: number = 100): Promise<Transaction[]> {
    return this.db.query<Transaction>(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
  }

  async getTransactionById(transactionId: string): Promise<Transaction> {
    const transaction = await this.db.queryOne<Transaction>(
      'SELECT * FROM transactions WHERE id = $1',
      [transactionId]
    );

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    return transaction;
  }
}
