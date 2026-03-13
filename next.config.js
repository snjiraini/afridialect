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
}

module.exports = nextConfig
