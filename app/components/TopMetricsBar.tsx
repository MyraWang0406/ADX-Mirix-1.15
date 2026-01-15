'use client'

import { useMemo } from 'react'
import { AlertCircle, PiggyBank, TrendingUp, TrendingDown } from 'lucide-react'
import { WhiteboxTrace } from '../types'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

interface TopMetricsBarProps {
  logs: WhiteboxTrace[]
}

export default function TopMetricsBar({ logs }: TopMetricsBarProps) {
  const metrics = useMemo(() => {
    // 分析延迟超时
    const latencyTimeoutLogs = logs.filter(log => 
      log.reason_code === 'LATENCY_TIMEOUT'
    )
    
    let latencyLoss = 0.0
    let latencyEcpmLoss = 0.0
    latencyTimeoutLogs.forEach(log => {
      // 优先从 internal_variables 获取潜在损失（确保与后端 engine.py 对齐）
      // 如果字段为空，显示为 0.00 而非报错
      const potentialLoss = log.internal_variables?.potential_loss ??
                          log.internal_variables?.highest_potential_ecpm_loss ?? 
                          log.internal_variables?.max_potential_ecpm ?? 
                          log.eCPM ?? 0
      latencyEcpmLoss += potentialLoss
      latencyLoss += potentialLoss
    })
    
    // 分析素材不合规
    const creativeMismatchLogs = logs.filter(log => 
      log.reason_code === 'CREATIVE_MISMATCH'
    )
    let creativeLoss = 0.0
    creativeMismatchLogs.forEach(log => {
      const potentialLoss = log.internal_variables?.potential_loss || 
                          log.eCPM || 0
      creativeLoss += potentialLoss
    })
    
    // 分析底价过高
    const floorPriceHighLogs = logs.filter(log => 
      log.reason_code === 'FLOOR_PRICE_HIGH'
    )
    let floorLoss = 0.0
    floorPriceHighLogs.forEach(log => {
      const priceGap = log.internal_variables?.price_gap || 0
      floorLoss += priceGap
    })
    
    // 分析二价节省
    const savedAmount = logs
      .filter(log => log.saved_amount && log.saved_amount > 0)
      .reduce((sum, log) => sum + (log.saved_amount || 0), 0)
    
    // 生成趋势数据（最近6个时间窗口）
    const now = new Date()
    const trendData = []
    for (let i = 5; i >= 0; i--) {
      const windowEnd = new Date(now.getTime() - i * 2 * 60 * 1000) // 每2分钟一个点
      const windowStart = new Date(windowEnd.getTime() - 2 * 60 * 1000)
      
      const windowLogs = logs.filter(log => {
        try {
          const logTime = new Date(log.timestamp)
          return logTime >= windowStart && logTime < windowEnd
        } catch {
          return false
        }
      })
      
      const windowLatencyLoss = windowLogs
        .filter(log => log.reason_code === 'LATENCY_TIMEOUT')
        .reduce((sum, log) => {
          const loss = log.internal_variables?.highest_potential_ecpm_loss || 
                      log.internal_variables?.max_potential_ecpm || 
                      log.internal_variables?.potential_loss || 0
          return sum + loss
        }, 0)
      
      trendData.push({
        time: i,
        value: windowLatencyLoss
      })
    }
    
    return {
      latency: {
        count: latencyTimeoutLogs.length,
        loss: latencyLoss,
        ecpmLoss: latencyEcpmLoss,
        trend: trendData
      },
      creative: {
        count: creativeMismatchLogs.length,
        loss: creativeLoss,
        trend: trendData.map((d, i) => ({
          time: i,
          value: d.value * 0.3 // 简化：假设素材损失是延迟损失的30%
        }))
      },
      floor: {
        count: floorPriceHighLogs.length,
        loss: floorLoss,
        trend: trendData.map((d, i) => ({
          time: i,
          value: d.value * 0.2 // 简化：假设底价损失是延迟损失的20%
        }))
      },
      saved: {
        amount: savedAmount,
        trend: trendData.map((d, i) => ({
          time: i,
          value: savedAmount / 6 // 简化：平均分配
        }))
      }
    }
  }, [logs])
  
  return (
    <div className="grid grid-cols-12 gap-2 mb-3">
      {/* 延迟超时 */}
      <div className="col-span-3 p-2 bg-white border border-gray-100 rounded">
        <div className="flex items-center justify-between mb-1">
          <AlertCircle className="w-3 h-3 text-red-600" />
          <span className="text-[10px] text-gray-500">{metrics.latency.count}次</span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-lg font-bold text-blue-600">
              ${metrics.latency.loss.toFixed(2)}
            </div>
            <div className="text-[9px] text-gray-500">延迟超时损失</div>
          </div>
          <div className="w-12 h-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.latency.trend}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#dc2626"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* 素材不合规 */}
      <div className="col-span-3 p-2 bg-white border border-gray-100 rounded">
        <div className="flex items-center justify-between mb-1">
          <AlertCircle className="w-3 h-3 text-amber-600" />
          <span className="text-[10px] text-gray-500">{metrics.creative.count}次</span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-lg font-bold text-blue-600">
              ${metrics.creative.loss.toFixed(2)}
            </div>
            <div className="text-[9px] text-gray-500">素材不合规损失</div>
          </div>
          <div className="w-12 h-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.creative.trend}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#d97706"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* 底价过高 */}
      <div className="col-span-3 p-2 bg-white border border-gray-100 rounded">
        <div className="flex items-center justify-between mb-1">
          <AlertCircle className="w-3 h-3 text-orange-600" />
          <span className="text-[10px] text-gray-500">{metrics.floor.count}次</span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-lg font-bold text-blue-600">
              ${metrics.floor.loss.toFixed(2)}
            </div>
            <div className="text-[9px] text-gray-500">底价过高损失</div>
          </div>
          <div className="w-12 h-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.floor.trend}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#ea580c"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* 二价节省 */}
      <div className="col-span-3 p-2 bg-white border border-gray-100 rounded">
        <div className="flex items-center justify-between mb-1">
          <PiggyBank className="w-3 h-3 text-green-600" />
          <TrendingUp className="w-3 h-3 text-green-600" />
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-lg font-bold text-blue-600">
              ${metrics.saved.amount.toFixed(2)}
            </div>
            <div className="text-[9px] text-gray-500">二价机制节省</div>
          </div>
          <div className="w-12 h-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.saved.trend}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#059669"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

