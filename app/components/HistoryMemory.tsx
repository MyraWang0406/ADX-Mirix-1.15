'use client'

import { useState, useEffect } from 'react'
import { History, AlertCircle } from 'lucide-react'
import { WhiteboxTrace } from '../types'

interface HistoricalPattern {
  timestamp: string
  pattern_type: string
  frequency: number
  avg_loss: number
  similarity_score: number
}

interface HistoryMemoryProps {
  logs: WhiteboxTrace[]
}

export default function HistoryMemory({ logs }: HistoryMemoryProps) {
  const [historicalMatch, setHistoricalMatch] = useState<{
    summary: string
    matches: HistoricalPattern[]
  } | null>({
    summary: '【历史复现】该模式与今天 14:00 的波动高度相似（相似度 85.3%），当时出现 12 次，建议沿用当时的降噪策略。',
    matches: [
      {
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        pattern_type: '14h_brazil_LATENCY_TIMEOUT',
        frequency: 12,
        avg_loss: 0.15,
        similarity_score: 0.853
      }
    ]
  })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const analyzeHistory = async () => {
      setIsLoading(true)
      try {
        // 总是昺示模拟数据（静态导出模式）
        const currentHour = new Date().getHours()
        const currentPattern = `${currentHour}h_LATENCY_TIMEOUT`

        const mockData = {
          summary: '【历史复现】该模式与今天 14:00 的波动高度相似（相似度 85.3%），当时出现 12 次，建议沿用当时的降噪策略。',
          matches: [
            {
              timestamp: new Date(Date.now() - 3600000).toISOString(),
              pattern_type: '14h_brazil_LATENCY_TIMEOUT',
              frequency: 12,
              avg_loss: 0.15,
              similarity_score: 0.853
            }
          ]
        }
        
        if (mockData.summary && mockData.matches.length > 0) {
          setHistoricalMatch({
            summary: mockData.summary,
            matches: mockData.matches
          })
        }
      } catch (error) {
        console.error('Error analyzing history:', error)
      } finally {
        setIsLoading(false)
      }
    }

    analyzeHistory()
  }, [logs])

  if (!historicalMatch) {
    return null
  }

  return (
    <div className="mt-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-start gap-2">
        <History className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-xs font-semibold text-blue-700 mb-1">
            情景记忆 - 历史模式识别
          </div>
          <div className="text-[10px] text-blue-700 leading-relaxed mb-2">
            {historicalMatch.summary}
          </div>
          
          {historicalMatch.matches.length > 0 && (
            <div className="space-y-1">
              <div className="text-[9px] font-semibold text-blue-600 mb-1">相关历史记录：</div>
              {historicalMatch.matches.slice(0, 3).map((match, idx) => {
                const matchTime = new Date(match.timestamp)
                const timeStr = matchTime.toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit'
                })
                const dateStr = matchTime.toLocaleDateString('zh-CN')
                
                return (
                  <div key={idx} className="text-[9px] text-blue-600 p-1 bg-white rounded border border-blue-100">
                    <div className="flex items-center justify-between">
                      <span>{dateStr} {timeStr}</span>
                      <span className="font-semibold">{match.frequency}次</span>
                    </div>
                    <div className="text-[8px] text-gray-600 mt-0.5">
                      相似度: {(match.similarity_score * 100).toFixed(1)}% | 平均损失: ¥{match.avg_loss.toFixed(4)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
