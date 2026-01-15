'use client'

import { useMemo } from 'react'
import { WhiteboxTrace } from '../types'

interface MiniRegionHeatmapProps {
  logs: WhiteboxTrace[]
}

export default function MiniRegionHeatmap({ logs }: MiniRegionHeatmapProps) {
  const regionStats = useMemo(() => {
    const requestMap = new Map<string, WhiteboxTrace[]>()
    
    // 按 request_id 分组
    logs.forEach(log => {
      if (!requestMap.has(log.request_id)) {
        requestMap.set(log.request_id, [])
      }
      requestMap.get(log.request_id)!.push(log)
    })
    
    // 按区域聚合 eCPM
    const regionMap = new Map<string, { totalEcpm: number; count: number }>()
    
    requestMap.forEach((traces, requestId) => {
      const sspLog = traces.find(t => t.node === 'SSP')
      if (!sspLog) return
      
      // 提取区域
      const appId = sspLog.internal_variables?.app_id || ''
      const appName = sspLog.internal_variables?.app_name || ''
      
      let region = 'Unknown'
      if (appId.toLowerCase().includes('brazil') || appName.toLowerCase().includes('brazil')) {
        region = 'Brazil'
      } else if (appId.toLowerCase().includes('china') || appName.toLowerCase().includes('china')) {
        region = 'China'
      } else if (appId.toLowerCase().includes('us') || appId.toLowerCase().includes('usa')) {
        region = 'US'
      } else if (appId.toLowerCase().includes('sea') || appName.toLowerCase().includes('东南亚')) {
        region = 'SEA'
      } else if (appId.toLowerCase().includes('eu') || appName.toLowerCase().includes('europe')) {
        region = 'EU'
      } else {
        region = appId ? `R${appId.slice(0, 2)}` : 'Unknown'
      }
      
      if (!regionMap.has(region)) {
        regionMap.set(region, { totalEcpm: 0, count: 0 })
      }
      
      const stats = regionMap.get(region)!
      stats.count += 1
      
      // 查找 eCPM
      const auctionResult = traces.find(t => t.action === 'AUCTION_RESULT')
      if (auctionResult) {
        const ecpm = auctionResult.eCPM || auctionResult.internal_variables?.winner_ecpm || 0
        stats.totalEcpm += ecpm
      } else {
        const bidLog = traces.find(t => 
          t.action === 'BID_CALCULATION' || t.action === 'BID_SUBMITTED'
        )
        if (bidLog) {
          const bidPrice = bidLog.internal_variables?.final_bid || bidLog.internal_variables?.bid_price || 0
          const pctr = bidLog.pCTR || bidLog.internal_variables?.pctr || 0
          const pcvr = bidLog.pCVR || bidLog.internal_variables?.pcvr || 0
          if (bidPrice && pctr && pcvr) {
            const ecpm = bidPrice * pctr * pcvr * 1000
            stats.totalEcpm += ecpm
          }
        }
      }
    })
    
    // 计算平均值并排序
    const result = Array.from(regionMap.entries()).map(([region, stats]) => ({
      region,
      avgEcpm: stats.count > 0 ? stats.totalEcpm / stats.count : 0,
      count: stats.count
    }))
    
    result.sort((a, b) => b.avgEcpm - a.avgEcpm)
    return result.slice(0, 6)  // 只显示前6个区域
  }, [logs])
  
  // 计算最大 eCPM 用于归一化
  const maxEcpm = Math.max(...regionStats.map(s => s.avgEcpm), 1)
  
  return (
    <div className="bg-white rounded-lg border border-gray-100 p-2 shadow-subtle">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-[#1e293b]">区域流量价值密度</span>
        <span className="text-[9px] text-gray-500">{regionStats.length} 区域</span>
      </div>
      
      <div className="grid grid-cols-3 gap-1.5">
        {regionStats.map((stats) => {
          const intensity = Math.min(100, Math.max(10, (stats.avgEcpm / maxEcpm) * 100))
          const bgIntensity = Math.min(0.3, intensity / 100)
          
          return (
            <div key={stats.region} className="flex flex-col items-center">
              <div 
                className="w-full h-8 rounded border border-gray-200 flex items-center justify-center mb-0.5"
                style={{ backgroundColor: `rgba(37, 99, 235, ${bgIntensity})` }}
              >
                <span className="text-[9px] font-bold text-white drop-shadow">
                  {stats.region}
                </span>
              </div>
              <div className="text-[9px] text-gray-600 text-center">
                ${stats.avgEcpm.toFixed(1)}
              </div>
            </div>
          )
        })}
      </div>
      
      {regionStats.length === 0 && (
        <div className="text-center py-2 text-gray-400 text-[9px]">
          暂无数据
        </div>
      )}
    </div>
  )
}


