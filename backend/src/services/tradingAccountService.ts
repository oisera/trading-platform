import { DatabasePool } from '../utils/database';
import { TradingAccount } from '../types';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = Logger.getInstance();

export class TradingAccountService {
  private db: DatabasePool;

  constructor() {
    this.db = DatabasePool.getInstance();
  }

  async getUserAccounts(userId: string): Promise<TradingAccount[]> {
    return this.db.query<TradingAccount>(
      'SELECT * FROM trading_accounts WHERE user_id = $1 AND status != \'closed\' ORDER BY created_at ASC',
      [userId]
    );
  }

  async getAccountById(accountId: string): Promise<TradingAccount> {
    const account = await this.db.queryOne<TradingAccount>(
      'SELECT * FROM trading_accounts WHERE id = $1',
      [accountId]
    );

    if (!account) {
      throw new NotFoundError('Trading account not found');
    }

    return account;
  }

  async createAccount(
    userId: string,
    accountType: 'demo' | 'real',
    initialBalance: number = 10000
  ): Promise<TradingAccount> {
    const accountId = uuidv4();
    const accountNumber = this.generateAccountNumber(accountType);
    const now = new Date();

    const account = await this.db.queryOne<TradingAccount>(
      `INSERT INTO trading_accounts (id, user_id, account_type, account_number, status, total_balance, available_balance, currency, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', $5, $5, 'USD', $6, $7)
       RETURNING *`,
      [accountId, userId, accountType, accountNumber, initialBalance, now, now]
    );

    if (!account) {
      throw new Error('Failed to create trading account');
    }

    logger.info(`Trading account created: ${accountId} (${accountType}) for user ${userId}`);
    return account;
  }

  async updateBalance(accountId: string, totalBalance: number, availableBalance: number): Promise<TradingAccount> {
    const account = await this.db.queryOne<TradingAccount>(
      `UPDATE trading_accounts 
       SET total_balance = $2, available_balance = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [accountId, totalBalance, availableBalance]
    );

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    return account;
  }

  async suspendAccount(accountId: string, reason: string): Promise<TradingAccount> {
    const account = await this.db.queryOne<TradingAccount>(
      `UPDATE trading_accounts SET status = 'suspended', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [accountId]
    );

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    logger.info(`Account suspended: ${accountId} - Reason: ${reason}`);
    return account;
  }

  async getOrCreateDemoAccount(userId: string): Promise<TradingAccount> {
    let account = await this.db.queryOne<TradingAccount>(
      'SELECT * FROM trading_accounts WHERE user_id = $1 AND account_type = \'demo\'',
      [userId]
    );

    if (!account) {
      account = await this.createAccount(userId, 'demo', 10000);
    }

    return account;
  }

  private generateAccountNumber(accountType: 'demo' | 'real'): string {
    const prefix = accountType === 'demo' ? 'DEM' : 'REL';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }
}
