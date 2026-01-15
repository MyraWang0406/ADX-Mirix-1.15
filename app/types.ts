export interface WhiteboxTrace {
  request_id: string
  timestamp: string
  node: string
  action: string
  decision: string
  reason_code: string
  internal_variables: Record<string, any>
  reasoning: string
  // 新增字段（全部为 float 类型，允许为空）
  pCTR?: number | null  // 预估点击率
  pCVR?: number | null  // 预估转化率
  eCPM?: number | null  // 有效千次展示费用
  latency_ms?: number | null  // 处理耗时，毫秒
  second_best_bid?: number | null  // 第二高出价，用于二价结算
  actual_paid_price?: number | null  // 实际成交价
  saved_amount?: number | null  // 因二价机制节省的金额
}

export interface LogsResponse {
  logs: WhiteboxTrace[]
  total: number
  timestamp: string
}

export interface RequestSummary {
  request_id: string
  timestamp: string
  status: 'ACCEPTED' | 'REJECTED' | 'PENDING'
  reason_code?: string
  bid_price?: number
  node: string
  action: string
  reasoning: string
  // 新增核心指标
  pctr?: number | null
  pcvr?: number | null  // 新增 pCVR
  ecpm?: number | null
  saved_amount?: number | null
}

export interface FunnelData {
  request: number
  valid: number
  bid: number
  win: number
}

