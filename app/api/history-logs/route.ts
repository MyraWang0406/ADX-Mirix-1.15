import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface WhiteboxTrace {
  request_id: string
  timestamp: string
  node: string
  action: string
  decision: string
  reason_code: string
  internal_variables: Record<string, any>
  reasoning: string
  pCTR?: number | null
  pCVR?: number | null
  eCPM?: number | null
  latency_ms?: number | null
  second_best_bid?: number | null
  actual_paid_price?: number | null
  saved_amount?: number | null
}

interface HistoricalPattern {
  timestamp: string
  pattern_type: string
  region?: string
  node?: string
  loss_type?: string
  frequency: number
  avg_loss: number
  similarity_score: number
}

// 提取模式特征
function extractPatternFeature(log: WhiteboxTrace): string {
  const hour = new Date(log.timestamp).getHours()
  const region = log.internal_variables?.region || 'unknown'
  const lossType = log.reason_code || 'unknown'
  
  return `${hour}h_${region}_${lossType}`
}

// 计算相似度（简单的字符串匹配）
function calculateSimilarity(pattern1: string, pattern2: string): number {
  if (pattern1 === pattern2) return 1.0
  
  // 计算编辑距离
  const len1 = pattern1.length
  const len2 = pattern2.length
  const matrix: number[][] = []
  
  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (pattern2[i - 1] === pattern1[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  const distance = matrix[len2][len1]
  const maxLen = Math.max(len1, len2)
  return 1 - distance / maxLen
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { currentPattern, hoursBack = 24 } = body

    const logPath = path.join(process.cwd(), 'whitebox.log')
    
    if (!fs.existsSync(logPath)) {
      return NextResponse.json({ 
        matches: [],
        summary: '暂无历史数据'
      })
    }

    const fileContent = fs.readFileSync(logPath, 'utf-8')
    const lines = fileContent.split('\n').filter(line => line.trim())
    
    // 解析所有日志
    const allLogs: WhiteboxTrace[] = lines
      .map(line => {
        try {
          return JSON.parse(line)
        } catch (e) {
          return null
        }
      })
      .filter((log): log is WhiteboxTrace => log !== null)

    // 计算时间范围
    const now = new Date()
    const cutoffTime = new Date(now.getTime() - hoursBack * 60 * 60 * 1000)

    // 过滤过去N小时的日志
    const recentLogs = allLogs.filter(log => {
      const logTime = new Date(log.timestamp)
      return logTime >= cutoffTime
    })

    // 提取模式并计算相似度
    const patternMap = new Map<string, { logs: WhiteboxTrace[], losses: number[] }>()
    
    recentLogs.forEach(log => {
      const pattern = extractPatternFeature(log)
      if (!patternMap.has(pattern)) {
        patternMap.set(pattern, { logs: [], losses: [] })
      }
      
      const entry = patternMap.get(pattern)!
      entry.logs.push(log)
      
      // 计算损失值
      if (log.reason_code === 'LATENCY_TIMEOUT') {
        entry.losses.push(log.internal_variables?.potential_loss || 0.1)
      }
    })

    // 找出与当前模式相似的历史模式
    const matches: HistoricalPattern[] = []
    
    patternMap.forEach((value, pattern) => {
      const similarity = calculateSimilarity(currentPattern, pattern)
      
      if (similarity > 0.5) { // 相似度阈值
        const avgLoss = value.losses.length > 0 
          ? value.losses.reduce((a, b) => a + b, 0) / value.losses.length
          : 0

        // 获取最早的时间戳
        const earliestLog = value.logs.reduce((prev, curr) => {
          return new Date(prev.timestamp) < new Date(curr.timestamp) ? prev : curr
        })

        matches.push({
          timestamp: earliestLog.timestamp,
          pattern_type: pattern,
          frequency: value.logs.length,
          avg_loss: avgLoss,
          similarity_score: similarity
        })
      }
    })

    // 按相似度排序
    matches.sort((a, b) => b.similarity_score - a.similarity_score)

    // 生成建议
    let suggestion = ''
    if (matches.length > 0) {
      const topMatch = matches[0]
      const matchTime = new Date(topMatch.timestamp)
      const matchHour = matchTime.getHours()
      const matchDate = matchTime.toLocaleDateString('zh-CN')
      
      suggestion = `【历史复现】该模式与${matchDate} ${matchHour}:00 的波动高度相似（相似度${(topMatch.similarity_score * 100).toFixed(1)}%），当时出现${topMatch.frequency}次，建议沿用当时的降噪策略。`
    }

    return NextResponse.json({
      matches: matches.slice(0, 5), // 返回前5个匹配
      summary: suggestion,
      total_patterns: patternMap.size,
      recent_logs_count: recentLogs.length
    })
  } catch (error) {
    console.error('Error analyzing history:', error)
    return NextResponse.json(
      { error: 'Failed to analyze history', matches: [] },
      { status: 500 }
    )
  }
}
