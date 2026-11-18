/** @type {import("next").NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  // Hosts other than localhost that may load dev resources, e.g.
  // DEV_ORIGINS=dev.example.com,*.example.com in .env.local
  allowedDevOrigins: process.env.DEV_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  output: process.env.NODE_ENV === "development" ? undefined : "export", // 日本語slug/tagの問題
};

module.exports = nextConfig;
