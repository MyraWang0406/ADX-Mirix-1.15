/**
 * 错误代码中文化映射表
 */
export const reasonCodeMap: Record<string, string> = {
  'LATENCY_TIMEOUT': '响应超时',
  'SIZE_MISMATCH': '尺寸不匹配',
  'IN_BLACKLIST': '黑名单过滤',
  'BID_BELOW_FLOOR': '出价低于底价',
  'CREATIVE_MISMATCH': '素材不合规',
  'FLOOR_PRICE_HIGH': '底价过高',
  'REJECTED': '已拒绝',
  'BID_ABOVE_FLOOR': '通过底价检查',
  'NOT_IN_BLACKLIST': '不在黑名单',
  'SIZE_MATCHED': '尺寸匹配',
  'ALL_FILTERS_PASSED': '所有过滤通过',
  'CTR_CALCULATED': 'CTR 已计算',
  'BID_CALCULATED': '出价已计算',
  'BID_SUBMITTED': '出价已提交',
  'REQUEST_CREATED': '请求已创建',
  'LATENCY_OK': '延迟正常',
  'CREATIVE_COMPLIANT': '素材合规',
  'AUCTION_WON': '竞价获胜'
}

/**
 * 将错误代码转换为中文
 */
export function translateReasonCode(code: string): string {
  return reasonCodeMap[code] || code
}


