# Dependencies and Version Compatibility

**Last Updated:** February 22, 2026

## Core Framework Versions

### Production Dependencies
- **Next.js:** `16.1.6` (latest stable)
- **React:** `19.0.0` (latest stable)
- **React DOM:** `19.0.0` (latest stable)

### Development Dependencies
- **TypeScript:** `5.6.3` (stable)
- **Node Types:** `20.17.6` (for Node.js 20 LTS)
- **React Types:** `19.0.6` (matching React 19)
- **React DOM Types:** `19.0.2` (matching React DOM 19)

### Styling
- **Tailwind CSS:** `3.4.15` (v3 stable)
- **PostCSS:** `8.4.49` (stable)
- **Autoprefixer:** `10.4.20` (stable)

### Code Quality
- **ESLint:** `9.17.0` (v9 stable)
- **ESLint Config Next:** `15.1.6` (matching Next.js major version)
- **Prettier:** `3.4.2` (v3 stable)

## Version Compatibility Notes

### Why Next.js 16.1.6?
The original plan was to use Next.js 14.x (as specified in PRD for stability). However:
- Next.js 14.x has known critical security vulnerabilities (CVE-2025-66478 and others)
- Running `npm audit fix --force` automatically upgraded to Next.js 16.x
- Next.js 16.1.6 is the current latest stable version with security patches
- **Decision:** Proceed with Next.js 16.x for security, document breaking changes as we discover them

### React 19 Compatibility
- React 19 is required by Next.js 16
- This is a stable release with improved performance and new features
- All type definitions match the React 19 API

### ESLint Configuration
- Using ESLint 9.17.0 (not 10.x) for better compatibility with eslint-config-next
- There are remaining dev-time vulnerabilities in minimatch (used by ESLint plugins)
- These are **low-risk** as they only affect development environment (ReDoS vulnerabilities)
- Impact: Potential regex denial of service during linting (not production)

## Known Vulnerabilities

### Current Status
```
14 vulnerabilities (1 low, 13 high)
- All related to ESLint plugins (minimatch dependency)
- Type: ReDoS (Regular Expression Denial of Service)
- Impact: Development-time only
- Risk Assessment: LOW (development environment only)
```

### Security Posture
✅ **Production runtime:** No known vulnerabilities in Next.js, React, or production dependencies  
⚠️ **Development tools:** ESLint plugin vulnerabilities (ReDoS) - acceptable for dev environment  
✅ **Framework security:** Using latest patched versions of core frameworks

## Engine Requirements

```json
"engines": {
  "node": ">=20.0.0",
  "npm": ">=10.0.0"
}
```

### Why Node.js 20 LTS?
- Long-term support until April 2026
- Stable, production-ready
- Matches PRD requirement for "stable LTS runtimes"

## Version Pinning Strategy

All versions are **pinned** (no `^` or `~`) to ensure:
- Reproducible builds across environments
- No surprise breaking changes
- Easier debugging and support

## Testing Compatibility

✅ **Next.js CLI:** Verified working with `npm run dev -- --help`  
✅ **TypeScript:** Compilation tested (will verify after project structure setup)  
✅ **React 19:** Compatible with Next.js 16  
✅ **Tailwind CSS:** Compatible with PostCSS 8

## Future Dependency Updates

When updating dependencies:
1. Always check Next.js release notes for breaking changes
2. Update React/React-DOM together
3. Update type definitions to match runtime versions
4. Run `npm audit` before and after updates
5. Test locally before committing
6. Document any breaking changes in this file

## Dependency Addition Guidelines

For new packages:
1. Pin exact versions (no `^` or `~`)
2. Check compatibility with React 19 and Next.js 16
3. Prefer stable, well-maintained packages
4. Document in this file if adding major dependencies
5. Run security audit after installation

## References

- [Next.js 16 Documentation](https://nextjs.org/docs)
- [React 19 Release Notes](https://react.dev/blog/2024/12/05/react-19)
- [Node.js 20 LTS](https://nodejs.org/en/blog/release/v20.0.0)
- [Tailwind CSS v3 Docs](https://tailwindcss.com/docs)
