# AI 诊断 Agent 使用指南

## 概述

AI 诊断 Agent 是 Sprint 3 的核心功能，能够自动分析 `whitebox.log` 日志，检测异常并生成智能建议。

## 功能特性

### 1. 异常检测

Agent 会自动检测以下异常情况：

#### 中标率过低（竞争激烈）
- **触发条件**: 中标率 < 10% 且总请求数 >= 10
- **严重程度**: 高
- **建议**: 优化出价策略或调整底价设置

#### 尺寸不匹配占比过高（素材问题）
- **触发条件**: 尺寸不匹配占比 > 30%
- **严重程度**: 中
- **建议**: 检查广告素材尺寸配置，确保与需求匹配

#### 底价过滤占比过高
- **触发条件**: 因底价过滤被拒绝的请求占比 > 50%
- **严重程度**: 中
- **建议**: 评估底价设置是否合理，考虑适当降低

#### 黑名单过滤较多
- **触发条件**: 因黑名单被拒绝的请求占比 > 20%
- **严重程度**: 低
- **建议**: 审查黑名单策略，确保不会过度过滤有效流量

### 2. LLM 智能分析

Agent 会调用 LLM（GPT-4o）分析最近的错误日志，生成结构化的操作建议。

#### 使用真实 API（可选）

1. 安装 OpenAI 库：
```bash
pip install openai
```

2. 设置环境变量：
```bash
export OPENAI_API_KEY="your-api-key-here"
```

或在 `.env.local` 文件中设置（Next.js 会自动读取）。

#### 使用模拟响应（默认）

如果不设置 API Key，Agent 会基于检测到的异常类型生成智能模拟响应，这些响应仍然具有参考价值。

## 使用方法

### 命令行测试

```bash
python test_agent.py
```

### 通过 API 调用

前端看板会自动每 30 秒调用一次 `/api/diagnose` 接口。

也可以手动调用：

```bash
curl http://localhost:3000/api/diagnose
```

## 输出格式

```json
{
  "status": "success",
  "timestamp": "2026-01-15T10:24:42.981670",
  "statistics": {
    "win_rate": 60.0,
    "win_stats": {
      "total_requests": 5,
      "win_count": 3,
      "win_rate": 60.0
    },
    "reject_analysis": {
      "total_rejects": 4,
      "distribution": {
        "SIZE_MISMATCH": {
          "count": 2,
          "percentage": 50.0
        }
      }
    }
  },
  "anomalies": [
    {
      "type": "SIZE_MISMATCH_HIGH",
      "severity": "medium",
      "title": "素材问题",
      "description": "尺寸不匹配占比 50.00%，超过 30% 阈值",
      "details": {...},
      "suggestion": "建议检查广告素材尺寸配置，确保与需求匹配"
    }
  ],
  "ai_suggestions": {
    "summary": "检测到大量尺寸不匹配问题，影响广告投放效果。",
    "suggestions": [
      "建议：检查所有广告素材尺寸，确保与需求尺寸 320×50 匹配",
      "建议：在 SSP 请求阶段增加尺寸预检查，提前过滤不匹配请求",
      "建议：考虑支持多尺寸适配，增加 300×250 等常用尺寸",
      "建议：更新素材库，统一使用标准尺寸 320×50"
    ],
    "priority": "中"
  },
  "total_logs_analyzed": 44
}
```

## 前端展示

在看板底部会显示"AI 专家建议"卡片，包含：

1. **统计信息**: 中标率、总请求数、中标数、拒绝数
2. **异常检测**: 高亮显示检测到的异常，按严重程度分类
3. **AI 智能分析**: 
   - 问题总结
   - 操作建议（3-5条）
   - 优先级（高/中/低）

## 自定义扩展

### 添加新的异常检测规则

在 `agent.py` 的 `detect_anomalies` 方法中添加：

```python
def detect_anomalies(self, logs: List[WhiteboxTrace]) -> List[Dict]:
    anomalies = []
    # ... 现有检测逻辑 ...
    
    # 添加新规则
    if your_condition:
        anomalies.append({
            'type': 'YOUR_ANOMALY_TYPE',
            'severity': 'high',  # high/medium/low
            'title': '问题标题',
            'description': '问题描述',
            'details': {...},
            'suggestion': '建议措施'
        })
    
    return anomalies
```

### 自定义 LLM 提示词

修改 `generate_llm_prompt` 方法来自定义提示词格式。

## 故障排查

### Agent 无法执行

1. 确保 Python 环境已正确配置
2. 检查 `agent.py` 和 `schemas.py` 文件是否存在
3. 确保 `whitebox.log` 文件存在且有内容

### API 调用失败

1. 检查 Next.js 开发服务器是否运行
2. 查看浏览器控制台和服务器日志
3. 确保 Python 可执行文件在系统 PATH 中

### LLM API 调用失败

1. 检查 API Key 是否正确设置
2. 确保网络连接正常
3. 如果 API 调用失败，系统会自动降级到模拟响应

## 性能优化

- Agent 分析最近 100 条日志（可调整）
- 前端每 30 秒自动刷新（可调整）
- LLM 调用使用缓存机制（未来版本）


