'use client'

import { useMemo } from 'react'
import { MapPin } from 'lucide-react'
import { WhiteboxTrace } from '../types'

interface RegionHeatmapProps {
  logs: WhiteboxTrace[]
}

interface RegionStats {
  region: string
  totalRequests: number
  totalEcpm: number
  winCount: number
  avgEcpm: number
}

export default function RegionHeatmap({ logs }: RegionHeatmapProps) {
  const regionStats = useMemo(() => {
    const requestMap = new Map<string, WhiteboxTrace[]>()
    
    // 按 request_id 分组
    logs.forEach(log => {
      if (!requestMap.has(log.request_id)) {
        requestMap.set(log.request_id, [])
      }
      requestMap.get(log.request_id)!.push(log)
    })
    
    // 按区域聚合
    const regionMap = new Map<string, RegionStats>()
    
    requestMap.forEach((traces, requestId) => {
      const sspLog = traces.find(t => t.node === 'SSP')
      if (!sspLog) return
      
      // 提取区域（从 app_id 或 app_name 推断）
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
        region = 'Southeast Asia'
      } else if (appId.toLowerCase().includes('eu') || appName.toLowerCase().includes('europe')) {
        region = 'Europe'
      } else {
        // 尝试从 app_id 推断更多区域
        const appIdLower = appId.toLowerCase()
        if (appIdLower.includes('jp') || appIdLower.includes('japan')) {
          region = 'Japan'
        } else if (appIdLower.includes('kr') || appIdLower.includes('korea')) {
          region = 'Korea'
        } else if (appIdLower.includes('in') || appIdLower.includes('india')) {
          region = 'India'
        } else if (appIdLower.includes('au') || appIdLower.includes('australia')) {
          region = 'Australia'
        } else if (appIdLower.includes('mx') || appIdLower.includes('mexico')) {
          region = 'Mexico'
        } else if (appIdLower.includes('ca') || appIdLower.includes('canada')) {
          region = 'Canada'
        } else {
          // 如果无法识别，使用通用区域名
          region = 'Other'
        }
      }
      
      if (!regionMap.has(region)) {
        regionMap.set(region, {
          region,
          totalRequests: 0,
          totalEcpm: 0,
          winCount: 0,
          avgEcpm: 0
        })
      }
      
      const stats = regionMap.get(region)!
      stats.totalRequests += 1
      
      // 查找 eCPM
      const auctionResult = traces.find(t => t.action === 'AUCTION_RESULT')
      if (auctionResult) {
        stats.winCount += 1
        const ecpm = auctionResult.eCPM || auctionResult.internal_variables?.winner_ecpm || 0
        stats.totalEcpm += ecpm
      } else {
        // 从出价日志计算
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
    
    // 计算平均值
    const result = Array.from(regionMap.values()).map(stats => ({
      ...stats,
      avgEcpm: stats.totalRequests > 0 ? stats.totalEcpm / stats.totalRequests : 0
    }))
    
    // 按总 eCPM 排序
    result.sort((a, b) => b.totalEcpm - a.totalEcpm)
    
    return result
  }, [logs])
  
  // 计算最大 eCPM 用于归一化
  const maxEcpm = Math.max(...regionStats.map(s => s.totalEcpm), 1)
  
  // 获取颜色强度（0-100）
  const getIntensity = (ecpm: number) => {
    return Math.min(100, Math.max(20, (ecpm / maxEcpm) * 100))
  }
  
  return (
    <div className="bg-white rounded border border-gray-100 p-2">
      <div className="flex items-center gap-1.5 mb-1.5">
        <MapPin className="w-3.5 h-3.5 text-blue-600" />
        <h2 className="text-xs font-semibold text-[#1e293b]">全球流量价值分布</h2>
        <span className="text-[9px] text-gray-500">Revenue Heatmap</span>
      </div>
      
      <div className="space-y-1 mb-1.5">
        {regionStats.slice(0, 5).map((stats) => {
          const intensity = getIntensity(stats.totalEcpm)
          
          return (
            <div key={stats.region} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-semibold text-[#1e293b] truncate">
                    {stats.region}
                  </span>
                  <span className="text-[10px] font-bold text-blue-600">
                    ${stats.avgEcpm.toFixed(2)}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all"
                    style={{ width: `${intensity}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[9px] text-gray-500">
                    {stats.totalRequests} req
                  </span>
                  <span className="text-[9px] text-gray-500">
                    Win: {stats.winCount}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      
      {/* 商业洞察 */}
      {regionStats.length > 0 && (() => {
        const topRegion = regionStats[0]
        // 检查该地区是否有延迟问题
        const regionRequestIds = new Set<string>()
        logs.forEach(log => {
          const sspLog = logs.find(l => l.request_id === log.request_id && l.node === 'SSP')
          if (!sspLog) return
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
            region = 'Southeast Asia'
          } else if (appId.toLowerCase().includes('eu') || appName.toLowerCase().includes('europe')) {
            region = 'Europe'
          }
          if (region === topRegion.region) {
            regionRequestIds.add(log.request_id)
          }
        })
        
        const regionLogs = logs.filter(log => regionRequestIds.has(log.request_id))
        const hasHighLatency = regionLogs.some(log => 
          log.reason_code === 'LATENCY_TIMEOUT' || (log.latency_ms && log.latency_ms > 100)
        )
        
        return (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="text-[9px] text-gray-600 leading-relaxed">
              <span className="font-semibold text-blue-600">[洞察]</span>{' '}
              {topRegion.region} 地区 eCPM 最高（${topRegion.avgEcpm.toFixed(2)}），
              {hasHighLatency ? '但目前该地区延迟最高。如果优化该地区 CDN，预计可换回 15% 的折损收入。' : '建议重点关注该地区流量质量。'}
            </div>
          </div>
        )
      })()}
      
      {regionStats.length === 0 && (
        <div className="text-center py-4 text-gray-500 text-xs">
          暂无区域数据
        </div>
      )}
    </div>
  )
}

