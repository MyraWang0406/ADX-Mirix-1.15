import json

with open('whitebox.log', 'r', encoding='utf-8') as f:
    logs = [json.loads(line) for line in f if line.strip()]

new_reasons = [log for log in logs if log['reason_code'] in ['LATENCY_TIMEOUT', 'CREATIVE_MISMATCH', 'FLOOR_PRICE_HIGH']]
print(f'新损耗原因记录数: {len(new_reasons)}')
for log in new_reasons[:5]:
    print(f"  {log['reason_code']}: {log['reasoning']}")

pctr_logs = [log for log in logs if 'pctr' in str(log.get('internal_variables', {}))]
print(f'\n包含 pCTR 的日志: {len(pctr_logs)}')
for log in pctr_logs[:3]:
    pctr = log['internal_variables'].get('pctr', 'N/A')
    print(f"  pCTR: {pctr}")

auction_logs = [log for log in logs if log['action'] == 'AUCTION_RESULT']
print(f'\n竞价结果记录: {len(auction_logs)}')
for log in auction_logs[:2]:
    print(f"  出价: {log['internal_variables'].get('winner_bid', 'N/A')}")
    print(f"  实际支付: {log['internal_variables'].get('actual_payment', 'N/A')}")
    print(f"  Bid Shading: {log['internal_variables'].get('bid_shading', 'N/A')}")


