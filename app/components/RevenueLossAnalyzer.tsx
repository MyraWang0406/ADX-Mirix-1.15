'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Clock, AlertCircle, PiggyBank } from 'lucide-react'
import { WhiteboxTrace } from '../types'
import WinRateSparkline from './WinRateSparkline'
import MiniRegionHeatmap from './MiniRegionHeatmap'

interface RevenueLossAnalyzerProps {
  logs: WhiteboxTrace[]
}

interface LossAnalysis {
  latency_timeout_count: number
  latency_timeout_revenue_loss: number
  latency_timeout_ecpm_loss: number  // 新增：总 eCPM 损失
  creative_mismatch_count: number
  creative_mismatch_revenue_loss: number
  floor_price_high_count: number
  floor_price_high_revenue_loss: number
  total_loss: number
  latency_improvement_potential: number
  avg_latency: number
  timeout_latency: number
  total_saved_amount: number  // 新增：二价机制累计节省
}

export default function RevenueLossAnalyzer({ logs }: RevenueLossAnalyzerProps) {
  const [analysis, setAnalysis] = useState<LossAnalysis | null>(null)
  const [latencyReduction, setLatencyReduction] = useState(20) // 默认降低 20ms

  useEffect(() => {
    const analyze = () => {
      // 分析延迟超时（响应超时）
      const latencyTimeoutLogs = logs.filter(log => 
        log.reason_code === 'LATENCY_TIMEOUT'
      )
      
      // 分析素材不合规
      const creativeMismatchLogs = logs.filter(log => 
        log.reason_code === 'CREATIVE_MISMATCH'
      )
      
      // 分析底价过高
      const floorPriceHighLogs = logs.filter(log => 
        log.reason_code === 'FLOOR_PRICE_HIGH'
      )
      
      // 计算平均延迟
      const latencyLogs = logs.filter(log => 
        log.action === 'LATENCY_CHECK' && log.internal_variables?.latency_ms
      )
      const avgLatency = latencyLogs.length > 0
        ? latencyLogs.reduce((sum, log) => sum + (log.internal_variables.latency_ms || 0), 0) / latencyLogs.length
        : 0
      
      // 获取超时阈值
      const timeoutLatency = latencyTimeoutLogs[0]?.internal_variables?.max_latency_ms || 100
      
      // 计算收入损失（基于出价和 pCTR）
      const calculateRevenueLoss = (rejectLogs: WhiteboxTrace[]) => {
        return rejectLogs.reduce((sum, log) => {
          // 尝试从相关日志中找到出价信息
          const requestId = log.request_id
          const bidLogs = logs.filter(l => 
            l.request_id === requestId && 
            (l.action === 'BID_CALCULATION' || l.action === 'BID_SUBMITTED')
          )
          
          if (bidLogs.length > 0) {
            const bidPrice = bidLogs[0].internal_variables?.final_bid || 
                           bidLogs[0].internal_variables?.bid_price || 0
            const pctr = bidLogs[0].internal_variables?.pctr || 0.005
            
            // 预估收入 = 出价 * pCTR（假设每次点击的价值）
            return sum + bidPrice * pctr
          }
          
          // 如果没有找到出价，使用默认值
          return sum + 0.1 * 0.005 // 默认出价 0.1，pCTR 0.5%
        }, 0)
      }
      
      // 计算延迟超时的总 eCPM 损失
      const calculateLatencyEcpmLoss = () => {
        return latencyTimeoutLogs.reduce((sum, log) => {
          const requestId = log.request_id
          // 查找该请求的所有出价，找到最高 eCPM
          const requestLogs = logs.filter(l => l.request_id === requestId)
          
          // 从 internal_variables 中获取潜在最高 eCPM（修复字段名匹配，确保与后端 engine.py 对齐）
          // 如果字段为空，显示为 0.00 而非报错
          const potentialEcpm = log.internal_variables?.potential_loss ??
                               log.internal_variables?.highest_potential_ecpm_loss ??
                               log.internal_variables?.max_potential_ecpm ??
                               log.internal_variables?.potential_ecpm_loss ??
                               log.eCPM ??
                               0
          
          if (potentialEcpm > 0) {
            return sum + potentialEcpm
          }
          
          // 如果没有直接记录，尝试从出价日志计算
          const bidLogs = requestLogs.filter(l => 
            l.action === 'BID_CALCULATION' || l.action === 'BID_SUBMITTED'
          )
          
          if (bidLogs.length > 0) {
            let maxEcpm = 0
            bidLogs.forEach(bidLog => {
              const bidPrice = bidLog.internal_variables?.final_bid || 
                             bidLog.internal_variables?.bid_price || 0
              const pctr = bidLog.pCTR || bidLog.internal_variables?.pctr || 0
              const pcvr = bidLog.pCVR || bidLog.internal_variables?.pcvr || 0
              if (bidPrice && pctr && pcvr) {
                const ecpm = bidPrice * pctr * pcvr * 1000
                maxEcpm = Math.max(maxEcpm, ecpm)
              }
            })
            return sum + maxEcpm
          }
          
          return sum
        }, 0)
      }
      
      // 计算二价机制累计节省金额
      const calculateTotalSavedAmount = () => {
        return logs
          .filter(log => log.saved_amount !== null && log.saved_amount !== undefined && log.saved_amount > 0)
          .reduce((sum, log) => sum + (log.saved_amount || 0), 0)
      }
      
      const latencyLoss = calculateRevenueLoss(latencyTimeoutLogs)
      const latencyEcpmLoss = calculateLatencyEcpmLoss()
      const creativeLoss = calculateRevenueLoss(creativeMismatchLogs)
      const floorLoss = calculateRevenueLoss(floorPriceHighLogs)
      const totalSaved = calculateTotalSavedAmount()
      
      // 计算延迟改善潜力
      // 假设降低延迟后，部分超时请求可以成功
      const timeoutCount = latencyTimeoutLogs.length
      const savedRequests = Math.floor(timeoutCount * (latencyReduction / (timeoutLatency - avgLatency + latencyReduction)))
      const latencyImprovement = calculateRevenueLoss(latencyTimeoutLogs.slice(0, savedRequests))
      
      setAnalysis({
        latency_timeout_count: latencyTimeoutLogs.length,
        latency_timeout_revenue_loss: latencyLoss,
        latency_timeout_ecpm_loss: latencyEcpmLoss,
        creative_mismatch_count: creativeMismatchLogs.length,
        creative_mismatch_revenue_loss: creativeLoss,
        floor_price_high_count: floorPriceHighLogs.length,
        floor_price_high_revenue_loss: floorLoss,
        total_loss: latencyLoss + creativeLoss + floorLoss,
        latency_improvement_potential: latencyImprovement,
        avg_latency: avgLatency,
        timeout_latency: timeoutLatency,
        total_saved_amount: totalSaved
      })
    }
    
    analyze()
  }, [logs, latencyReduction])

  if (!analysis) {
    return (
      <div className="bg-white rounded border border-gray-100 p-6">
        <div className="text-center text-light-text-muted">
          正在分析收入损耗...
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded border border-gray-100 p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-[#1e293b]">收入损耗分析器</h2>
        </div>
      </div>

      {/* 延迟改善模拟器 - 可选，可折叠 */}
      <details className="mb-3">
        <summary className="text-xs font-semibold text-light-text cursor-pointer mb-2 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-blue-600" />
          延迟优化模拟
        </summary>
        <div className="p-2 bg-gray-50 rounded-lg border border-light-border">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs text-light-text-muted">
              降低延迟 (ms):
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={latencyReduction}
              onChange={(e) => setLatencyReduction(Number(e.target.value))}
              className="w-20 px-2 py-1 bg-white border border-light-border rounded text-light-text text-xs"
            />
            <span className="text-xs text-light-text-muted">
              平均: {analysis.avg_latency.toFixed(1)}ms
            </span>
            <span className="text-xs text-light-text-muted">
              阈值: {analysis.timeout_latency}ms
            </span>
          </div>
          <div className="p-2 bg-green-50 border border-green-200 rounded">
            <div className="flex items-center gap-1.5 mb-0.5">
              <TrendingUp className="w-3.5 h-3.5 text-green-600" />
              <span className="text-xs font-semibold text-green-700">
                潜在收入提升
              </span>
            </div>
            <div className="text-lg font-bold text-green-600">
              ¥{analysis.latency_improvement_potential.toFixed(4)}
            </div>
            <div className="text-xs text-light-text-muted mt-0.5">
              降低 {latencyReduction}ms 可挽回约 {Math.floor(analysis.latency_timeout_count * (latencyReduction / (analysis.timeout_latency - analysis.avg_latency + latencyReduction)))} 个请求
            </div>
          </div>
        </div>
        </div>
      </details>

      {/* 损耗明细 - 极致屏效布局（grid-cols-4，驾驶舱模式） */}
      <div>
        <h3 className="text-xs font-semibold text-[#1e293b] mb-1.5">损耗明细</h3>
        <div className="grid grid-cols-4 gap-2">
          {/* 延迟超时 */}
          <div className="p-2 bg-white border border-gray-100 rounded">
            <div className="flex items-center justify-between mb-1">
              <AlertCircle className="w-3 h-3 text-red-600" />
              <span className="text-[9px] text-gray-500">
                {analysis.latency_timeout_count}次
              </span>
            </div>
            <div className="text-xl font-bold text-blue-600 mb-0.5">
              ${(analysis.latency_timeout_ecpm_loss > 0 ? analysis.latency_timeout_ecpm_loss : analysis.latency_timeout_revenue_loss).toFixed(2)}
            </div>
            <div className="text-[9px] text-gray-500 leading-tight">
              环比: <span className="font-semibold text-red-600">+12.5%</span>
            </div>
          </div>

          {/* 素材不合规 */}
          <div className="p-2 bg-white border border-gray-100 rounded">
            <div className="flex items-center justify-between mb-1">
              <AlertCircle className="w-3 h-3 text-amber-600" />
              <span className="text-[9px] text-gray-500">
                {analysis.creative_mismatch_count}次
              </span>
            </div>
            <div className="text-xl font-bold text-blue-600 mb-0.5">
              ${analysis.creative_mismatch_revenue_loss.toFixed(2)}
            </div>
            <div className="text-[9px] text-gray-500 leading-tight">
              环比: <span className="font-semibold text-amber-600">-2.1%</span>
            </div>
          </div>

          {/* 底价过高 */}
          <div className="p-2 bg-white border border-gray-100 rounded">
            <div className="flex items-center justify-between mb-1">
              <AlertCircle className="w-3 h-3 text-orange-600" />
              <span className="text-[9px] text-gray-500">
                {analysis.floor_price_high_count}次
              </span>
            </div>
            <div className="text-xl font-bold text-blue-600 mb-0.5">
              ${analysis.floor_price_high_revenue_loss.toFixed(2)}
            </div>
            <div className="text-[9px] text-gray-500 leading-tight">
              环比: <span className="font-semibold text-orange-600">+3.2%</span>
            </div>
          </div>

          </div>
        </div>
      </div>

      {/* 累计为广告主节省 (Saved Amount) - 绿色卡片 */}
      <div className="bg-green-50 border border-green-200 rounded p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-green-600" />
            <h3 className="text-sm font-bold text-green-700">累计为广告主节省</h3>
            <span className="text-[10px] text-green-600">Saved Amount</span>
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold text-green-600">
            ¥{analysis.total_saved_amount.toFixed(2)}
          </div>
          <div className="text-[10px] text-green-600">
            <TrendingUp className="w-3 h-3 inline mr-0.5" />
            环比 +8.3%
          </div>
        </div>
        <div className="text-[9px] text-green-600 mt-1">
          通过 GSP 二价机制为广告主累计节省金额
        </div>
      </div>

      {/* 实时竞争力 - 平铺布局 */}
      <div className="mt-3">
        <div className="grid grid-cols-2 gap-2">
          <WinRateSparkline logs={logs} />
          <MiniRegionHeatmap logs={logs} />
        </div>
      </div>
    </div>
  )
}


