# Trading Platform

A professional, secure trading platform with compliance-focused features, robust authentication, and comprehensive admin controls.

## Features

### Core Features
- ✅ Secure user registration and authentication (JWT + refresh tokens)
- ✅ KYC/AML verification workflow with document upload
- ✅ User profile and account dashboard
- ✅ Trading dashboard with real-time balance and P&L tracking
- ✅ Deposit flow with multiple payment method support
- ✅ Withdrawal request system with multi-stage approval workflow
- ✅ Admin dashboard for compliance and fund management
- ✅ Comprehensive audit logging for all financial transactions
- ✅ Rate limiting and fraud detection
- ✅ Mobile-responsive design
- ✅ Demo/Virtual trading balance separation from real funds
- ✅ Role-based access control (RBAC)

### Security Features
- JWT-based authentication with refresh tokens
- AES-256 encryption for sensitive data
- Password hashing with bcrypt
- Rate limiting (10 requests/minute per IP)
- SQL injection prevention
- CORS protection
- Request validation and sanitization
- Audit trail for all financial actions
- Compliance-first withdrawal approval process
- Non-custodial architecture (funds held by regulated brokers, not platform)

### Admin Controls
- Dashboard with real-time metrics
- KYC document verification system
- Deposit and withdrawal request management
- User account activity review
- Audit log viewer
- Compliance reporting
- Fraud detection alerts
- Fund integrity checks (withdrawal restrictions must have documented reasons)

### Broker Integration
- Structure for integrating regulated broker APIs
- Real-time market data feeds
- Order execution framework
- Position management system

## Tech Stack

**Frontend:**
- React 18
- TypeScript
- Tailwind CSS
- Redux Toolkit
- Axios
- React Router

**Backend:**
- Node.js + Express
- PostgreSQL
- JWT Authentication
- Winston logging
- Bull for queues
- bcryptjs for hashing

**DevOps:**
- Docker & Docker Compose
- Environment-based configuration

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Docker & Docker Compose (optional)

### Installation

```bash
# Clone repository
git clone https://github.com/oisera/trading-platform.git
cd trading-platform

# Backend setup
cd backend
npm install
cp .env.example .env
npm run db:migrate

# Frontend setup
cd ../frontend
npm install
cp .env.example .env

# Start services
cd ../backend && npm run dev    # Terminal 1
cd ../frontend && npm start     # Terminal 2
```

### Using Docker

```bash
docker-compose up --build
```

## Demo Credentials

**Customer:**
```
Email: customer@example.com
Password: Demo12345!
```

**Admin:**
```
Email: admin@example.com
Password: Admin12345!
```

## Key Compliance Features

### Fund Protection
- ✅ Customers own their funds; platform acts as intermediary
- ✅ Withdrawal requests require documented approval reasons
- ✅ Admins CANNOT arbitrarily block or alter customer funds
- ✅ All restrictions follow published platform rules
- ✅ Complete audit trail for every transaction
- ✅ Separation of demo/virtual balances from real funds

### Withdrawal Approval Process
1. User submits withdrawal request with bank details
2. System validates against compliance rules
3. Compliance officer reviews and provides documented reason
4. User receives transparent notification
5. On approval, payment processor is notified
6. User can track status in real-time

## Documentation

- [API Documentation](docs/API.md)
- [Database Schema](docs/DATABASE.md)
- [Architecture Guide](docs/ARCHITECTURE.md)
- [Compliance Guide](docs/COMPLIANCE.md)
- [Setup Instructions](docs/SETUP.md)

## Production Checklist

- [ ] Database backup strategy configured
- [ ] SSL/TLS certificates installed
- [ ] Rate limiting tuned for production
- [ ] Email service configured
- [ ] Payment processor integration tested
- [ ] Broker API integration tested
- [ ] Security audit completed
- [ ] Compliance review completed
- [ ] Insurance coverage verified
- [ ] Regulatory licensing verified

## Disclaimer

**This is a demo trading platform. It is NOT a licensed broker.** Users should not deposit real funds until:
1. Platform is registered with financial regulators
2. Payment provider integration is complete and tested
3. Broker partnership agreements are finalized
4. Compliance and security review is completed
5. Insurance coverage is in place

## License

Proprietary - Trading Platform
