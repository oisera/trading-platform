import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger';

export class KYCService {
  async submitKYCDocuments(
    userId: string,
    idType: string,
    idNumber: string,
    fullName: string,
    dateOfBirth: string,
    address: string,
    country: string
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if KYC already exists
      const existing = await client.query('SELECT id FROM kyc_documents WHERE user_id = $1', [userId]);

      if (existing.rows.length > 0) {
        // Update existing KYC
        const result = await client.query(
          `UPDATE kyc_documents
           SET id_type = $1, id_number = $2, full_name = $3, date_of_birth = $4,
               address = $5, country = $6, status = $7, submitted_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $8
           RETURNING *`,
          [idType, idNumber, fullName, dateOfBirth, address, country, 'pending', userId]
        );

        await client.query('COMMIT');
        logger.info(`KYC updated for user: ${userId}`);
        return result.rows[0];
      } else {
        // Create new KYC
        const kycId = uuidv4();
        const result = await client.query(
          `INSERT INTO kyc_documents 
           (id, user_id, id_type, id_number, full_name, date_of_birth, address, country, status, submitted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
           RETURNING *`,
          [kycId, userId, idType, idNumber, fullName, dateOfBirth, address, country, 'pending']
        );

        // Create notification
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message, is_read)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, 'deposit_completed', 'KYC Submitted', 
           'Your KYC documents have been submitted and are under review.', false]
        );

        await client.query('COMMIT');
        logger.info(`KYC submitted for user: ${userId}`);
        return result.rows[0];
      }
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`KYC submission error: ${error}`);
      throw error;
    } finally {
      client.release();
    }
  }

  async getKYCStatus(userId: string) {
    const result = await pool.query(
      `SELECT id, status, id_type, id_number, full_name, date_of_birth, address, country,
              submitted_at, reviewed_at, rejection_reason, created_at, updated_at
       FROM kyc_documents
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  async getPendingKYCDocuments(limit: number = 50, offset: number = 0) {
    const result = await pool.query(
      `SELECT kd.id, kd.user_id, u.email, u.first_name, u.last_name,
              kd.id_type, kd.id_number, kd.full_name, kd.date_of_birth, kd.address, kd.country,
              kd.submitted_at, kd.status
       FROM kyc_documents kd
       JOIN users u ON kd.user_id = u.id
       WHERE kd.status = 'pending'
       ORDER BY kd.submitted_at ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM kyc_documents WHERE status = $1',
      ['pending']
    );

    return {
      documents: result.rows,
      total: parseInt(countResult.rows[0].total),
    };
  }

  async approveKYC(kycId: string, adminUserId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get KYC and user
      const kyc = await client.query(
        `SELECT user_id FROM kyc_documents WHERE id = $1 FOR UPDATE`,
        [kycId]
      );

      if (kyc.rows.length === 0) {
        throw new Error('KYC document not found');
      }

      const userId = kyc.rows[0].user_id;

      // Update KYC
      const result = await client.query(
        `UPDATE kyc_documents
         SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [adminUserId, kycId]
      );

      // Create audit log
      await client.query(
        `INSERT INTO audit_logs 
         (id, admin_user_id, target_user_id, action, resource_type, resource_id, reason, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [uuidv4(), adminUserId, userId, 'kyc_approved', 'kyc', kycId, 'KYC documents verified', '']
      );

      // Create notification
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'kyc_approved', 'KYC Approved', 
         'Your KYC verification has been approved. You can now deposit and withdraw funds.', false]
      );

      await client.query('COMMIT');
      logger.info(`KYC approved: ${kycId} by admin ${adminUserId}`);

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`KYC approval error: ${error}`);
      throw error;
    } finally {
      client.release();
    }
  }

  async rejectKYC(kycId: string, adminUserId: string, rejectionReason: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get KYC and user
      const kyc = await client.query(
        `SELECT user_id FROM kyc_documents WHERE id = $1 FOR UPDATE`,
        [kycId]
      );

      if (kyc.rows.length === 0) {
        throw new Error('KYC document not found');
      }

      const userId = kyc.rows[0].user_id;

      // Update KYC
      const result = await client.query(
        `UPDATE kyc_documents
         SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1,
             rejection_reason = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [adminUserId, rejectionReason, kycId]
      );

      // Create audit log
      await client.query(
        `INSERT INTO audit_logs 
         (id, admin_user_id, target_user_id, action, resource_type, resource_id, reason, new_values, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [uuidv4(), adminUserId, userId, 'kyc_rejected', 'kyc', kycId, 
         rejectionReason, JSON.stringify({ reason: rejectionReason }), '']
      );

      // Create notification
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'kyc_rejected', 'KYC Rejected', 
         `Your KYC verification was rejected. Reason: ${rejectionReason}`, false]
      );

      await client.query('COMMIT');
      logger.info(`KYC rejected: ${kycId} by admin ${adminUserId}, Reason: ${rejectionReason}`);

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`KYC rejection error: ${error}`);
      throw error;
    } finally {
      client.release();
    }
  }

  async getKYCById(kycId: string) {
    const result = await pool.query(
      `SELECT kd.id, kd.user_id, u.email, u.first_name, u.last_name,
              kd.id_type, kd.id_number, kd.full_name, kd.date_of_birth, kd.address, kd.country,
              kd.status, kd.submitted_at, kd.reviewed_at, kd.rejection_reason
       FROM kyc_documents kd
       JOIN users u ON kd.user_id = u.id
       WHERE kd.id = $1`,
      [kycId]
    );

    if (result.rows.length === 0) {
      throw new Error('KYC document not found');
    }

    return result.rows[0];
  }

  async getAllUsersKYCStatus(limit: number = 50, offset: number = 0) {
    const result = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name,
              kd.status, kd.submitted_at, kd.reviewed_at
       FROM users u
       LEFT JOIN kyc_documents kd ON u.id = kd.user_id
       WHERE u.is_active = true
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM users WHERE is_active = true'
    );

    return {
      users: result.rows,
      total: parseInt(countResult.rows[0].total),
    };
  }
}

export default new KYCService();
