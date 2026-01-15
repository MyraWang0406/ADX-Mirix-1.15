'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, XCircle, Info, ChevronRight } from 'lucide-react'
import { WhiteboxTrace } from '../types'

// 格式化时间戳组件，避免 Hydration Error
function FormattedTimestamp({ timestamp }: { timestamp: string }) {
  const [mounted, setMounted] = useState(false)
  const [formatted, setFormatted] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      try {
        setFormatted(new Date(timestamp).toLocaleString('zh-CN'))
      } catch {
        setFormatted(timestamp)
      }
    }
  }, [mounted, timestamp])

  if (!mounted) return <div className="mt-1 text-[10px] text-gray-500">--:--:--</div>

  return <div className="mt-1 text-[10px] text-gray-500">{formatted}</div>
}

interface WhiteboxDebuggerProps {
  logs: WhiteboxTrace[]
  selectedRequestId: string | null
  onRequestSelect: (requestId: string | null) => void
}

// 自然语言翻译 reason_code
const translateReasonCode = (reasonCode: string, internalVars: Record<string, any>): string => {
  const translations: Record<string, (vars: Record<string, any>) => string> = {
    'BID_BELOW_FLOOR': (vars) => {
      const bid = vars.bid_price || 0
      const floor = vars.floor_price || 0
      const diff = floor - bid
      return `出价 ¥${bid.toFixed(4)} 低于底价 ¥${floor.toFixed(4)}，相差 ¥${diff.toFixed(4)}`
    },
    'BID_ABOVE_FLOOR': (vars) => {
      return `出价 ¥${vars.bid_price?.toFixed(4) || 0} 高于底价 ¥${vars.floor_price?.toFixed(4) || 0}，通过底价检查`
    },
    'IN_BLACKLIST': (vars) => {
      const device = vars.device_id || ''
      const app = vars.app_id || ''
      return `设备 ${device} 或应用 ${app} 在黑名单中，请求被拒绝`
    },
    'NOT_IN_BLACKLIST': (vars) => {
      return `设备 ${vars.device_id || ''} 和应用 ${vars.app_id || ''} 不在黑名单中，通过检查`
    },
    'SIZE_MISMATCH': (vars) => {
      const adSize = vars.ad_size || []
      const required = vars.required_size || []
      return `广告尺寸 ${adSize.join('×')} 尺寸不匹配要求尺寸 ${required.join('×')}`
    },
    'SIZE_MATCHED': (vars) => {
      return `广告尺寸 ${vars.ad_size?.join('×') || ''} 匹配要求尺寸 ${vars.required_size?.join('×') || ''}`
    },
    'ALL_FILTERS_PASSED': (vars) => {
      return `所有 ${vars.filters_count || 0} 个过滤规则均通过，请求被接受`
    },
    'CTR_CALCULATED': (vars) => {
      return `CTR 得分估算为 ${vars.ctr_score?.toFixed(2) || 0}（平台：${vars.platform || 'UNKNOWN'}，时段：${vars.hour || 0}点）`
    },
    'BID_CALCULATED': (vars) => {
      const base = vars.base_price || 0
      const ctr = vars.ctr_score || 0
      const mult = vars.multiplier || 1
      const final = vars.final_bid || 0
      return `出价计算：基础价 ¥${base.toFixed(2)} × CTR ${ctr.toFixed(2)} × 乘数 ${mult.toFixed(2)} = ¥${final.toFixed(4)}`
    },
    'BID_SUBMITTED': (vars) => {
      return `DSP 提交出价：¥${vars.final_bid?.toFixed(4) || vars.bid_price?.toFixed(4) || 0}`
    },
    'REQUEST_CREATED': (vars) => {
      const pctr = vars.pctr ? `，预估点击率 ${(vars.pctr * 100).toFixed(2)}%` : ''
      return `SSP 生成广告请求：设备 ${vars.device_id || ''}，应用 ${vars.app_name || ''} (${vars.app_id || ''})，平台 ${vars.platform || ''}，尺寸 ${vars.ad_size?.join('×') || ''}${pctr}`
    },
    'LATENCY_TIMEOUT': (vars) => {
      return `响应延迟 ${vars.latency_ms || 0}ms 超过阈值 ${vars.max_latency_ms || 100}ms，响应超时`
    },
    'LATENCY_OK': (vars) => {
      return `响应延迟 ${vars.latency_ms || 0}ms 在允许范围内（≤${vars.max_latency_ms || 100}ms）`
    },
    'CREATIVE_MISMATCH': (vars) => {
      return `素材不合规，被拒绝（可能包含违规内容、尺寸不符等）`
    },
    'CREATIVE_COMPLIANT': (vars) => {
      return `素材通过合规性检查`
    },
    'FLOOR_PRICE_HIGH': (vars) => {
      return `出价 ¥${vars.bid_price?.toFixed(4) || 0} 低于底价 ¥${vars.floor_price?.toFixed(4) || 0}，底价设置可能过高，导致 ¥${vars.price_gap?.toFixed(4) || 0} 的潜在收入损失`
    },
    'AUCTION_WON': (vars) => {
      return `竞价完成：出价 ¥${vars.winner_bid?.toFixed(4) || 0}，实际支付 ¥${vars.actual_payment?.toFixed(4) || 0}（二价计费），节省 ¥${vars.bid_shading?.toFixed(4) || 0}`
    },
  }

  const translator = translations[reasonCode]
  if (translator) {
    return translator(internalVars)
  }
  
  return `原因代码：${reasonCode}`
}

