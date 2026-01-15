import json

with open('whitebox.log', 'r', encoding='utf-8') as f:
    logs = [json.loads(line) for line in f if line.strip()]

print(f"总日志数: {len(logs)}\n")

# 检查新字段
new_fields = ['pCTR', 'pCVR', 'eCPM', 'latency_ms', 'second_best_bid', 'actual_paid_price', 'saved_amount']

print("检查新字段:")
for field in new_fields:
    count = sum(1 for log in logs if log.get(field) is not None)
    print(f"  {field}: {count} 条记录")

# 查找包含新字段的日志示例
print("\n包含新字段的日志示例:")
for log in logs:
    has_new_field = any(log.get(field) is not None for field in new_fields)
    if has_new_field:
        print(f"\n{log['node']} - {log['action']}:")
        for field in new_fields:
            if log.get(field) is not None:
                print(f"  {field}: {log[field]}")
        if log.get('internal_variables'):
            if 'ecpm' in str(log['internal_variables']):
                print(f"  internal_variables.eCPM: {log['internal_variables'].get('winner_ecpm', 'N/A')}")
        break

# 查找竞价结果
print("\n竞价结果记录:")
auction_logs = [log for log in logs if log['action'] == 'AUCTION_RESULT']
for log in auction_logs[:2]:
    print(f"\n{log['node']} - {log['action']}:")
    print(f"  pCTR: {log.get('pCTR')}")
    print(f"  pCVR: {log.get('pCVR')}")
    print(f"  eCPM: {log.get('eCPM')}")
    print(f"  latency_ms: {log.get('latency_ms')}")
    print(f"  second_best_bid: {log.get('second_best_bid')}")
    print(f"  actual_paid_price: {log.get('actual_paid_price')}")
    print(f"  saved_amount: {log.get('saved_amount')}")

# 查找延迟超时记录
print("\n延迟超时记录:")
timeout_logs = [log for log in logs if log['reason_code'] == 'LATENCY_TIMEOUT']
for log in timeout_logs[:2]:
    print(f"\n延迟: {log.get('latency_ms')}ms")
    print(f"  潜在最高 eCPM 损失: {log['internal_variables'].get('max_potential_ecpm', 0):.4f}")


