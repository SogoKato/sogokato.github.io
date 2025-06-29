/** @type {import("next").NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  output: process.env.NODE_ENV === "development" ? undefined : "export", // 日本語slug/tagの問題
};

module.exports = nextConfig;
