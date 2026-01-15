'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Brain } from 'lucide-react'
import RealtimeStream from './components/RealtimeStream'
import FunnelChart from './components/FunnelChart'
import WhiteboxDebugger from './components/WhiteboxDebugger'
import AIAdvisor from './components/AIAdvisor'
import RevenueLossAnalyzer from './components/RevenueLossAnalyzer'
import LatencyWinRateChart from './components/LatencyWinRateChart'
import SmartStrategyCenter from './components/SmartStrategyCenter'
import RegionHeatmap from './components/RegionHeatmap'
import WinRateSparkline from './components/WinRateSparkline'
import DecisionCenter from './components/DecisionCenter'
import TopMetricsBar from './components/TopMetricsBar'
import HistoryMemory from './components/HistoryMemory'
import { WhiteboxTrace, FunnelData } from './types'

export default function Home() {
  const [logs, setLogs] = useState<WhiteboxTrace[]>([])
  const [funnelData, setFunnelData] = useState<FunnelData>({
    request: 0,
    valid: 0,
    bid: 0,
    win: 0
  })
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchLogs = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/logs')
      const data = await response.json()
      setLogs(data.logs || [])
      setLastUpdate(new Date())
      
      // 计算漏斗数据
      const requestIds = new Set<string>()
      const validIds = new Set<string>()
      const bidIds = new Set<string>()
      const winIds = new Set<string>()

      data.logs.forEach((log: WhiteboxTrace) => {
        requestIds.add(log.request_id)

        if (log.node === 'SSP' && log.action === 'REQUEST_GENERATED') {
          validIds.add(log.request_id)
        }

        if (log.node === 'DSP' && (log.action === 'BID_CALCULATION' || log.action === 'BID_SUBMITTED')) {
          bidIds.add(log.request_id)
        }

        // 优先检查竞价结果，然后检查最终决策
        if (log.action === 'AUCTION_RESULT' || 
            (log.node === 'ADX' && log.action === 'FINAL_DECISION' && log.decision === 'PASS')) {
          winIds.add(log.request_id)
        }
      })

      setFunnelData({
        request: requestIds.size,
        valid: validIds.size,
        bid: bidIds.size,
        win: winIds.size
      })
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 2000) // 每 2 秒轮询一次
    return () => clearInterval(interval)
  }, [])

  const [mounted, setMounted] = useState(false)
  const [formattedLastUpdate, setFormattedLastUpdate] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && lastUpdate) {
      setFormattedLastUpdate(
        lastUpdate.toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      )
    }
  }, [mounted, lastUpdate])

  // 找到失败的请求 ID
  const failedRequestIds = Array.from(
    new Set(
      logs
        .filter(log => log.decision === 'REJECT' && 
          (log.action === 'FINAL_DECISION' || log.node === 'ADX'))
        .map(log => log.request_id)
    )
  )

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#1e293b] overflow-hidden relative">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-3 shadow-subtle">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#1e293b]">
              白盒化广告交易看板
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Mirix 白盒化广告交易排查看板
            </p>
          </div>
          <div className="flex items-center gap-4">
            {mounted && (
              <div className="text-sm text-light-text-muted">
                最后更新: {formattedLastUpdate}
              </div>
            )}
            <button
              onClick={fetchLogs}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-light-accent hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Bento-Box 紧凑布局 */}
      <main className="p-3">
        {/* 顶层指标栏 (1行4列) */}
        <TopMetricsBar logs={logs} />
        
        {/* 中间层布局 - grid-cols-12 */}
        <div className="grid grid-cols-12 gap-3">
          {/* 左侧 3/12：实时交易流 */}
          <div className="col-span-12 lg:col-span-3 bg-white rounded border border-gray-100 overflow-hidden">
            <RealtimeStream 
              logs={logs} 
              onRequestClick={(requestId) => setSelectedRequestId(requestId)}
            />
          </div>

          {/* 中间 5/12：损耗漏斗 + 延迟胜率分布图 */}
          <div className="col-span-12 lg:col-span-5 space-y-3">
            <FunnelChart data={funnelData} />
            <LatencyWinRateChart logs={logs} />
            
            {/* Whitebox Debugger */}
            <div className="h-[400px]">
              <WhiteboxDebugger
                logs={logs}
                selectedRequestId={selectedRequestId}
                onRequestSelect={setSelectedRequestId}
              />
            </div>
          </div>

          {/* 右侧 4/12：全球流量价值分布 + AI 智能诊断 */}
          <div className="col-span-12 lg:col-span-4 space-y-3">
            <RegionHeatmap logs={logs} />
            <SmartStrategyCenter />
            <DecisionCenter />
          </div>
        </div>

        {/* 情景记忆 - 历史模式识别 */}
        <HistoryMemory logs={logs} />

        {/* Quick Access to Failed Requests - 清晰的胶囊标签 */}
        {failedRequestIds.length > 0 && !selectedRequestId && (
          <div className="mt-3 p-2 bg-white rounded border border-gray-100">
            <h3 className="text-[10px] font-semibold text-[#1e293b] mb-1.5">
              失败请求快速访问
            </h3>
            <div className="flex flex-wrap gap-1">
              {failedRequestIds.slice(0, 12).map((requestId) => {
                const trace = logs.find(l => l.request_id === requestId && l.decision === 'REJECT')
                const reasonCode = trace?.reason_code || 'REJECTED'
                
                // 中文化映射
                const reasonCodeMap: Record<string, string> = {
                  'LATENCY_TIMEOUT': '响应超时',
                  'SIZE_MISMATCH': '尺寸不匹配',
                  'IN_BLACKLIST': '黑名单过滤',
                  'BID_BELOW_FLOOR': '出价低于底价',
                  'CREATIVE_MISMATCH': '素材不合规',
                  'FLOOR_PRICE_HIGH': '底价过高',
                  'REJECTED': '已拒绝'
                }
                
                const reasonText = reasonCodeMap[reasonCode] || reasonCode
                
                return (
                  <button
                    key={requestId}
                    onClick={() => setSelectedRequestId(requestId)}
                    className="px-1.5 py-0.5 text-[9px] bg-red-50 hover:bg-red-100 text-red-600 rounded-full border border-red-200 transition-colors font-medium"
                  >
                    Req-{requestId.slice(-4)} · {reasonText}
                  </button>
                )
              })}
            </div>
          </div>
        )}  
      </main>

      {/* 右下角水印 */}
      <div className="fixed bottom-2 right-2 text-[9px] text-gray-400 pointer-events-none">
        <div className="text-center">
          <div>白盒化 ADX - Mirix</div>
          <div className="text-[8px] mt-0.5">myrawzm0406@163.com</div>
          <div className="text-[8px]">WeChat: 15301052620</div>
        </div>
      </div>
    </div>
  )
}
