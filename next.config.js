/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 启用静态导出 - 必须用于 Cloudflare Pages
  output: 'export',
  // 禁用图片优化（静态导出不支持）
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
