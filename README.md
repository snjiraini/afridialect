# 🌍 Afridialect.ai

> A web platform and marketplace for creating and purchasing high-quality speech datasets in African local dialects.

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6.3-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.15-38bdf8)](https://tailwindcss.com/)

## 📋 Overview

Afridialect.ai enables contributors to upload, transcribe, and translate audio clips in African local dialects (starting with Kikuyu and Swahili in Kenya). The platform ensures quality through a multi-step human-in-the-loop workflow and mints Hedera NFTs to represent ownership and payouts. Buyers can purchase datasets in a HuggingFace-compatible format.

### Key Features

- 🎤 **Audio Upload & Chunking** - Automatic 30-40s clip chunking
- ✍️ **Transcription & Translation** - Native speaker contributions
- ✅ **Multi-Stage QC Pipeline** - Content moderation and quality checks
- 🔐 **Hedera NFTs** - Blockchain-native provenance and payouts
- 📦 **HuggingFace Datasets** - ML-ready dataset packages
- 🔒 **Production-Grade Custody** - AWS KMS-backed threshold keys
- 🌐 **IPFS Storage** - Permanent storage via Pinata

## 🏗️ Tech Stack

### Core Framework
- **Next.js 16.1.6** - React framework with App Router
- **React 19.0.0** - UI library
- **TypeScript 5.6.3** - Type safety

### Blockchain & Storage
- **Hedera Hashgraph** - NFT minting and payments (HTS native)
- **Supabase** - Database, auth, and staging storage
- **Pinata/IPFS** - Permanent decentralized storage
- **AWS KMS** - Secure key management

### Styling & UI
- **Tailwind CSS 3.4.15** - Utility-first CSS
- **shadcn/ui** (planned) - Component library

### Code Quality
- **ESLint 9.17.0** - Linting
- **Prettier 3.4.2** - Code formatting

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20.x LTS or higher
- **npm** 10.0.0 or higher
- **Supabase** account (free tier available)
- **Hedera** testnet account (free)
- **Pinata** account (free tier available)
- **AWS** account (for KMS)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/snjiraini/afridialect.git
   cd afridialect
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and fill in your credentials:
   - Supabase URL and keys
   - Hedera account IDs and keys
   - Pinata API keys
   - AWS KMS configuration
   - Email provider configuration

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   ```
   http://localhost:3000
   ```

## 📁 Project Structure

```
afridialect/
├── app/                      # Next.js App Router
│   ├── api/                  # API routes
│   ├── auth/                 # Authentication pages
│   ├── dashboard/            # Main dashboard
│   ├── uploader/             # Uploader role pages
│   ├── transcriber/          # Transcriber role pages
│   ├── translator/           # Translator role pages
│   ├── reviewer/             # Reviewer/QC pages
│   ├── marketplace/          # Dataset marketplace
│   ├── admin/                # Admin panel
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Home page
├── components/               # Reusable components
│   ├── ui/                   # UI components
│   ├── forms/                # Form components
│   └── layouts/              # Layout components
├── lib/                      # Core libraries
│   ├── supabase/             # Supabase client & utils
│   ├── hedera/               # Hedera SDK integration
│   ├── ipfs/                 # Pinata/IPFS utils
│   ├── aws/                  # AWS KMS integration
│   └── utils/                # General utilities
├── types/                    # TypeScript type definitions
├── hooks/                    # React custom hooks
├── middleware/               # Next.js middleware
├── services/                 # Business logic services
├── config/                   # App configuration
├── tests/                    # Test suites
├── scripts/                  # Utility scripts
├── public/                   # Static assets
└── docs/                     # Documentation
```

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
npm run format:check     # Check formatting
npm run type-check       # Run TypeScript checks

# Testing (planned)
npm run test             # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
```

## 🗄️ Database Setup

### Supabase Schema

The database schema includes:
- Users & roles
- Audio clips & metadata
- Transcriptions & translations
- QC reviews & audit logs
- NFT records
- Purchases & datasets

Detailed schema documentation: [SCHEMA.md](docs/SCHEMA.md) (coming soon)

### Row Level Security (RLS)

All Supabase tables have RLS policies enforcing:
- Private staging data access
- Role-based permissions
- One-task-per-item constraints
- Audit trail immutability

## 🔐 Security & Best Practices

### Key Management
- **AWS KMS** for secure key generation
- **ThresholdKey (2-of-2)** for Hedera accounts
- User keys never stored in plaintext
- Separate treasury accounts per revenue stream

### Data Privacy
- Pre-mint content moderation
- Private staging storage with signed URLs
- IPFS pinning only after QC approval
- Automatic cleanup of staging data

### Rate Limiting
- API route protection
- Upload size limits
- Task claiming restrictions

## 🎯 Roadmap

### V1 (Current Phase)
- [x] Project setup
- [ ] Authentication & user management
- [ ] Audio upload pipeline
- [ ] QC workflow engine
- [ ] Hedera NFT integration
- [ ] IPFS storage
- [ ] Marketplace & dataset builder
- [ ] Admin panel

### Future Phases
- Mobile app (iOS/Android)
- Additional African dialects
- On-platform model training
- Advanced analytics
- Community features

## 📚 Documentation

- [Product Requirements Document](docs/afridialect_prd.md)
- [Project Progress](PROJECT_PROGRESS.md)
- [Dependencies & Compatibility](DEPENDENCIES.md)
- [Compatibility Test Results](COMPATIBILITY_TEST.md)

## 🤝 Contributing

This is a private project during initial development. Contributing guidelines will be added when the project goes public.

## 📄 License

Proprietary - All rights reserved

## 🔗 Links

- [Documentation](docs/)
- [Hedera Documentation](https://docs.hedera.com/)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)

## 💬 Support

For support and questions:
- Check the [docs](docs/) folder
- Review [PROJECT_PROGRESS.md](PROJECT_PROGRESS.md) for implementation status

---

**Version:** 1.0.0  
**Status:** In Development  
**Last Updated:** February 23, 2026
