-- Trading Platform Database Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Roles
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (name, description) VALUES
  ('user', 'Regular customer'),
  ('kyc_officer', 'KYC verification'),
  ('compliance_officer', 'Withdrawal approvals'),
  ('admin', 'Full access');

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role_id UUID NOT NULL REFERENCES roles(id),
  is_active BOOLEAN DEFAULT true,
  is_suspended BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- KYC Documents
CREATE TYPE kyc_status AS ENUM ('not_submitted', 'pending', 'approved', 'rejected');

CREATE TABLE kyc_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  status kyc_status DEFAULT 'not_submitted',
  id_type VARCHAR(50),
  id_number VARCHAR(100),
  full_name VARCHAR(200),
  date_of_birth DATE,
  address VARCHAR(255),
  country VARCHAR(100),
  submitted_at TIMESTAMP,
  reviewed_at TIMESTAMP,
  reviewed_by UUID REFERENCES users(id),
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kyc_user_id ON kyc_documents(user_id);

-- Trading Accounts
CREATE TYPE account_type AS ENUM ('demo', 'real');
CREATE TYPE account_status AS ENUM ('active', 'suspended', 'closed');

CREATE TABLE trading_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  account_type account_type NOT NULL,
  account_number VARCHAR(50) UNIQUE NOT NULL,
  status account_status DEFAULT 'active',
  total_balance DECIMAL(18,8) DEFAULT 0,
  available_balance DECIMAL(18,8) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'USD',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_accounts_user_id ON trading_accounts(user_id);

-- Deposits
CREATE TYPE deposit_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE payment_method AS ENUM ('bank_transfer', 'credit_card', 'wire_transfer');

CREATE TABLE deposits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  account_id UUID NOT NULL REFERENCES trading_accounts(id),
  amount DECIMAL(18,8) NOT NULL,
  payment_method payment_method NOT NULL,
  status deposit_status DEFAULT 'pending',
  reference_id VARCHAR(100),
  credited_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deposits_user_id ON deposits(user_id);

-- Withdrawals
CREATE TYPE withdrawal_status AS ENUM ('pending', 'approved', 'rejected', 'completed');
CREATE TYPE rejection_reason AS ENUM ('kyc_not_verified', 'insufficient_funds', 'account_suspended', 'fraud_detected', 'other');

CREATE TABLE withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  account_id UUID NOT NULL REFERENCES trading_accounts(id),
  amount DECIMAL(18,8) NOT NULL,
  status withdrawal_status DEFAULT 'pending',
  beneficiary_name VARCHAR(255) NOT NULL,
  beneficiary_account VARCHAR(100) NOT NULL,
  beneficiary_bank VARCHAR(255),
  approved_at TIMESTAMP,
  approved_by UUID REFERENCES users(id),
  approval_notes TEXT,
  rejected_at TIMESTAMP,
  rejected_by UUID REFERENCES users(id),
  rejection_reason_code rejection_reason,
  rejection_notes TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);

-- Transactions
CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'trade', 'fee', 'adjustment');

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES trading_accounts(id),
  user_id UUID NOT NULL REFERENCES users(id),
  type transaction_type NOT NULL,
  amount DECIMAL(18,8) NOT NULL,
  description TEXT,
  balance_before DECIMAL(18,8),
  balance_after DECIMAL(18,8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_account_id ON transactions(account_id);

-- Audit Logs (Immutable)
CREATE TYPE audit_action AS ENUM ('user_created', 'kyc_approved', 'kyc_rejected', 'withdrawal_approved', 'withdrawal_rejected', 'account_suspended', 'other');

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID NOT NULL REFERENCES users(id),
  target_user_id UUID REFERENCES users(id),
  action audit_action NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  reason TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_admin_user_id ON audit_logs(admin_user_id);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);

-- Notifications
CREATE TYPE notification_type AS ENUM ('deposit_completed', 'withdrawal_approved', 'withdrawal_rejected', 'kyc_approved', 'kyc_rejected', 'account_suspended');

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  type notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- Refresh Tokens
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  is_revoked BOOLEAN DEFAULT false,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
