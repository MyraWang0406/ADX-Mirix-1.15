'use client'

import { useState, useEffect } from 'react'
import { Brain } from 'lucide-react'

interface DiagnosticResult {
  status: string
  timestamp: string
  ai_suggestions?: {
    summary?: string
    root_cause?: string
    economic_impact?: string
    suggestions?: string[]
    priority?: string
  }
  total_potential_loss?: number
  estimated_hourly_loss?: number
}

export default function SmartStrategyCenter() {
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchDiagnostic = async () => {
    setIsLoading(true)
    try {
      const mockData = {
        status: 'success',
        timestamp: new Date().toISOString(),
        ai_suggestions: {
          summary: 'ADX 上流流量上涨 23.5%，平均出价下降 2.1%，整体胜率下滑 1.8%',
          root_cause: '已识别到 3 个次要流量波动：已识别到 3 个次要流量波动：已识别到 3 个次要流量波动',
          economic_impact: '月度潜在损失 $12,500，其中延迟超时占 68%，素材不合规占 18%',
          suggestions: [
            '优先上线延迟优化策略，预计可挂回 $8,500',
            '对已拒绝的素材进行 A/B 测试，优化活动性',
            '在已识别的高价值时段流量上流 15% 出价'
          ],
          priority: 'HIGH'
        },
        estimated_hourly_loss: 520.5
      }
      setDiagnostic(mockData)
    } catch (err) {
      console.error('Error fetching diagnostic:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDiagnostic()
    const interval = setInterval(fetchDiagnostic, 30000) // 每30秒刷新
    return () => clearInterval(interval)
  }, [])

  const aiSuggestions = diagnostic?.ai_suggestions

  // 提取关键数据（金额、百分比）
  const extractHighlights = (text: string): string[] => {
    const highlights: string[] = []
    // 匹配金额（$、¥、数字）
    const moneyRegex = /[\$¥]\d+[.,]?\d*/g
    const moneyMatches = text.match(moneyRegex)
    if (moneyMatches) highlights.push(...moneyMatches)
    
    // 匹配百分比
    const percentRegex = /\d+[.,]?\d*%/g
    const percentMatches = text.match(percentRegex)
    if (percentMatches) highlights.push(...percentMatches)
    
    return highlights
  }

  const highlightText = (text: string) => {
    if (!text) return ''
    const highlights = extractHighlights(text)
    let highlighted = text
    
    // 避免重复替换
    const processed = new Set<string>()
    highlights.forEach(highlight => {
      if (!processed.has(highlight)) {
        processed.add(highlight)
        const regex = new RegExp(highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
        highlighted = highlighted.replace(
          regex,
          `<span class="font-bold text-blue-700 bg-blue-100 px-1 rounded">${highlight}</span>`
        )
      }
    })
    
    return highlighted
  }

  if (!aiSuggestions && !diagnostic?.total_potential_loss) {
    return (
      <div className="bg-white rounded border border-gray-100 p-2">
        <div className="flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
          <span className="text-xs font-semibold text-[#1e293b]">智能诊断与决策建议</span>
          {isLoading && <span className="text-[10px] text-gray-500 ml-auto">分析中...</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded border border-gray-100 p-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <div className="relative">
          <Brain className="w-3.5 h-3.5 text-blue-600" />
          <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20"></div>
        </div>
        <h3 className="text-xs font-bold text-[#1e293b]">智能诊断与决策建议</h3>
        <span className="text-[9px] text-gray-500">AI Insights</span>
        {diagnostic?.estimated_hourly_loss && (
          <span className="ml-auto text-[10px] text-gray-500">
            预计损失: <span className="font-bold text-red-600">¥{diagnostic.estimated_hourly_loss.toFixed(2)}/h</span>
          </span>
        )}
      </div>

      <div className="space-y-1.5 text-[10px]">
        {/* 隐私环境诊断 */}
        {diagnostic?.ai_suggestions?.suggestions?.some(s => s.includes('隐私受限环境') || s.includes('SKAN')) && (
          <div className="mb-2 p-1.5 bg-blue-50 border border-blue-200 rounded">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[9px] font-bold text-blue-700">🔒 隐私环境诊断</span>
            </div>
            {diagnostic.ai_suggestions.suggestions
              .filter(s => s.includes('隐私受限环境') || s.includes('SKAN'))
              .map((suggestion, idx) => (
                <div key={idx} className="text-[9px] text-blue-700 leading-relaxed">
                  {suggestion.replace(/【策略预警】/g, '').replace(/【P8 策略建议】/g, '')}
                </div>
              ))}
          </div>
        )}

        {/* 现象总结 */}
        {aiSuggestions?.summary && (
          <div>
            <div className="text-[9px] font-semibold text-[#1e293b] mb-0.5">【现象总结】</div>
            <div 
              className="text-[10px] text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: highlightText(aiSuggestions.summary) }}
            />
          </div>
        )}

        {/* 根因推测 */}
        {aiSuggestions?.root_cause && (
          <div>
            <div className="text-[9px] font-semibold text-[#1e293b] mb-0.5">【根因推测】</div>
            <div className="text-[10px] text-gray-700 leading-relaxed">
              {aiSuggestions.root_cause
                .replace(/【P7 损耗预警】/g, '[策略预警]')
                .replace(/【P8 策略建议】/g, '[策略预警]')
                .replace(/【P7 级决策建议】/g, '')
                .replace(/【P8 级决策建议】/g, '')
                .replace(/pCTR 模型预估偏低/g, 'pCTR 预估存在向下偏差')
                .replace(/建议引导广告主优化素材关键词或进行 A\/B Test 以提升质量分/g, '建议立即触发素材 A\/B 测试以修正模型质量分')}
            </div>
          </div>
        )}

        {/* 经济损失评估 */}
        {aiSuggestions?.economic_impact && (
          <div>
            <div className="text-[9px] font-semibold text-[#1e293b] mb-0.5">【经济损失评估】</div>
            <div 
              className="text-[10px] text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: highlightText(aiSuggestions.economic_impact.replace(/\$/g, '¥')) }}
            />
          </div>
        )}

        {/* 建议操作 - 只显示前3条 */}
        {aiSuggestions?.suggestions && aiSuggestions.suggestions.length > 0 && (
          <div>
            <div className="text-[9px] font-semibold text-[#1e293b] mb-0.5">【建议操作】</div>
            <div className="space-y-0.5">
              {aiSuggestions.suggestions.slice(0, 3).map((suggestion, idx) => (
                <div key={idx} className="text-[10px] text-gray-700 flex items-start gap-1.5">
                  <span className="text-blue-600 font-bold">{idx + 1}.</span>
                  <span>{suggestion
                    .replace(/【P7 损耗预警】/g, '[策略预警]')
                    .replace(/【P8 策略建议】/g, '[策略预警]')
                    .replace(/【P7 级决策建议】/g, '')
                    .replace(/【P8 级决策建议】/g, '')
                    .replace(/pCTR 模型预估偏低/g, 'pCTR 预估存在向下偏差')
                    .replace(/建议引导广告主优化素材关键词或进行 A\/B Test 以提升质量分/g, '建议立即触发素材 A\/B 测试以修正模型质量分')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