export default function WhiteboxDebugger({ 
  logs, 
  selectedRequestId, 
  onRequestSelect 
}: WhiteboxDebuggerProps) {
  const [requestTraces, setRequestTraces] = useState<WhiteboxTrace[]>([])

  useEffect(() => {
    if (selectedRequestId) {
      const traces = logs
        .filter(log => log.request_id === selectedRequestId)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      setRequestTraces(traces)
    } else {
      setRequestTraces([])
    }
  }, [selectedRequestId, logs])

  if (!selectedRequestId) {
    return (
      <div className="h-full flex items-center justify-center bg-white rounded-lg border border-gray-100 shadow-subtle">
        <div className="text-center">
          <Info className="w-10 h-10 text-gray-500 mx-auto mb-3" />
          <p className="text-xs text-gray-500">
            点击左侧失败请求查看白盒排查详情
          </p>
        </div>
      </div>
    )
  }

  const finalDecision = requestTraces.find(t => 
    t.action === 'FINAL_DECISION' || 
    (t.node === 'ADX' && t.decision === 'REJECT')
  )

  const isRejected = finalDecision?.decision === 'REJECT'
  const rejectReason = finalDecision?.reason_code

  return (
    <div className="h-full flex flex-col bg-white rounded-lg border border-gray-100 shadow-subtle">
      <div className="p-2.5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isRejected ? (
              <XCircle className="w-4 h-4 text-red-600" />
            ) : (
              <CheckCircle className="w-4 h-4 text-green-600" />
            )}
            <div>
              <h2 className="text-sm font-semibold text-[#1e293b]">
                白盒排查
              </h2>
              <p className="text-[10px] text-gray-500">
                {selectedRequestId.slice(-12)}
              </p>
            </div>
          </div>
          <button
            onClick={() => onRequestSelect(null)}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5">
        {isRejected && rejectReason && (
          <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-xs font-semibold text-red-700 mb-1">
                  拒绝原因
                </h3>
                <p className="text-xs text-gray-700">
                  {translateReasonCode(rejectReason, finalDecision?.internal_variables || {})}
                </p>
                <p className="text-[10px] text-gray-500 mt-1.5">
                  Reason Code: <code className="bg-gray-100 px-1 py-0.5 rounded">{rejectReason}</code>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-700 mb-2">
            决策链路追踪
          </h3>
          
          {requestTraces.map((trace, index) => {
            const isReject = trace.decision === 'REJECT'
            const isHighlight = isRejected && trace.reason_code === rejectReason

            return (
              <div
                key={index}
                className={`p-2.5 rounded-lg border transition-all ${
                  isHighlight
                    ? 'bg-red-50 border-red-300'
                    : isReject
                    ? 'bg-red-50/50 border-red-200'
                    : 'bg-white border-gray-100'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isReject
                      ? 'bg-red-100 text-red-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {index + 1}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                        {trace.node}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {trace.action}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        trace.decision === 'PASS'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {trace.decision}
                      </span>
                      {trace.reason_code && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {translateReasonCode(trace.reason_code, trace.internal_variables)}
                        </span>
                      )}
                    </div>

                    <div className="mb-1.5">
                      <p className="text-xs text-gray-700">
                        {translateReasonCode(trace.reason_code, trace.internal_variables)}
                      </p>
                    </div>

                    {trace.reasoning && (
                      <div className="mt-1.5 pt-1.5 border-t border-gray-100">
                        <p className="text-[10px] text-gray-500">
                          {trace.reasoning}
                        </p>
                      </div>
                    )}

                    {Object.keys(trace.internal_variables).length > 0 && (
                      <details className="mt-1.5">
                        <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-700 flex items-center gap-1">
                          查看内部变量
                          <ChevronRight className="w-2.5 h-2.5" />
                        </summary>
                        <pre className="mt-1.5 text-[10px] text-gray-600 bg-gray-50 p-2 rounded overflow-x-auto border border-gray-100">
                          {JSON.stringify(trace.internal_variables, null, 2)}
                        </pre>
                      </details>
                    )}

                    <FormattedTimestamp timestamp={trace.timestamp} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

