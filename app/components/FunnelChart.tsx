'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { FunnelData } from '../types'

interface FunnelChartProps {
  data: FunnelData
}

export default function FunnelChart({ data }: FunnelChartProps) {
  const { request, valid, bid, win } = data

  const stages = [
    { name: 'Request', value: request, color: 'bg-blue-500', label: '请求数' },
    { name: 'Valid', value: valid, color: 'bg-purple-500', label: '有效请求' },
    { name: 'Bid', value: bid, color: 'bg-yellow-500', label: '出价数' },
    { name: 'Win', value: win, color: 'bg-green-500', label: '中标数' },
  ]

  const calculateWidth = (value: number, max: number) => {
    if (max === 0) return 0
    return Math.max((value / max) * 100, 5) // 最小 5% 宽度以便可见
  }

  const calculateConversion = (current: number, previous: number) => {
    if (previous === 0) return 0
    return ((current / previous) * 100).toFixed(1)
  }

  const maxValue = Math.max(request, 1)

  return (
    <div className="bg-white rounded-lg border border-gray-100 p-3 shadow-subtle">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[#1e293b]">损耗漏斗</h2>
        <div className="text-xs text-gray-500">
          实时更新
        </div>
      </div>

      <div className="space-y-4">
        {stages.map((stage, index) => {
          const previousValue = index > 0 ? stages[index - 1].value : request
          const conversion = calculateConversion(stage.value, previousValue)
          const width = calculateWidth(stage.value, maxValue)
          const isDeclining = index > 0 && stage.value < previousValue

          return (
            <div key={stage.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded ${stage.color}`}></div>
                  <span className="text-xs font-medium text-gray-700">
                    {stage.label}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-base font-bold text-blue-600">
                    {stage.value}
                  </span>
                  {index > 0 && (
                    <div className="flex items-center gap-1 text-xs">
                      {isDeclining ? (
                        <TrendingDown className="w-3 h-3 text-red-600" />
                      ) : (
                        <TrendingUp className="w-3 h-3 text-green-600" />
                      )}
                      <span className={isDeclining ? 'text-red-600' : 'text-green-600'}>
                        {conversion}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="relative h-7 bg-gray-50 rounded overflow-hidden border border-gray-100">
                <div
                  className={`h-full ${stage.color} transition-all duration-500 ease-out flex items-center justify-end pr-2`}
                  style={{ width: `${width}%` }}
                >
                  {stage.value > 0 && width > 15 && (
                    <span className="text-xs font-semibold text-white">
                      {stage.value}
                    </span>
                  )}
                </div>
                {stage.value > 0 && width <= 15 && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-700">
                    {stage.value}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 pt-2 border-t border-gray-100">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-gray-500">总请求数: </span>
            <span className="text-blue-600 font-semibold">{request}</span>
          </div>
          <div>
            <span className="text-gray-500">中标率: </span>
            <span className="text-blue-600 font-semibold">
              {request > 0 ? ((win / request) * 100).toFixed(2) : 0}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

