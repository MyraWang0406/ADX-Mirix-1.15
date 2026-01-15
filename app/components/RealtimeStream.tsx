'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Activity, CheckCircle, XCircle, Clock, TrendingUp, AlertCircle, DollarSign } from 'lucide-react'
import { WhiteboxTrace, RequestSummary } from '../types'
import { translateReasonCode } from '../utils/reasonCodeMap'

// 增强的请求详情组件
function EnhancedRequestDetails({ 
  requestLogs, 
  summary 
}: { 
  requestLogs: WhiteboxTrace[]
  summary: RequestSummary
}) {
  // 查找关键信息
  const sspLog = requestLogs.find(l => l.node === 'SSP' && l.action === 'REQUEST_GENERATED')
  const bidLog = requestLogs.find(l => 
    l.action === 'BID_CALCULATION' || l.action === 'BID_SUBMITTED'
  )
  const auctionLog = requestLogs.find(l => l.action === 'AUCTION_RESULT')
  const latencyTimeoutLog = requestLogs.find(l => l.reason_code === 'LATENCY_TIMEOUT')
  
  // 获取处理耗时
  const latency = sspLog?.latency_ms || 
                  requestLogs.find(l => l.latency_ms)?.latency_ms ||
                  latencyTimeoutLog?.latency_ms
  
  // 获取出价信息（优先从竞价结果获取，否则从出价日志获取）
  const bidPrice = auctionLog?.internal_variables?.winner_bid ||
                   bidLog?.internal_variables?.final_bid || 
                   bidLog?.internal_variables?.bid_price ||
                   summary.bid_price
  const pctr = auctionLog?.pCTR || 
               bidLog?.pCTR || 
               bidLog?.internal_variables?.pctr
  const pcvr = auctionLog?.pCVR || 
               bidLog?.pCVR || 
               bidLog?.internal_variables?.pcvr
  const ecpm = auctionLog?.eCPM || 
               auctionLog?.internal_variables?.winner_ecpm ||
               (bidPrice && pctr && pcvr ? bidPrice * pctr * pcvr * 1000 : null)
  
  // 获取二价信息（仅中标请求）
  const actualPaidPrice = auctionLog?.actual_paid_price
  const savedAmount = auctionLog?.saved_amount
  const secondBestBid = auctionLog?.second_best_bid
  const winnerEcpm = auctionLog?.eCPM || auctionLog?.internal_variables?.winner_ecpm
  
  // 获取延迟超时信息
  const maxPotentialEcpm = latencyTimeoutLog?.internal_variables?.max_potential_ecpm
  const timeoutThreshold = latencyTimeoutLog?.internal_variables?.timeout_threshold || 100

  return (
    <div className="mt-3 space-y-3">
      {/* 处理耗时 - 所有请求都显示 */}
      {latency !== null && latency !== undefined && (
        <div className="bg-blue-50 p-2 rounded-lg border border-blue-200">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-indigo-700" />
            <span className="text-xs font-semibold text-indigo-700">处理耗时</span>
          </div>
          <div className="text-xs text-gray-700">
            {latency.toFixed(1)}ms
            {latencyTimeoutLog && (
              <span className="ml-2 text-red-600 font-semibold">
                (超过阈值 {timeoutThreshold}ms)
              </span>
            )}
          </div>
        </div>
      )}

      {/* 出价详细构成 - 有出价的请求 */}
      {bidPrice && bidPrice > 0 && (
        <div className="bg-purple-50 p-2 rounded-lg border border-purple-200">
          <div className="flex items-center gap-1.5 mb-1.5">
            <DollarSign className="w-3.5 h-3.5 text-indigo-700" />
            <span className="text-xs font-semibold text-indigo-700">出价详细构成</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <div>
              <span className="text-gray-500">出价:</span>
              <span className="ml-1.5 text-indigo-700 font-semibold">¥{bidPrice.toFixed(2)}</span>
            </div>
            {pctr !== null && pctr !== undefined && (
              <div>
                <span className="text-gray-500">pCTR:</span>
                <span className="ml-1.5 text-indigo-700 font-semibold">{(pctr * 100).toFixed(2)}%</span>
              </div>
            )}
            {pcvr !== null && pcvr !== undefined && (
              <div>
                <span className="text-gray-500">pCVR:</span>
                <span className="ml-1.5 text-indigo-700 font-semibold">{(pcvr * 100).toFixed(2)}%</span>
              </div>
            )}
            {ecpm !== null && ecpm !== undefined && (
              <div>
                <span className="text-gray-500">eCPM:</span>
                <span className="ml-1.5 text-indigo-700 font-semibold">¥{ecpm.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 中标信息 - 仅中标请求 */}
      {summary.status === 'ACCEPTED' && auctionLog && (
        <div className="bg-green-50 p-2 rounded-lg border border-green-200">
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-green-600" />
            <span className="text-xs font-semibold text-green-700">中标信息</span>
          </div>
          <div className="space-y-1 text-xs">
            <div>
              <span className="text-gray-500">胜利原因:</span>
              <span className="ml-1.5 text-indigo-700 font-semibold">
                eCPM 最高 (¥{winnerEcpm?.toFixed(2) || 'N/A'})
              </span>
            </div>
            {actualPaidPrice !== null && actualPaidPrice !== undefined && (
              <div>
                <span className="text-gray-500">实际成交价:</span>
                <span className="ml-1.5 text-indigo-700 font-semibold">
                  ¥{actualPaidPrice.toFixed(2)}
                </span>
                {savedAmount !== null && savedAmount !== undefined && savedAmount > 0 && (
                  <span className="ml-2 text-green-600">
                    (节省: <span className="font-bold">¥{savedAmount.toFixed(2)}</span>)
                  </span>
                )}
              </div>
            )}
            {secondBestBid !== null && secondBestBid !== undefined && (
              <div className="text-[10px] text-gray-500 mt-0.5">
                第二高出价: ¥{secondBestBid.toFixed(2)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 延迟超时损失 - 仅延迟被拒请求 */}
      {summary.status === 'REJECTED' && summary.reason_code === 'LATENCY_TIMEOUT' && latencyTimeoutLog && (
        <div className="bg-red-50 p-2 rounded-lg border border-red-200">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertCircle className="w-3.5 h-3.5 text-red-600" />
            <span className="text-xs font-semibold text-red-700">响应超时损失</span>
          </div>
          <div className="space-y-1 text-xs">
            <div>
              <span className="text-gray-500">耗时:</span>
              <span className="ml-1.5 text-red-700 font-semibold">
                {latency?.toFixed(1) || 'N/A'}ms
              </span>
              <span className="ml-1.5 text-red-600 text-[10px]">
                (超过阈值 {timeoutThreshold}ms)
              </span>
            </div>
            {maxPotentialEcpm !== null && maxPotentialEcpm !== undefined && maxPotentialEcpm > 0 && (
              <div>
                <span className="text-gray-500">错失潜在最高 eCPM:</span>
                <span className="ml-1.5 text-red-700 font-bold">
                  ¥{maxPotentialEcpm.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 完整日志详情（可折叠） */}
      <details className="mt-3">
        <summary className="text-xs text-light-text-muted cursor-pointer hover:text-light-text flex items-center gap-1 mb-2">
          查看完整日志详情
          <ChevronDown className="w-3 h-3" />
        </summary>
        <div className="space-y-2">
                          {requestLogs.map((log, idx) => (
            <div 
              key={idx}
              className="bg-gray-50 p-2 rounded border border-gray-100"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[10px] font-semibold text-indigo-700">
                  {log.node}
                </span>
                <span className="text-[10px] text-gray-500">
                  {log.action}
                </span>
                <span className={`text-[10px] px-1 py-0.5 rounded ${
                  log.decision === 'PASS'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {log.decision}
                </span>
              </div>
              <pre className="text-[10px] text-gray-600 overflow-x-auto">
                {JSON.stringify(log, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}

interface RealtimeStreamProps {
  logs: WhiteboxTrace[]
  onRequestClick?: (requestId: string) => void
}

export default function RealtimeStream({ logs, onRequestClick }: RealtimeStreamProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [summaries, setSummaries] = useState<RequestSummary[]>([])

  useEffect(() => {
    // 按 request_id 分组，获取每个请求的摘要
    const requestMap = new Map<string, WhiteboxTrace[]>()
    
    logs.forEach(log => {
      if (!requestMap.has(log.request_id)) {
        requestMap.set(log.request_id, [])
      }
      requestMap.get(log.request_id)!.push(log)
    })

    const newSummaries: RequestSummary[] = Array.from(requestMap.entries()).map(([request_id, traces]) => {
      // 找到最终决策（优先查找竞价结果）
      const auctionResult = traces.find(t => t.action === 'AUCTION_RESULT')
      const finalDecision = auctionResult || traces.find(t => 
        t.action === 'FINAL_DECISION' || 
        t.action === 'BID_SUBMITTED' ||
        (t.node === 'ADX' && t.action.includes('CHECK') && t.decision === 'REJECT')
      )

      // 找到出价信息
      const bidTrace = traces.find(t => 
        t.action === 'BID_CALCULATION' || t.action === 'BID_SUBMITTED'
      )

      // 判断状态：优先检查竞价结果，然后检查最终决策
      let status: 'ACCEPTED' | 'REJECTED' | 'PENDING' = 'PENDING'
      if (auctionResult) {
        status = 'ACCEPTED'
      } else if (finalDecision) {
        status = finalDecision.decision === 'REJECT' ? 'REJECTED' :
                 finalDecision.decision === 'PASS' ? 'ACCEPTED' : 'PENDING'
      }

      // 提取核心指标
      const pctr = auctionResult?.pCTR || 
                   bidTrace?.pCTR || 
                   bidTrace?.internal_variables?.pctr
      const pcvr = auctionResult?.pCVR || 
                   bidTrace?.pCVR || 
                   bidTrace?.internal_variables?.pcvr
      const bidPrice = auctionResult?.internal_variables?.winner_bid ||
                       bidTrace?.internal_variables?.final_bid || 
                       bidTrace?.internal_variables?.bid_price
      const ecpm = auctionResult?.eCPM ||
                   auctionResult?.internal_variables?.winner_ecpm ||
                   (bidPrice && pctr && pcvr ? bidPrice * pctr * pcvr * 1000 : null)
      const savedAmount = auctionResult?.saved_amount

      return {
        request_id,
        timestamp: traces[0]?.timestamp || '',
        status,
        reason_code: finalDecision?.reason_code,
        bid_price: bidPrice,
        node: finalDecision?.node || traces[0]?.node || 'UNKNOWN',
        action: finalDecision?.action || traces[0]?.action || 'UNKNOWN',
        reasoning: finalDecision?.reasoning || traces[0]?.reasoning || '',
        pctr: pctr || null,
        pcvr: pcvr || null,  // 新增 pCVR
        ecpm: ecpm || null,
        saved_amount: savedAmount || null
      }
    })

    // 按时间戳排序，最新的在前
    newSummaries.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    setSummaries(newSummaries.slice(0, 50)) // 只显示最新 50 条
  }, [logs])

  const toggleExpand = (requestId: string) => {
    const newExpanded = new Set(expandedIds)
    if (newExpanded.has(requestId)) {
      newExpanded.delete(requestId)
    } else {
      newExpanded.add(requestId)
    }
    setExpandedIds(newExpanded)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACCEPTED':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'REJECTED':
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return <Clock className="w-4 h-4 text-amber-600" />
    }
  }

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const formatTime = (timestamp: string) => {
    if (!mounted) return '--:--:--'
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        fractionalSecondDigits: 3
      })
    } catch {
      return timestamp
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 p-2.5 border-b border-gray-100">
        <Activity className="w-3.5 h-3.5 text-indigo-700" />
        <h2 className="text-sm font-semibold text-[#1e293b]">实时交易流</h2>
        <span className="ml-auto text-[10px] text-gray-500">
          {summaries.length} 条
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {summaries.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-xs">
            暂无交易记录
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {summaries.map((summary) => {
              const isExpanded = expandedIds.has(summary.request_id)
              const requestLogs = logs.filter(l => l.request_id === summary.request_id)
              
              return (
                <div key={summary.request_id} className="bg-white hover:bg-gray-50/50 transition-colors border-b border-gray-50">
                  <div 
                    className={`p-2 cursor-pointer ${
                      summary.status === 'REJECTED' ? 'hover:bg-red-50/30' : ''
                    }`}
                    onClick={() => {
                      if (summary.status === 'REJECTED' && onRequestClick) {
                        onRequestClick(summary.request_id)
                      } else {
                        toggleExpand(summary.request_id)
                      }
                    }}
                  >
                    <div className="flex items-start gap-1.5">
                      {getStatusIcon(summary.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          {/* 状态+原因作为第一视觉重点 */}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            summary.status === 'ACCEPTED' 
                              ? 'bg-green-100 text-green-700'
                              : summary.status === 'REJECTED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {summary.status === 'ACCEPTED' 
                              ? '竞价成功'
                              : summary.status === 'REJECTED'
                              ? (() => {
                                  const reasonCodeMap: Record<string, string> = {
                                    'LATENCY_TIMEOUT': '响应超时',
                                    'SIZE_MISMATCH': '尺寸不匹配',
                                    'IN_BLACKLIST': '黑名单过滤',
                                    'CREATIVE_MISMATCH': '素材不合规',
                                    'FLOOR_PRICE_HIGH': '底价过高',
                                    'BID_BELOW_FLOOR': '出价低于底价',
                                    'REJECTED': '已拒绝'
                                  }
                                  return reasonCodeMap[summary.reason_code || ''] || '已拒绝'
                                })()
                              : '处理中'}
                          </span>
                          {/* 缩短ID */}
                          <span className="text-[9px] font-mono text-gray-500">
                            Req-{summary.request_id.slice(-4)}
                          </span>
                        </div>
                        <div className="text-[9px] text-gray-500 mb-0.5">
                          {formatTime(summary.timestamp)}
                        </div>
                        <div className="text-[10px] text-gray-600 line-clamp-1 mb-1">
                          {summary.reasoning || summary.action}
                        </div>
                        {/* 核心指标 - 微型标签，一行显示（增强版：显示 pCTR、pCVR、二价节省） */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {summary.pctr !== null && summary.pctr !== undefined && (
                            <span className="text-[9px] px-1 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-100 font-medium">
                              pCTR: {(summary.pctr * 100).toFixed(1)}%
                            </span>
                          )}
                          {/* 显示 pCVR（如果可用） */}
                          {(() => {
                            const requestLogs = logs.filter(l => l.request_id === summary.request_id)
                            const bidLog = requestLogs.find(l => l.action === 'BID_CALCULATION' || l.action === 'BID_SUBMITTED')
                            const pcvr = bidLog?.pCVR || bidLog?.internal_variables?.pcvr
                            return pcvr ? (
                              <span className="text-[9px] px-1 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100 font-medium">
                                pCVR: {(pcvr * 100).toFixed(1)}%
                              </span>
                            ) : null
                          })()}
                          {summary.ecpm !== null && summary.ecpm !== undefined && (
                            <span className="text-[9px] px-1 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100 font-medium">
                              eCPM: ¥{summary.ecpm.toFixed(2)}
                            </span>
                          )}
                          {summary.saved_amount !== null && summary.saved_amount !== undefined && summary.saved_amount > 0 && (
                            <span className="text-[8px] text-green-600 font-medium">
                              已省 ¥{summary.saved_amount.toFixed(2)}
                            </span>
                          )}
                          {summary.bid_price && !summary.ecpm && (
                            <span className="text-[9px] px-1 py-0.5 bg-gray-50 text-gray-600 rounded border border-gray-100">
                              出价: ¥{summary.bid_price.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-3 h-3 text-gray-500 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-3 h-3 text-gray-500 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="px-2 pb-2 border-t border-gray-100">
                      <EnhancedRequestDetails 
                        requestLogs={requestLogs} 
                        summary={summary}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

