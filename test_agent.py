"""
测试 agent.py 是否正常工作
"""
import json
from agent import DiagnosticAgent

if __name__ == "__main__":
    agent = DiagnosticAgent()
    result = agent.diagnose()
    print(json.dumps(result, ensure_ascii=False, indent=2))


