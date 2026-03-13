/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required for Docker / Azure Container Apps deployment.
  // Produces a self-contained server in .next/standalone that does not
  // need the full node_modules tree at runtime.
  output: 'standalone',
  images: {
    // Restrict remotePatterns to prevent DoS vulnerability exploitation
    remotePatterns: [],
  },
  devIndicators: false,
  // Supply build-time placeholder values for NEXT_PUBLIC_* vars so that
  // Next.js can statically prerender pages like /_not-found without the
  // Supabase client throwing "URL and API key are required".
  // Real values are injected at build time via Docker ARG/ENV in the
  // Dockerfile (and via --build-arg in the ACR Task).
  // The placeholder is only used when the real value is absent (i.e. during
  // a local `npm run build` without .env.local, or if the CI secret is unset).
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder-anon-key',
  },
}

module.exports = nextConfig
