export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role_id: string;
  is_active: boolean;
  is_suspended: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Role {
  id: string;
  name: 'user' | 'kyc_officer' | 'compliance_officer' | 'admin';
  description: string;
  created_at: Date;
}

export interface KYCDocument {
  id: string;
  user_id: string;
  status: 'not_submitted' | 'pending' | 'approved' | 'rejected';
  id_type: string;
  id_number: string;
  full_name: string;
  date_of_birth: Date;
  address: string;
  country: string;
  submitted_at: Date | null;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface TradingAccount {
  id: string;
  user_id: string;
  account_type: 'demo' | 'real';
  account_number: string;
  status: 'active' | 'suspended' | 'closed';
  total_balance: number;
  available_balance: number;
  currency: string;
  created_at: Date;
  updated_at: Date;
}

export interface Deposit {
  id: string;
  user_id: string;
  account_id: string;
  amount: number;
  payment_method: 'bank_transfer' | 'credit_card' | 'wire_transfer';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  reference_id: string | null;
  credited_at: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  account_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  beneficiary_name: string;
  beneficiary_account: string;
  beneficiary_bank: string | null;
  approved_at: Date | null;
  approved_by: string | null;
  approval_notes: string | null;
  rejected_at: Date | null;
  rejected_by: string | null;
  rejection_reason_code: string | null;
  rejection_notes: string | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Transaction {
  id: string;
  account_id: string;
  user_id: string;
  type: 'deposit' | 'withdrawal' | 'trade' | 'fee' | 'adjustment';
  amount: number;
  description: string | null;
  balance_before: number;
  balance_after: number;
  created_at: Date;
}

export interface AuditLog {
  id: string;
  admin_user_id: string;
  target_user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  reason: string;
  old_values: any;
  new_values: any;
  ip_address: string | null;
  created_at: Date;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: Date;
}

export interface JWTPayload {
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface ApiError {
  statusCode: number;
  message: string;
  errors?: Record<string, string>;
}
