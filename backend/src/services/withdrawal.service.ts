import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger';
import { encrypt } from '../config/encryption';

export class WithdrawalService {
  async submitWithdrawalRequest(
    userId: string,
    accountId: string,
    amount: number,
    beneficiaryName: string,
    beneficiaryAccount: string,
    beneficiaryBank: string
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify account ownership and status
      const account = await client.query(
        `SELECT u.id, ta.status, ta.total_balance, ta.account_type
         FROM trading_accounts ta
         JOIN users u ON ta.user_id = u.id
         WHERE ta.id = $1 AND u.id = $2`,
        [accountId, userId]
      );

      if (account.rows.length === 0) {
        throw new Error('Account not found');
      }

      const { status, total_balance, account_type } = account.rows[0];

      // Validation checks
      if (status === 'suspended') {
        throw new Error('Account is suspended');
      }

      if (account_type === 'demo') {
        throw new Error('Cannot withdraw from demo account');
      }

      if (parseFloat(total_balance) < amount) {
        throw new Error('Insufficient balance');
      }

      // Check KYC status
      const kyc = await client.query(
        'SELECT status FROM kyc_documents WHERE user_id = $1',
        [userId]
      );

      if (kyc.rows.length === 0 || kyc.rows[0].status !== 'approved') {
        throw new Error('KYC verification required');
      }

      // Create withdrawal request
      const withdrawalId = uuidv4();
      const encryptedAccount = encrypt(beneficiaryAccount);
      const encryptedBank = encrypt(beneficiaryBank);

      const result = await client.query(
        `INSERT INTO withdrawals 
         (id, user_id, account_id, amount, status, beneficiary_name, beneficiary_account, beneficiary_bank, requested_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
         RETURNING *`,
        [withdrawalId, userId, accountId, amount, 'pending', beneficiaryName, encryptedAccount, encryptedBank]
      );

      // Create notification
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'withdrawal_pending', 'Withdrawal Request Submitted', 
         `Your withdrawal request for $${amount} has been submitted and is pending review.`, false]
      );

      await client.query('COMMIT');
      logger.info(`Withdrawal request created: ${withdrawalId} by user ${userId}`);

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Withdrawal submission error: ${error}`);
      throw error;
    } finally {
      client.release();
    }
  }

  async getWithdrawalRequests(userId: string, limit: number = 50, offset: number = 0) {
    const result = await pool.query(
      `SELECT id, amount, status, beneficiary_name, created_at, approved_at, rejected_at, rejection_notes
       FROM withdrawals
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM withdrawals WHERE user_id = $1',
      [userId]
    );

    return {
      withdrawals: result.rows,
      total: parseInt(countResult.rows[0].total),
    };
  }

  async getWithdrawalById(withdrawalId: string, userId: string) {
    const result = await pool.query(
      `SELECT id, user_id, amount, status, beneficiary_name, created_at, approved_at, 
              rejected_at, rejection_reason_code, rejection_notes, approval_notes
       FROM withdrawals
       WHERE id = $1 AND user_id = $2`,
      [withdrawalId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Withdrawal not found');
    }

    return result.rows[0];
  }

  async approveWithdrawal(withdrawalId: string, adminUserId: string, approvalNotes: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get withdrawal details
      const withdrawal = await client.query(
        `SELECT user_id, account_id, amount, status FROM withdrawals WHERE id = $1 FOR UPDATE`,
        [withdrawalId]
      );

      if (withdrawal.rows.length === 0) {
        throw new Error('Withdrawal not found');
      }

      const { user_id, account_id, amount, status } = withdrawal.rows[0];

      if (status !== 'pending') {
        throw new Error(`Cannot approve withdrawal with status: ${status}`);
      }

      // Update withdrawal
      const result = await client.query(
        `UPDATE withdrawals
         SET status = 'approved', approved_at = CURRENT_TIMESTAMP, 
             approved_by = $1, approval_notes = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [adminUserId, approvalNotes, withdrawalId]
      );

      // Hold funds (reduce available balance)
      await client.query(
        `UPDATE trading_accounts
         SET available_balance = available_balance - $1
         WHERE id = $2`,
        [amount, account_id]
      );

      // Create audit log
      await client.query(
        `INSERT INTO audit_logs 
         (id, admin_user_id, target_user_id, action, resource_type, resource_id, reason, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [uuidv4(), adminUserId, user_id, 'withdrawal_approved', 'withdrawal', withdrawalId, approvalNotes, '']
      );

      // Create notification
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read)
         VALUES ($1, $2, $3, $4, $5)`,
        [user_id, 'withdrawal_approved', 'Withdrawal Approved', 
         `Your withdrawal request for $${amount} has been approved and is being processed.`, false]
      );

      await client.query('COMMIT');
      logger.info(`Withdrawal approved: ${withdrawalId} by admin ${adminUserId}`);

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Withdrawal approval error: ${error}`);
      throw error;
    } finally {
      client.release();
    }
  }

  async rejectWithdrawal(
    withdrawalId: string,
    adminUserId: string,
    rejectionReason: string,
    rejectionNotes: string
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get withdrawal
      const withdrawal = await client.query(
        `SELECT user_id, amount, status FROM withdrawals WHERE id = $1 FOR UPDATE`,
        [withdrawalId]
      );

      if (withdrawal.rows.length === 0) {
        throw new Error('Withdrawal not found');
      }

      const { user_id, amount, status } = withdrawal.rows[0];

      if (status !== 'pending') {
        throw new Error(`Cannot reject withdrawal with status: ${status}`);
      }

      // Update withdrawal
      const result = await client.query(
        `UPDATE withdrawals
         SET status = 'rejected', rejected_at = CURRENT_TIMESTAMP,
             rejected_by = $1, rejection_reason_code = $2, rejection_notes = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [adminUserId, rejectionReason, rejectionNotes, withdrawalId]
      );

      // Create audit log (immutable record of rejection reason)
      await client.query(
        `INSERT INTO audit_logs 
         (id, admin_user_id, target_user_id, action, resource_type, resource_id, reason, new_values, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [uuidv4(), adminUserId, user_id, 'withdrawal_rejected', 'withdrawal', withdrawalId, 
         rejectionNotes, JSON.stringify({ reason: rejectionReason }), '']
      );

      // Create notification
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read)
         VALUES ($1, $2, $3, $4, $5)`,
        [user_id, 'withdrawal_rejected', 'Withdrawal Rejected', 
         `Your withdrawal request for $${amount} has been rejected. Reason: ${rejectionNotes}`, false]
      );

      await client.query('COMMIT');
      logger.info(`Withdrawal rejected: ${withdrawalId} by admin ${adminUserId}, Reason: ${rejectionReason}`);

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Withdrawal rejection error: ${error}`);
      throw error;
    } finally {
      client.release();
    }
  }

  async completeWithdrawal(withdrawalId: string, completionReference: string) {
    const result = await pool.query(
      `UPDATE withdrawals
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP, 
           completion_reference = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [completionReference, withdrawalId]
    );

    if (result.rows.length === 0) {
      throw new Error('Withdrawal not found');
    }

    logger.info(`Withdrawal completed: ${withdrawalId}`);
    return result.rows[0];
  }

  async cancelWithdrawal(withdrawalId: string, userId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const withdrawal = await client.query(
        `SELECT status, account_id, amount FROM withdrawals 
         WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [withdrawalId, userId]
      );

      if (withdrawal.rows.length === 0) {
        throw new Error('Withdrawal not found');
      }

      const { status, account_id, amount } = withdrawal.rows[0];

      if (status !== 'pending') {
        throw new Error('Can only cancel pending withdrawals');
      }

      // Update withdrawal
      const result = await client.query(
        `UPDATE withdrawals
         SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [withdrawalId]
      );

      await client.query('COMMIT');
      logger.info(`Withdrawal cancelled: ${withdrawalId} by user ${userId}`);

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Withdrawal cancellation error: ${error}`);
      throw error;
    } finally {
      client.release();
    }
  }
}

export default new WithdrawalService();
