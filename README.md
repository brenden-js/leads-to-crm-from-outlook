# Leads to CRM from Outlook

This project is a Cloudflare Workers-based application that automatically processes Outlook emails to identify and extract potential leads for a CRM system. It uses AI to analyze email content and determine if the sender is a potential lead, particularly focused on wedding-related inquiries.

## Features

- Automated email processing from Outlook using Microsoft Graph API
- AI-powered lead detection and information extraction
- Cloudflare D1 database integration for data storage
- Scheduled email checking and processing
- Secure token management using Cloudflare KV storage

## Project Structure

```
├── apps/
│   └── outlook-email-workflow/     # Main Cloudflare Worker application
├── packages/
│   └── db/                        # Database package with Drizzle ORM
├── .env.example                   # Example environment variables
├── package.json                   # Root package configuration
└── turbo.json                     # Turborepo configuration
```

## Prerequisites

- Node.js >= 18
- PNPM 8.9.0 or higher
- Cloudflare account with Workers and D1 enabled
- Microsoft Azure account with Outlook API access

## Environment Variables

Copy `.env.example` to `.env` and fill in the following variables:

```env
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_DATABASE_ID=your_database_id
CLOUDFLARE_D1_TOKEN=your_d1_token
```

Additional environment variables needed in the worker:
- `OUTLOOK_CLIENT_ID`
- `OUTLOOK_CLIENT_SECRET`
- `OUTLOOK_TENANT_ID`
- `DEFAULT_EMAIL`

## Development

1. Install dependencies:
```bash
pnpm install
```

2. Run development server:
```bash
pnpm dev
```

3. Build the project:
```bash
pnpm build
```

4. Lint the code:
```bash
pnpm lint
```

## Architecture

The project uses a monorepo structure with Turborepo for build orchestration. The main components are:

- **Outlook Email Workflow**: A Cloudflare Worker that processes emails and identifies leads
- **Database Package**: Handles data persistence using Cloudflare D1 and Drizzle ORM

## License

Private repository - All rights reserved 