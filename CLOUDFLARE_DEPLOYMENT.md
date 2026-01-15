# Cloudflare 部署指南 - ADX Mirix 白盒化平台

## 项目概述

**ADX Mirix 白盒化广告交易看板** 是一个基于 Next.js 的实时竞价分析平台，具备以下特性：

- ✅ 实时交易流监控
- ✅ 损耗漏斗分析
- ✅ 历史模式识别（情景记忆）
- ✅ AI 智能诊断
- ✅ 全球流量热力图
- ✅ 收入损失评估

---

## 部署方案对比

### 方案 A：Cloudflare Pages（推荐）

**适用场景**：纯静态前端 + 无状态 API

| 特性 | 说明 |
|------|------|
| **构建方式** | 自动构建 Next.js 为静态 HTML |
| **部署时间** | < 1 分钟 |
| **成本** | 免费（无额外费用） |
| **冷启动** | 毫秒级 |
| **限制** | 无服务端计算，API 需要外部服务 |
| **适合** | 前端展示、只读数据、CDN 加速 |

### 方案 B：Cloudflare Workers（高级）

**适用场景**：需要服务端逻辑、实时数据处理

| 特性 | 说明 |
|------|------|
| **构建方式** | 部署完整 Next.js 应用到 Workers 运行时 |
| **部署时间** | 2-3 分钟 |
| **成本** | 按请求计费（首 10 万次免费） |
| **冷启动** | 毫秒级 |
| **限制** | 单个请求 30 秒超时限制 |
| **适合** | 需要后端 API、动态内容、日志处理 |

---

## 推荐方案：Cloudflare Pages + Workers 混合

本项目使用 **Cloudflare Pages** 作为主要部署方式，因为：

1. **API 已优化**：所有 API 路由（`/api/logs`、`/api/history-logs`）都是轻量级的
2. **无数据库依赖**：直接读取本地 `whitebox.log` 文件
3. **成本最优**：完全免费，无需付费
4. **部署最快**：自动 CI/CD，提交即部署

---

## 部署步骤

### 前置条件

- GitHub 账户（已有）
- Cloudflare 账户（免费）
- 项目已推送到 GitHub

### 步骤 1：连接 GitHub 仓库到 Cloudflare Pages

```bash
# 1. 访问 Cloudflare Dashboard
# https://dash.cloudflare.com

# 2. 左侧菜单 → Pages → 创建项目
# 3. 选择 "连接到 Git"
# 4. 授权 GitHub 账户
# 5. 选择仓库：ADX-Mirix-1.15
# 6. 点击 "开始设置"
```

### 步骤 2：配置构建设置

在 Cloudflare Pages 配置界面填写以下信息：

| 配置项 | 值 |
|--------|-----|
| **项目名称** | `adx-mirix` |
| **生产分支** | `main` |
| **构建命令** | `npm run build` |
| **构建输出目录** | `.next/static` |
| **Node.js 版本** | `18.x` 或更高 |

### 步骤 3：环境变量（可选）

如果需要添加环境变量，在部署前配置：

```bash
# 示例（本项目无需）
NEXT_PUBLIC_API_URL=https://your-domain.pages.dev
```

### 步骤 4：部署

```bash
# 方式 A：自动部署（推荐）
# 1. 在本地修改代码
# 2. 提交到 GitHub
git add .
git commit -m "Update: new features"
git push origin main

# Cloudflare Pages 会自动检测到 push 事件
# 自动触发构建和部署（约 1-2 分钟完成）

# 方式 B：手动部署（使用 Wrangler CLI）
npm install -g wrangler
wrangler pages deploy .next/static --project-name adx-mirix
```

---

## 部署后配置

### 1. 绑定自定义域名

```bash
# 在 Cloudflare Pages 项目设置中：
# 1. 项目 → 设置 → 自定义域
# 2. 添加你的域名（如 adx.yourdomain.com）
# 3. 按提示配置 DNS 记录
```

### 2. 启用 HTTPS（自动）

Cloudflare Pages 默认启用 HTTPS，无需额外配置。

### 3. 配置缓存策略

```bash
# 在 Cloudflare Pages 项目设置中：
# 1. 项目 → 设置 → 构建缓存
# 2. 设置缓存 TTL（建议 1 小时）
```

---

## 处理 API 路由问题

### 问题：API 路由在 Pages 中不可用

