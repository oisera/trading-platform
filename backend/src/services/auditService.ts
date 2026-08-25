import { DatabasePool } from '../utils/database';
import { AuditLog } from '../types';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = Logger.getInstance();

export class AuditService {
  private db: DatabasePool;

  constructor() {
    this.db = DatabasePool.getInstance();
  }

  async logAction(
    adminUserId: string,
    action: string,
    reason: string,
    targetUserId?: string,
    resourceType?: string,
    resourceId?: string,
    oldValues?: any,
    newValues?: any,
    ipAddress?: string
  ): Promise<AuditLog> {
    const auditId = uuidv4();
    const now = new Date();

    const audit = await this.db.queryOne<AuditLog>(
      `INSERT INTO audit_logs (id, admin_user_id, target_user_id, action, resource_type, resource_id, reason, old_values, new_values, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        auditId,
        adminUserId,
        targetUserId || null,
        action,
        resourceType || null,
        resourceId || null,
        reason,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress || null,
        now
      ]
    );

    if (!audit) {
      throw new Error('Failed to create audit log');
    }

    logger.info(`Audit log created: ${action} by ${adminUserId}`);
    return audit;
  }

  async getAuditLogs(limit: number = 100, offset: number = 0): Promise<AuditLog[]> {
    return this.db.query<AuditLog>(
      'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
  }

  async getAdminAuditLogs(adminUserId: string, limit: number = 50): Promise<AuditLog[]> {
    return this.db.query<AuditLog>(
      'SELECT * FROM audit_logs WHERE admin_user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [adminUserId, limit]
    );
  }

  async getUserAuditLogs(targetUserId: string, limit: number = 50): Promise<AuditLog[]> {
    return this.db.query<AuditLog>(
      'SELECT * FROM audit_logs WHERE target_user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [targetUserId, limit]
    );
  }
}
