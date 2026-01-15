"""
白盒化广告交易数据协议定义
定义 WhiteboxTrace 类用于记录所有决策点的详细信息
"""
from dataclasses import dataclass, field, asdict
from typing import Dict, Optional
from datetime import datetime
import json


@dataclass
class WhiteboxTrace:
    """白盒追踪记录，记录每个决策点的完整信息"""
    request_id: str
    timestamp: str
    node: str  # SSP/ADX/DSP
    action: str  # 操作类型，如 REQUEST/BID/FILTER/DECISION
    decision: str  # PASS/REJECT
    reason_code: str  # 原因代码
    internal_variables: Dict = field(default_factory=dict)  # 内部变量快照
    reasoning: str = ""  # 推理过程说明
    # 新增字段（全部为 float 类型，允许为空）
    pCTR: Optional[float] = None  # 预估点击率
    pCVR: Optional[float] = None  # 预估转化率
    eCPM: Optional[float] = None  # 有效千次展示费用
    latency_ms: Optional[float] = None  # 处理耗时，毫秒
    second_best_bid: Optional[float] = None  # 第二高出价，用于二价结算
    actual_paid_price: Optional[float] = None  # 实际成交价
    saved_amount: Optional[float] = None  # 因二价机制节省的金额
    
    def to_dict(self) -> Dict:
        """转换为字典格式"""
        return asdict(self)
    
    def to_json(self) -> str:
        """转换为 JSON 字符串"""
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=2)
    
    def to_log_line(self) -> str:
        """转换为日志行格式（单行 JSON）"""
        return json.dumps(self.to_dict(), ensure_ascii=False)

