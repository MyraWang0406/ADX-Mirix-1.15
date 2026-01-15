import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'

const execAsync = promisify(exec)

export const dynamic = 'force-dynamic'
export const revalidate = 0

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
  anomalies?: Array<{
    type: string
    severity: string
    title: string
    description: string
    details: any
    suggestion: string
  }>
  ai_suggestions?: {
    summary: string
    suggestions: string[]
    priority: string
  }
  structured_report?: {
    summary?: string
    root_cause?: string
    economic_impact?: string
    action_items?: string[]
  }
  total_potential_loss?: number
  estimated_hourly_loss?: number
  critical_alert?: boolean
  total_logs_analyzed?: number
  message?: string
}

export async function GET() {
  try {
    const scriptPath = path.join(process.cwd(), 'run_diagnose.py')
    
    // 检查脚本文件是否存在
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({
        status: 'error',
        message: '诊断脚本文件不存在',
        timestamp: new Date().toISOString()
      }, { status: 404 })
    }

    // 直接调用 Python 脚本文件
    const { stdout, stderr } = await execAsync(`python "${scriptPath}"`, {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024, // 10MB
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    })

    if (stderr && !stderr.includes('Warning') && !stderr.trim().startsWith('Traceback')) {
      console.warn('Python agent stderr:', stderr)
    }

    // 解析 JSON 输出
    const output = stdout.trim()
    if (!output) {
      throw new Error('Python agent returned empty output')
    }

    // 尝试提取 JSON（可能包含其他输出）
    let jsonStart = output.indexOf('{')
    let jsonEnd = output.lastIndexOf('}') + 1
    
    if (jsonStart === -1 || jsonEnd === 0) {
      throw new Error('No JSON found in output')
    }

    const jsonStr = output.substring(jsonStart, jsonEnd)
    const result: DiagnosticResult = JSON.parse(jsonStr)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error running diagnostic agent:', error)
    
    // 返回错误信息
    return NextResponse.json(
      {
        status: 'error',
        message: error.message || '诊断服务暂时不可用',
        timestamp: new Date().toISOString(),
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

