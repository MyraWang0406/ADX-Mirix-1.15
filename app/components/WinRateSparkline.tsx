'use client'

import { useMemo } from 'react'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { WhiteboxTrace } from '../types'

interface WinRateSparklineProps {
  logs: WhiteboxTrace[]
}

export default function WinRateSparkline({ logs }: WinRateSparklineProps) {
  const sparklineData = useMemo(() => {
    if (logs.length === 0) return []
    
    // 按时间窗口分组（30分钟，每5分钟一个点）
    const now = new Date()
    const windows: { time: string; wins: number; total: number }[] = []
    
    for (let i = 5; i >= 0; i--) {
      const windowEnd = new Date(now.getTime() - i * 5 * 60 * 1000)
      const windowStart = new Date(windowEnd.getTime() - 5 * 60 * 1000)
      
      const windowLogs = logs.filter(log => {
        try {
          const logTime = new Date(log.timestamp)
          return logTime >= windowStart && logTime < windowEnd
        } catch {
          return false
        }
      })
      
      const requestIds = new Set<string>()
      const winIds = new Set<string>()
      
      windowLogs.forEach(log => {
        requestIds.add(log.request_id)
        if (log.action === 'AUCTION_RESULT' || 
            (log.node === 'ADX' && log.action === 'FINAL_DECISION' && log.decision === 'PASS')) {
          winIds.add(log.request_id)
        }
      })
      
      windows.push({
        time: windowEnd.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        wins: winIds.size,
        total: requestIds.size
      })
    }
    
    return windows.map(w => ({
      time: w.time,
      winRate: w.total > 0 ? (w.wins / w.total * 100) : 0
    }))
  }, [logs])
  
  const currentWinRate = sparklineData.length > 0 
    ? sparklineData[sparklineData.length - 1].winRate 
    : 0
  
  const previousWinRate = sparklineData.length > 1
    ? sparklineData[sparklineData.length - 2].winRate
    : currentWinRate
  
  const trend = currentWinRate - previousWinRate
  
  return (
    <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-subtle">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-blue-600" />
          <span className="text-xs font-semibold text-[#1e293b]">实时竞争力</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sm font-bold text-blue-600">
            {currentWinRate.toFixed(1)}%
          </span>
          {trend !== 0 && (
            <span className={`text-[10px] ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
      </div>
      
      {sparklineData.length > 0 ? (
        <ResponsiveContainer width="100%" height={40}>
          <LineChart data={sparklineData}>
            <Line
              type="monotone"
              dataKey="winRate"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #f3f4f6',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '10px'
              }}
              formatter={(value: number) => [`${value.toFixed(1)}%`, '胜率']}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-10 flex items-center justify-center text-gray-400 text-xs">
          暂无数据
        </div>
      )}
    </div>
  )
}

