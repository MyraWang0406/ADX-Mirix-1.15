import json

with open('whitebox.log', 'r', encoding='utf-8') as f:
    logs = [json.loads(line) for line in f if line.strip()]

# 查找竞价结果
auction_logs = [log for log in logs if log['action'] == 'AUCTION_RESULT']
if auction_logs:
    log = auction_logs[0]
    print('竞价结果验证:')
    print(f"  pCTR: {log.get('pCTR')}")
    print(f"  pCVR: {log.get('pCVR')}")
    print(f"  eCPM: {log.get('eCPM')}")
    print(f"  出价: {log['internal_variables'].get('winner_bid')}")
    print(f"  实际支付: {log.get('actual_paid_price')}")
    print(f"  节省: {log.get('saved_amount')}")
    print(f"  第二高出价: {log.get('second_best_bid')}")
    
    # 验证 eCPM 计算
    bid = log['internal_variables'].get('winner_bid')
    pctr = log.get('pCTR')
    pcvr = log.get('pCVR')
    ecpm = log.get('eCPM')
    ecpm_calc = bid * pctr * pcvr * 1000
    print(f"\neCPM 计算验证:")
    print(f"  {bid:.4f} * {pctr:.4f} * {pcvr:.4f} * 1000 = {ecpm_calc:.4f}")
    print(f"  记录的 eCPM: {ecpm:.4f}")
    print(f"  计算匹配: {'✓' if abs(ecpm_calc - ecpm) < 0.0001 else '✗'}")
    
    # 验证二价计费
    second_ecpm = log['internal_variables'].get('second_highest_ecpm', 0)
    actual_paid = log.get('actual_paid_price')
    if second_ecpm > 0:
        paid_calc = (second_ecpm / 1000 / pctr / pcvr) + 0.01
        print(f"\n二价计费验证:")
        print(f"  第二高 eCPM: {second_ecpm:.4f}")
        print(f"  计算支付价: (second_ecpm / 1000 / pCTR / pCVR) + 0.01 = {paid_calc:.4f}")
        print(f"  实际支付价: {actual_paid:.4f}")
        print(f"  计算匹配: {'✓' if abs(paid_calc - actual_paid) < 0.01 else '✗'}")


