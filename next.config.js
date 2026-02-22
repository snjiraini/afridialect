/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Restrict remotePatterns to prevent DoS vulnerability exploitation
    remotePatterns: [],
  },
}

module.exports = nextConfig
