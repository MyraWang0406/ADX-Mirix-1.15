import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface WhiteboxTrace {
  request_id: string
  timestamp: string
  node: string
  action: string
  decision: string
  reason_code: string
  internal_variables: Record<string, any>
  reasoning: string
  pCTR?: number | null
  pCVR?: number | null
  eCPM?: number | null
  latency_ms?: number | null
  second_best_bid?: number | null
  actual_paid_price?: number | null
  saved_amount?: number | null
}

export async function GET() {
  try {
    const logPath = path.join(process.cwd(), 'whitebox.log')
    
    if (!fs.existsSync(logPath)) {
      return NextResponse.json({ logs: [], total: 0 })
    }

    const fileContent = fs.readFileSync(logPath, 'utf-8')
    const lines = fileContent.split('\n').filter(line => line.trim())
    
    // 读取最后 100 行
    const lastLines = lines.slice(-100)
    
    const logs: WhiteboxTrace[] = lastLines
      .map(line => {
        try {
          return JSON.parse(line)
        } catch (e) {
          return null
        }
      })
      .filter((log): log is WhiteboxTrace => log !== null)
      .reverse() // 最新的在前

    return NextResponse.json({ 
      logs,
      total: logs.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error reading log file:', error)
    return NextResponse.json(
      { error: 'Failed to read log file', logs: [], total: 0 },
      { status: 500 }
    )
  }
}

