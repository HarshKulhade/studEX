/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // During builds, show warnings but don't fail on linting errors
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

export default nextConfig;
