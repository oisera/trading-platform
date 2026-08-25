import { DatabasePool } from '../utils/database';
import { KYCDocument } from '../types';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = Logger.getInstance();

export class KYCService {
  private db: DatabasePool;

  constructor() {
    this.db = DatabasePool.getInstance();
  }

  async getKYCStatus(userId: string): Promise<KYCDocument> {
    const kyc = await this.db.queryOne<KYCDocument>(
      'SELECT * FROM kyc_documents WHERE user_id = $1',
      [userId]
    );

    if (!kyc) {
      throw new NotFoundError('KYC document not found');
    }

    return kyc;
  }

  async submitKYC(
    userId: string,
    idType: string,
    idNumber: string,
    fullName: string,
    dateOfBirth: Date,
    address: string,
    country: string
  ): Promise<KYCDocument> {
    const existing = await this.db.queryOne<KYCDocument>(
      'SELECT id FROM kyc_documents WHERE user_id = $1',
      [userId]
    );

    const kycId = uuidv4();
    const now = new Date();

    let kyc: KYCDocument | null;

    if (existing) {
      kyc = await this.db.queryOne<KYCDocument>(
        `UPDATE kyc_documents 
         SET id_type = $2, id_number = $3, full_name = $4, date_of_birth = $5, address = $6, country = $7, status = 'pending', submitted_at = $8, updated_at = $8
         WHERE user_id = $1
         RETURNING *`,
        [userId, idType, idNumber, fullName, dateOfBirth, address, country, now]
      );
    } else {
      kyc = await this.db.queryOne<KYCDocument>(
        `INSERT INTO kyc_documents (id, user_id, id_type, id_number, full_name, date_of_birth, address, country, status, submitted_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11)
         RETURNING *`,
        [kycId, userId, idType, idNumber, fullName, dateOfBirth, address, country, now, now, now]
      );
    }

    if (!kyc) {
      throw new Error('Failed to submit KYC');
    }

    logger.info(`KYC submitted for user: ${userId}`);
    return kyc;
  }

  async approveKYC(kycId: string, adminUserId: string): Promise<KYCDocument> {
    const now = new Date();
    const kyc = await this.db.queryOne<KYCDocument>(
      `UPDATE kyc_documents 
       SET status = 'approved', reviewed_at = $2, reviewed_by = $3, updated_at = $2
       WHERE id = $1
       RETURNING *`,
      [kycId, now, adminUserId]
    );

    if (!kyc) {
      throw new NotFoundError('KYC document not found');
    }

    logger.info(`KYC approved: ${kycId} by admin ${adminUserId}`);
    return kyc;
  }

  async rejectKYC(kycId: string, adminUserId: string, rejectionReason: string): Promise<KYCDocument> {
    const now = new Date();
    const kyc = await this.db.queryOne<KYCDocument>(
      `UPDATE kyc_documents 
       SET status = 'rejected', reviewed_at = $2, reviewed_by = $3, rejection_reason = $4, updated_at = $2
       WHERE id = $1
       RETURNING *`,
      [kycId, now, adminUserId, rejectionReason]
    );

    if (!kyc) {
      throw new NotFoundError('KYC document not found');
    }

    logger.info(`KYC rejected: ${kycId} by admin ${adminUserId}`);
    return kyc;
  }

  async getPendingKYCDocuments(limit: number = 50): Promise<KYCDocument[]> {
    return this.db.query<KYCDocument>(
      'SELECT * FROM kyc_documents WHERE status = \'pending\' ORDER BY submitted_at ASC LIMIT $1',
      [limit]
    );
  }
}
