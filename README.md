# Tale of Asia Website

[![CI](https://github.com/taleofasia/taleofasia-web/actions/workflows/ci.yml/badge.svg)](https://github.com/taleofasia/taleofasia-web/actions/workflows/ci.yml)

A modern, responsive website for the Tale of Asia Priston Tale private server, built with Next.js 14+, TypeScript, Tailwind CSS, and shadcn/ui.

## Features

- **Authentication**: User login, registration, password reset with NextAuth.js
- **Landing Page**: Medieval fantasy themed landing page with server status and crown holders
- **Rankings**: Level, PvP, Bellatra, and Battle Royale rankings
- **Account Manager**: User dashboard with character management, top-up, and voting
- **Admin Dashboard**: Website configuration, user management, payment tracking, and audit logs
- **Payment Gateways**: GCash integration (with support for additional gateways)
- **Voting System**: xtremetop100 integration with reward claiming

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **Authentication**: NextAuth.js with JWT
- **Database**: MSSQL (UserDB, GameDB, ClanDB, ServerDB, LogDB, WebDB)
- **ORM**: mssql

## Getting Started

### Prerequisites

- Node.js 20.11.1 or higher
- MSSQL Server with the following databases:
  - UserDB (existing game database)
  - GameDB (existing game database)
  - ClanDB (existing game database)
  - ServerDB (existing game database)
  - LogDB (existing game database)
  - WebDB (new website database)

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Configure environment variables in `config.env`:
```env
DB_SERVER=localhost
DB_USER=web
DB_PASSWORD=p4uL!n3

WEBDB_NAME=WebDB
USERDB_NAME=UserDB
GAMEDB_NAME=GameDB
CLANDB_NAME=ClanDB
SERVERDB_NAME=ServerDB
LOGDB_NAME=LogDB

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-change-this-in-production

NODE_ENV=development
PORT=3000
```

4. Set up the database schema:
```bash
node database/setup-schema.js
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) with your browser

See also: [CONTRIBUTING](./CONTRIBUTING.md)

## Database Schema

The WebDB contains the following tables:
- `WebsiteConfigs`: Website configuration settings
- `WebSessions`: JWT session management
- `WebUserPreferences`: User preferences and settings
- `WebAuditLogs`: Audit trail for security
- `PaymentTransactions`: Payment transaction records
- `VoteLogs`: Voting system logs
- `AdminUsers`: Admin role management

## Deployment

### Production Deployment with SSL

1. Build the application:
```bash
npm run build
```

2. Prepare SSL certificates (Cloudflare SSL):
   - Place your SSL certificates in the `ssl/` directory
   - `private-key.pem` - Private key
   - `certificate.pem` - SSL certificate

3. Run the production server on port 443:
```bash
NODE_ENV=production node server.js
```

### Using PM2 for Process Management

1. Install PM2:
```bash
npm install -g pm2
```

2. Start the application:
```bash
pm2 start server.js --name taleofasia
```

3. Configure PM2 to start on boot:
```bash
pm2 startup
pm2 save
```

## Admin Setup

To create an admin user, manually insert into the `AdminUsers` table in WebDB:

```sql
INSERT INTO AdminUsers (AccountName, Role, Permissions, CreatedAt)
VALUES ('your-username', 'admin', 'all', GETDATE())
```

## Voting System Configuration

Configure the voting postback URL in xtremetop100:
- Postback URL: `https://yourdomain.com/api/voting/postback`
- Parameters: `votingip` and `username`

## Payment Gateway Configuration

GCash is pre-configured. To add additional payment gateways:
1. Create API endpoints in `app/api/payment/`
2. Update the top-up page in `app/dashboard/topup/page.tsx`
3. Configure payment settings in the admin dashboard

## Theme

The website uses a medieval fantasy theme with:
- Primary colors: Rust gold, rust copper
- Secondary colors: Azure to light blue
- Custom gradients and shadows for depth
- Medieval-inspired UI elements

## License

© 2024 Tale of Asia. All rights reserved.
