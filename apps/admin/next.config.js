/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
  },
  async redirects() {
    return [
      {
        source: "/stays/check-in",
        destination: "/check-in",
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
