"""
白盒化广告交易模拟工厂 - 主运行文件
运行此文件将模拟完整的广告竞价流程并生成 whitebox.log
"""
from engine import AdExchangeEngine
import uuid


def main():
    """主函数：运行广告竞价模拟"""
    print("=" * 60)
    print("白盒化广告交易模拟工厂 - Mintegral 风格")
    print("=" * 60)
    
    # 初始化引擎
    engine = AdExchangeEngine(log_file="whitebox.log")
    
    # 配置 ADX 过滤规则
    engine.setup_adx_filters(
        floor_price=0.1,  # 底价 0.1
        blacklist=['device_blacklist_001', 'app_blacklist_001'],  # 黑名单
        required_size=(320, 50)  # 要求尺寸 320x50
    )
    
    # 配置 DSP 出价策略
    engine.setup_dsp(base_price=0.5)  # 基础出价 0.5
    
    # 模拟多个广告请求
    test_cases = [
        {
            'device_id': 'device_001',
            'app_id': 'app_001',
            'app_name': '游戏应用A',
            'platform': 'iOS',
            'ad_size': (320, 50)
        },
        {
            'device_id': 'device_002',
            'app_id': 'app_002',
            'app_name': '社交应用B',
            'platform': 'Android',
            'ad_size': (320, 50)
        },
        {
            'device_id': 'device_blacklist_001',  # 黑名单设备
            'app_id': 'app_003',
            'app_name': '工具应用C',
            'platform': 'iOS',
            'ad_size': (320, 50)
        },
        {
            'device_id': 'device_003',
            'app_id': 'app_004',
            'app_name': '购物应用D',
            'platform': 'iOS',
            'ad_size': (300, 250)  # 尺寸不匹配
        },
        {
            'device_id': 'device_004',
            'app_id': 'app_005',
            'app_name': '新闻应用E',
            'platform': 'Android',
            'ad_size': (320, 50)
        }
    ]
    
    print("\n开始模拟广告竞价流程...\n")
    
    results = []
    for i, case in enumerate(test_cases, 1):
        request_id = f"req_{uuid.uuid4().hex[:8]}"
        print(f"[请求 {i}] {case['app_name']} - {case['platform']} - {case['ad_size']}")
        
        result = engine.run_auction(
            request_id=request_id,
            device_id=case['device_id'],
            app_id=case['app_id'],
            app_name=case['app_name'],
            platform=case['platform'],
            ad_size=case['ad_size']
        )
        
        results.append(result)
        status_icon = "✓" if result['status'] == 'ACCEPTED' else "✗"
        print(f"  结果: {status_icon} {result['status']} - {result['reason']}")
        if result.get('bid_price'):
            print(f"  出价: {result['bid_price']:.4f}")
        print()
    
    # 汇总结果
    print("=" * 60)
    print("竞价结果汇总:")
    print("=" * 60)
    accepted = sum(1 for r in results if r['status'] == 'ACCEPTED')
    rejected = len(results) - accepted
    print(f"总请求数: {len(results)}")
    print(f"通过: {accepted}")
    print(f"拒绝: {rejected}")
    print(f"\n白盒日志已保存到: whitebox.log")
    print("=" * 60)


if __name__ == "__main__":
    main()


