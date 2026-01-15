import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '白盒化广告交易看板 - Mirix',
  description: 'Mirix 白盒化广告交易可视化排查看板',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}