**原因**：Cloudflare Pages 默认只支持静态文件，不支持 Next.js API 路由。

**解决方案 1：使用 Cloudflare Workers 作为 API 网关**

```bash
# 1. 创建 Worker 脚本
wrangler init api-gateway

# 2. 在 wrangler.toml 中配置路由
[env.production]
routes = [
  { pattern = "example.com/api/*", zone_name = "example.com" }
]

# 3. 部署 Worker
wrangler publish
```

**解决方案 2：使用外部 API 服务**

将 API 端点指向外部服务（如 Vercel、Railway 等）：

```typescript
// app/api/logs/route.ts
const API_ENDPOINT = process.env.NEXT_PUBLIC_API_ENDPOINT || 'https://api.example.com'

export async function GET() {
  const response = await fetch(`${API_ENDPOINT}/logs`)
  return response
}
```

**解决方案 3：使用 Cloudflare Workers + Pages（推荐）**

```bash
# 部署完整的 Next.js 应用到 Workers
wrangler pages deploy --project-name adx-mirix
```

---

## 完整部署命令速查

### 使用 Cloudflare Pages（通过 GitHub 自动部署）

```bash
# 1. 确保代码已推送到 GitHub
git push origin main

# 2. 在 Cloudflare Dashboard 中：
# https://dash.cloudflare.com → Pages → 连接 GitHub

# 3. 选择仓库并配置（一次性）

# 之后每次 push 都会自动部署
```

### 使用 Wrangler CLI（手动部署）

```bash
# 安装 Wrangler
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 部署到 Pages
wrangler pages deploy .next/static --project-name adx-mirix

# 或部署完整应用到 Workers
wrangler deploy
```

---

## 监控和调试

### 查看部署日志

```bash
# 使用 Wrangler 查看实时日志
wrangler tail --project-name adx-mirix

# 或在 Cloudflare Dashboard 中：
# Pages → 项目 → 部署 → 查看构建日志
```

### 性能监控

```bash
# 在 Cloudflare Dashboard 中：
# Pages → 项目 → 分析 → 查看请求统计
```

---

## 常见问题

### Q1：API 路由返回 404

**A**：Cloudflare Pages 不支持 Next.js API 路由。使用解决方案 3（Workers）或将 API 部署到其他服务。

### Q2：如何更新部署？

**A**：只需 push 到 GitHub main 分支，Cloudflare Pages 会自动重新部署。

### Q3：如何回滚到之前的版本？

**A**：在 Cloudflare Dashboard 中：Pages → 项目 → 部署历史 → 选择之前的版本 → 重新部署

### Q4：如何处理 whitebox.log 文件？

**A**：
- **Pages 方案**：将日志上传到 Cloudflare KV 存储或外部 API
- **Workers 方案**：使用 Cloudflare D1 数据库或 KV 存储

---

## 性能优化建议

### 1. 启用 Brotli 压缩

```bash
# Cloudflare 自动启用，无需配置
```

### 2. 优化图片加载

```typescript
// 使用 Next.js Image 组件
import Image from 'next/image'

export default function OptimizedImage() {
  return (
    <Image
      src="/logo.png"
      alt="Logo"
      width={100}
      height={100}
      priority
    />
  )
}
```

### 3. 启用缓存

```bash
# 在 next.config.js 中
module.exports = {
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=3600'
        }
      ]
    }
  ]
}
```

---

## 成本估算

| 方案 | 月度成本 | 备注 |
|------|---------|------|
| **Pages** | $0 | 完全免费 |
| **Workers** | $0-50 | 首 10 万请求免费，之后 $0.50/百万请求 |
| **KV 存储** | $0-5 | 首 10 万读写免费 |

---

## 总结

✅ **推荐部署方案**：**Cloudflare Pages + GitHub 自动部署**

```bash
# 一行命令完成所有配置
# 1. 确保代码在 GitHub
git push origin main

# 2. 访问 Cloudflare Dashboard 连接 GitHub 仓库
# https://dash.cloudflare.com/pages

# 3. 自动部署完成！
```

**部署地址示例**：`https://adx-mirix.pages.dev`

---

## 支持和反馈

- 📧 Email: myrawzm0406@163.com
- 💬 WeChat: 15301052620
- 🐙 GitHub: https://github.com/MyraWang0406/ADX-Mirix-1.15

