/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 确保 API 路由能在 Cloudflare Pages 上工作
  // Pages 会自动处理 .next/server 中的 API 路由
  experimental: {
    // 允许在 Pages 上使用 API 路由
    isrMemoryCacheSize: 0,
  },
}

module.exports = nextConfig
