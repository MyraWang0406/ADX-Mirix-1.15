'use client'

import { useMemo } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend } from 'recharts'
import { WhiteboxTrace } from '../types'

interface LatencyWinRateChartProps {
  logs: WhiteboxTrace[]
}

interface DataPoint {
  latency: number
  ecpm: number
  status: 'win' | 'timeout' | 'loss'
  request_id: string
}

export default function LatencyWinRateChart({ logs }: LatencyWinRateChartProps) {
  const data = useMemo(() => {
    const points: DataPoint[] = []
    const requestMap = new Map<string, WhiteboxTrace[]>()
    
    // 按 request_id 分组
    logs.forEach(log => {
      if (!requestMap.has(log.request_id)) {
        requestMap.set(log.request_id, [])
      }
      requestMap.get(log.request_id)!.push(log)
    })
    
    // 为每个请求生成数据点
    requestMap.forEach((traces, requestId) => {
      const auctionResult = traces.find(t => t.action === 'AUCTION_RESULT')
      const latencyTimeout = traces.find(t => t.reason_code === 'LATENCY_TIMEOUT')
      const finalDecision = traces.find(t => 
        t.action === 'FINAL_DECISION' || 
        (t.node === 'ADX' && t.decision === 'REJECT')
      )
      
      // 获取延迟（优先从延迟超时日志，然后从其他日志）
      const latency = latencyTimeout?.latency_ms ||
                     traces.find(t => t.latency_ms)?.latency_ms ||
                     traces.find(t => t.node === 'SSP' && t.internal_variables?.latency_ms)?.internal_variables?.latency_ms
      
      // 获取 eCPM（优先从竞价结果，然后从出价日志计算）
      const ecpm = auctionResult?.eCPM ||
                   auctionResult?.internal_variables?.winner_ecpm ||
                   (() => {
                     // 对于超时请求，尝试从 internal_variables 获取潜在最高 eCPM
                     if (latencyTimeout) {
                       const potentialEcpm = latencyTimeout.internal_variables?.highest_potential_ecpm_loss ||
                                            latencyTimeout.internal_variables?.max_potential_ecpm
                       if (potentialEcpm) return potentialEcpm
                     }
                     
                     // 从出价日志计算
                     const bidLogs = traces.filter(t => 
                       t.action === 'BID_CALCULATION' || t.action === 'BID_SUBMITTED'
                     )
                     
                     let maxEcpm = 0
                     bidLogs.forEach(bidLog => {
                       const bidPrice = bidLog.internal_variables?.final_bid || 
                                      bidLog.internal_variables?.bid_price
                       const pctr = bidLog.pCTR || bidLog.internal_variables?.pctr
                       const pcvr = bidLog.pCVR || bidLog.internal_variables?.pcvr
                       if (bidPrice && pctr && pcvr) {
                         const calculatedEcpm = bidPrice * pctr * pcvr * 1000
                         maxEcpm = Math.max(maxEcpm, calculatedEcpm)
                       }
                     })
                     
                     return maxEcpm > 0 ? maxEcpm : null
                   })()
      
      if (latency !== null && latency !== undefined && ecpm !== null && ecpm !== undefined && ecpm > 0) {
        let status: 'win' | 'timeout' | 'loss' = 'loss'
        
        // 优先判断超时
        if (latencyTimeout) {
          status = 'timeout'
        } 
        // 然后判断中标
        else if (auctionResult || (finalDecision && finalDecision.decision === 'PASS')) {
          status = 'win'
        }
        // 其他情况为落败
        
        points.push({
          latency: Number(latency),
          ecpm: Number(ecpm),
          status,
          request_id: requestId
        })
      }
    })
    
    return points
  }, [logs])
  
  const winData = data.filter(d => d.status === 'win')
  const timeoutData = data.filter(d => d.status === 'timeout')
  const lossData = data.filter(d => d.status === 'loss')
  
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-light-border rounded-lg shadow-lg">
          <p className="text-sm font-semibold text-light-text mb-1">
            Request: {data.request_id.slice(-8)}
          </p>
          <p className="text-xs text-light-text-muted">
            延迟: <span className="font-semibold">{data.latency.toFixed(1)}ms</span>
          </p>
          <p className="text-xs text-light-text-muted">
            eCPM: <span className="font-semibold">¥{data.ecpm.toFixed(4)}</span>
          </p>
          <p className="text-xs text-light-text-muted">
            状态: <span className={`font-semibold ${
              data.status === 'win' ? 'text-green-600' :
              data.status === 'timeout' ? 'text-red-600' :
              'text-gray-600'
            }`}>
              {data.status === 'win' ? '中标' : data.status === 'timeout' ? '超时' : '落败'}
            </span>
          </p>
        </div>
      )
    }
    return null
  }
  
  return (
    <div className="bg-white rounded-lg border border-gray-100 p-3 shadow-subtle">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-[#1e293b]">系统延迟与胜率分布</h2>
          <p className="text-[10px] text-gray-500 mt-0.5">
            展示延迟对竞价结果的影响
          </p>
        </div>
        <div className="text-xs text-gray-500">
          {data.length} 个数据点
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart
          margin={{ top: 15, right: 15, bottom: 15, left: 15 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis 
            type="number" 
            dataKey="latency" 
            name="延迟"
            unit="ms"
            label={{ value: '延迟 (ms)', position: 'insideBottom', offset: -5 }}
            domain={[0, 'dataMax + 20']}
          />
          <YAxis 
            type="number" 
            dataKey="ecpm" 
            name="eCPM"
            unit="¥"
            label={{ value: 'eCPM 出价 (¥)', angle: -90, position: 'insideLeft' }}
            domain={[0, 'dataMax * 1.1']}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine 
            x={100} 
            stroke="#ef4444" 
            strokeWidth={2} 
            strokeDasharray="5 5"
            label={{ value: '100ms 阈值', position: 'top', fill: '#ef4444' }}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="circle"
          />
          {/* 中标点 - 绿色 */}
          <Scatter 
            name="中标" 
            data={winData} 
            fill="#059669"
            stroke="#047857"
            strokeWidth={1.5}
          />
          {/* 超时点 - 红色 */}
          <Scatter 
            name="超时被拒" 
            data={timeoutData} 
            fill="#dc2626"
            stroke="#b91c1c"
            strokeWidth={1.5}
          />
          {/* 其他落败点 - 灰色 */}
          <Scatter 
            name="其他原因落败" 
            data={lossData} 
            fill="#6b7280"
            stroke="#4b5563"
            strokeWidth={1}
          />
        </ScatterChart>
      </ResponsiveContainer>
      
      <div className="mt-2 pt-2 border-t border-gray-100">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <div className="text-base font-bold text-green-600">{winData.length}</div>
            <div className="text-[10px] text-gray-500">中标</div>
          </div>
          <div className="text-center">
            <div className="text-base font-bold text-red-600">{timeoutData.length}</div>
            <div className="text-[10px] text-gray-500">超时被拒</div>
          </div>
          <div className="text-center">
            <div className="text-base font-bold text-gray-600">{lossData.length}</div>
            <div className="text-[10px] text-gray-500">其他原因落败</div>
          </div>
        </div>
      </div>
    </div>
  )
}

