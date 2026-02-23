# Quick Start Guide

This guide will help you get Afridialect.ai running on your local machine in under 10 minutes.

## Prerequisites Check

Before starting, ensure you have:

- ✅ Node.js 20.x or higher installed
- ✅ npm 10.x or higher installed
- ✅ Git installed

Check your versions:
```bash
node --version  # Should be v20.x.x or higher
npm --version   # Should be 10.x.x or higher
```

## Installation Steps

### 1. Clone and Install (2 minutes)

```bash
# Clone the repository
git clone https://github.com/snjiraini/afridialect.git
cd afridialect

# Install dependencies
npm install
```

### 2. Environment Setup (5 minutes)

```bash
# Copy environment template
cp .env.example .env.local
```

**For Phase 1 development**, you only need minimal configuration:

```bash
# .env.local - Minimal setup for Phase 1
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Other variables can be filled in during Phase 2+
```

### 3. Run Development Server (1 minute)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

You should see the Afridialect.ai home page! 🎉

## Verify Installation

Run the following commands to ensure everything works:

```bash
# Check TypeScript compilation
npm run type-check

# Check code formatting
npm run format:check

# Run linting
npm run lint

# Build for production
npm run build
```

All commands should complete successfully.

## What's Next?

Now that Phase 1 is complete, the next steps are:

1. **Phase 2**: Database Schema
   - Design and implement Supabase database schema
   - Set up Row Level Security policies
   - Create migrations

2. **Phase 3**: Authentication & User Management
   - Implement Supabase Auth
   - Set up Hedera account creation
   - Build user profile management

3. **Phase 4**: Storage & Upload Pipeline
   - Configure Supabase Storage
   - Implement audio upload with validation
   - Create automatic chunking logic

## Development Workflow

### Running the App
```bash
npm run dev          # Development server (http://localhost:3000)
npm run build        # Production build
npm run start        # Production server
```

### Code Quality
```bash
npm run lint         # Run ESLint
npm run format       # Auto-format code
npm run type-check   # TypeScript checks
```

### Project Structure
```bash
npm run dev          # Auto-reloads on file changes
```

Edit files in:
- `/app` - Pages and routes
- `/components` - Reusable components
- `/lib` - Utilities and integrations
- `/types` - TypeScript types

## Common Issues

### Port 3000 Already in Use
```bash
# Use a different port
npm run dev -- -p 3001
```

### Module Not Found Errors
```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
```

### TypeScript Errors
```bash
# Restart TypeScript server in VS Code
# Cmd/Ctrl + Shift + P -> "TypeScript: Restart TS Server"
```

## Getting Help

- 📚 Check [README.md](../README.md) for detailed documentation
- 📁 Review [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md) for project organization
- 🔧 See [DEPENDENCIES.md](../DEPENDENCIES.md) for version info
- 📊 Check [PROJECT_PROGRESS.md](../PROJECT_PROGRESS.md) for implementation status

## Ready to Contribute?

1. Create a new branch for your work
2. Make your changes
3. Run `npm run format` and `npm run lint`
4. Test with `npm run build`
5. Commit and push

---

**Congratulations!** You're all set up for development. 🚀
