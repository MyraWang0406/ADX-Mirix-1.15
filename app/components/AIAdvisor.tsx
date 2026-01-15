'use client'

import { useState, useEffect } from 'react'
import { Brain, AlertTriangle, CheckCircle, Clock, RefreshCw, Sparkles } from 'lucide-react'

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

  if (!mounted) return null

  return (
    <div className="mt-4 text-xs text-light-text-muted text-center">
      最后更新: {formatted}
    </div>
  )
}

interface Anomaly {
  type: string
  severity: string
  insight_level?: string  // P8, P7 等
  title: string
  description: string
  details: any
  suggestion: string
}

interface AISuggestions {
  summary: string
  root_cause?: string  // 根因推测
  economic_impact?: string  // 经济损失评估
  suggestions: string[]
  priority: string
}

interface DiagnosticResult {
  status: string
  timestamp: string
  statistics?: {
    win_rate: number
    win_stats: {
      total_requests: number
      win_count: number
      win_rate: number
    }
    reject_analysis: {
      total_rejects: number
      distribution: Record<string, {
        count: number
        percentage: number
      }>
    }
  }
  anomalies?: Anomaly[]
  ai_suggestions?: AISuggestions
  total_logs_analyzed?: number
  message?: string
}

export default function AIAdvisor() {
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDiagnostic = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/diagnose')
      const data = await response.json()
      setDiagnostic(data)
    } catch (err) {
      setError('无法获取诊断结果')
      console.error('Error fetching diagnostic:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDiagnostic()
    const interval = setInterval(fetchDiagnostic, 30000) // 每30秒刷新一次
    return () => clearInterval(interval)
  }, [])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-300'
      case 'medium':
        return 'bg-amber-100 text-amber-700 border-amber-300'
      case 'low':
        return 'bg-blue-100 text-blue-700 border-blue-300'
      default:
        return 'bg-gray-100 text-gray-600 border-gray-300'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case '高':
        return 'bg-red-100 text-red-700'
      case '中':
        return 'bg-amber-100 text-amber-700'
      case '低':
        return 'bg-green-100 text-green-700'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  if (isLoading && !diagnostic) {
    return (
      <div className="bg-white rounded-lg border border-light-border p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-6 h-6 text-light-accent animate-pulse" />
          <h2 className="text-lg font-semibold text-light-text">AI 专家建议</h2>
        </div>
        <div className="text-center py-8 text-light-text-muted">
          <Clock className="w-8 h-8 mx-auto mb-2 animate-spin" />
          <p>正在分析日志数据...</p>
        </div>
      </div>
    )
  }

  if (error || diagnostic?.status === 'error') {
    return (
      <div className="bg-white rounded-lg border border-light-border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-light-accent" />
            <h2 className="text-lg font-semibold text-light-text">AI 专家建议</h2>
          </div>
          <button
            onClick={fetchDiagnostic}
            className="p-2 hover:bg-gray-50 rounded transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-light-text-muted" />
          </button>
        </div>
        <div className="text-center py-8 text-red-600">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <p>{error || diagnostic?.message || '诊断服务暂时不可用'}</p>
        </div>
      </div>
    )
  }

  if (diagnostic?.status === 'no_data') {
    return (
      <div className="bg-white rounded-lg border border-light-border p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-6 h-6 text-light-accent" />
          <h2 className="text-lg font-semibold text-light-text">AI 专家建议</h2>
        </div>
        <div className="text-center py-8 text-light-text-muted">
          <p>{diagnostic.message || '暂无日志数据可供分析'}</p>
        </div>
      </div>
    )
  }

  const { statistics, anomalies = [], ai_suggestions } = diagnostic || {}

  return (
    <div className="bg-white rounded-lg border border-gray-100 p-3 shadow-subtle">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-700" />
          <h2 className="text-sm font-semibold text-[#1e293b]">AI 专家建议</h2>
          {diagnostic?.total_logs_analyzed && (
            <span className="text-xs text-light-text-muted">
              (分析 {diagnostic.total_logs_analyzed} 条日志)
            </span>
          )}
        </div>
        <button
          onClick={fetchDiagnostic}
          disabled={isLoading}
          className="p-2 hover:bg-gray-50 rounded transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-light-text-muted ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 统计信息 */}
      {statistics && (
        <div className="mb-3 p-2.5 bg-white rounded-lg border border-gray-100 shadow-subtle">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-gray-500 mb-0.5 text-[10px]">中标率</div>
              <div className="text-base font-bold text-blue-600">
                {statistics.win_rate.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-gray-500 mb-0.5 text-[10px]">总请求数</div>
              <div className="text-base font-bold text-blue-600">
                {statistics.win_stats.total_requests}
              </div>
            </div>
            <div>
              <div className="text-gray-500 mb-0.5 text-[10px]">中标数</div>
              <div className="text-base font-bold text-green-600">
                {statistics.win_stats.win_count}
              </div>
            </div>
            <div>
              <div className="text-gray-500 mb-0.5 text-[10px]">拒绝数</div>
              <div className="text-base font-bold text-red-600">
                {statistics.reject_analysis.total_rejects}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 异常检测 - 响应式网格布局 */}
      {anomalies.length > 0 && (
        <div className="mb-3">
          <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            异常检测
            {diagnostic?.anomalies && diagnostic.anomalies.length > 0 && (
              <span className="ml-auto text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded font-bold animate-pulse">
                ⚠️ 红色预警
              </span>
            )}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {anomalies.map((anomaly, idx) => {
              const isCritical = diagnostic?.anomalies && diagnostic.anomalies.length > 0 && idx === 0
              
              // 移除P7/P8字样
              const cleanTitle = anomaly.title
                .replace(/【P7 洞察】/g, '[策略预警]')
                .replace(/【P8 洞察】/g, '[策略预警]')
                .replace(/【P7 损耗预警】/g, '[策略预警]')
                .replace(/【P8 策略建议】/g, '[策略预警]')
                .replace(/【P7 级决策建议】/g, '')
                .replace(/【P8 级决策建议】/g, '')
              
              return (
                <div
                  key={idx}
                  className={`p-2 rounded-lg border shadow-subtle ${
                    isCritical 
                      ? 'bg-red-50 border-red-300' 
                      : 'bg-white border-gray-100'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-xs font-semibold ${
                        isCritical ? 'text-red-700' : 'text-[#1e293b]'
                      }`}>
                        {cleanTitle}
                      </h4>
                      <p className="text-[10px] text-gray-600 line-clamp-2">{anomaly.description}</p>
                    </div>
                    <span className={`text-[9px] px-1 py-0.5 rounded flex-shrink-0 ml-2 ${getSeverityColor(anomaly.severity)}`}>
                      {anomaly.severity === 'high' ? '高' : anomaly.severity === 'medium' ? '中' : '低'}
                    </span>
                  </div>
                  <p className={`text-[10px] mt-1 line-clamp-2 ${
                    isCritical ? 'text-red-700' : 'text-gray-500'
                  }`}>
                    {anomaly.suggestion
                      .replace(/【P7 损耗预警】/g, '[策略预警]')
                      .replace(/【P8 策略建议】/g, '[策略预警]')
                      .replace(/【P7 级决策建议】/g, '')
                      .replace(/【P8 级决策建议】/g, '')}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* AI 建议 - 响应式网格布局（增强版：结构化专家建议） */}
      {ai_suggestions && (
        <div>
          <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5 text-blue-600" />
            AI 智能分析
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* 现象总结 */}
            {ai_suggestions.summary && (
              <div className="p-2.5 bg-white rounded-lg border border-gray-100 shadow-subtle">
                <div className="flex items-start gap-1.5 mb-1">
                  <span className="text-[10px] font-semibold text-[#1e293b]">【现象总结】</span>
                  <span className={`text-[10px] px-1 py-0.5 rounded ml-auto ${getPriorityColor(ai_suggestions.priority)}`}>
                    {ai_suggestions.priority}
                  </span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed">{ai_suggestions.summary}</p>
              </div>
            )}

            {/* 根因推测 */}
            {ai_suggestions.root_cause && (
              <div className="p-2.5 bg-white rounded-lg border border-gray-100 shadow-subtle">
                <div className="text-[10px] font-semibold text-[#1e293b] mb-1">【根因推测】</div>
                <p className="text-xs text-gray-700 leading-relaxed">{ai_suggestions.root_cause}</p>
              </div>
            )}

            {/* 经济损失评估 */}
            {ai_suggestions.economic_impact && (
              <div className="p-2.5 bg-white rounded-lg border border-gray-100 shadow-subtle">
                <div className="text-[10px] font-semibold text-[#1e293b] mb-1">【经济损失评估】</div>
                <p className="text-xs text-gray-700 leading-relaxed">{ai_suggestions.economic_impact}</p>
              </div>
            )}

            {/* 建议操作 - 只显示前2条 */}
            {ai_suggestions.suggestions && ai_suggestions.suggestions.length > 0 && (
              <div className="p-2.5 bg-white rounded-lg border border-gray-100 shadow-subtle">
                <div className="text-[10px] font-semibold text-[#1e293b] mb-1">【建议操作】</div>
                <div className="space-y-1">
                  {ai_suggestions.suggestions.slice(0, 2).map((suggestion, idx) => (
                    <div key={idx} className="flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-gray-700 flex-1 leading-relaxed">{suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {anomalies.length === 0 && !ai_suggestions && (
        <div className="text-center py-8 text-light-text-muted">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
          <p>系统运行正常，未检测到异常</p>
        </div>
      )}

      {diagnostic?.timestamp && <FormattedTimestamp timestamp={diagnostic.timestamp} />}
    </div>
  )
}

