"""
诊断脚本入口 - 供 API Route 调用
使用 pathlib 处理路径，兼容 Windows
"""
import json
import sys
from pathlib import Path

# 添加当前目录到 Python 路径
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

from agent import DiagnosticAgent

if __name__ == "__main__":
    try:
        agent = DiagnosticAgent()
        result = agent.diagnose()
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        import traceback
        error_msg = str(e) + "\n" + traceback.format_exc()
        print(json.dumps({
            'status': 'error',
            'message': error_msg,
            'timestamp': ''
        }))


