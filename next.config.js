/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Restrict remotePatterns to prevent DoS vulnerability exploitation
    remotePatterns: [],
  },
  devIndicators: false,
}

module.exports = nextConfig
