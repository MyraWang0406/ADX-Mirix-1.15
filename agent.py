"""
AI 诊断 Agent (P7/P8 级别)
深度分析 whitebox.log，提供时序聚合分析和洞察能力
"""
import json
import os
from typing import Dict, List, Optional, Tuple, Set
from datetime import datetime, timedelta
from collections import Counter, defaultdict
from schemas import WhiteboxTrace


class DiagnosticAgent:
    """诊断 Agent 核心类"""
    
    def __init__(self, log_file: str = "whitebox.log"):
        self.log_file = log_file
    
    def read_logs(self, time_window_minutes: int = 5, max_logs: int = 1000) -> List[WhiteboxTrace]:
        """
        读取最近的日志记录（时序聚合）
        - time_window_minutes: 时间窗口（分钟），默认 5 分钟
        - max_logs: 最大日志条数，默认 1000 条
        """
        if not os.path.exists(self.log_file):
            return []
        
        with open(self.log_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # 计算时间阈值
        now = datetime.now()
        time_threshold = now - timedelta(minutes=time_window_minutes)
        
        logs = []
        # 从后往前读取，直到达到时间窗口或数量限制
        for line in reversed(lines):
            if len(logs) >= max_logs:
                break
                
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                timestamp_str = data.get('timestamp', '')
                
                # 解析时间戳
                try:
                    log_time = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    # 如果日志时间早于阈值，停止读取
                    if log_time < time_threshold:
                        break
                except:
                    # 如果时间解析失败，继续处理（可能是旧格式）
                    pass
                
                trace = WhiteboxTrace(
                    request_id=data.get('request_id', ''),
                    timestamp=timestamp_str,
                    node=data.get('node', ''),
                    action=data.get('action', ''),
                    decision=data.get('decision', ''),
                    reason_code=data.get('reason_code', ''),
                    internal_variables=data.get('internal_variables', {}),
                    reasoning=data.get('reasoning', ''),
                    pCTR=data.get('pCTR'),
                    pCVR=data.get('pCVR'),
                    eCPM=data.get('eCPM'),
                    latency_ms=data.get('latency_ms'),
                    second_best_bid=data.get('second_best_bid'),
                    actual_paid_price=data.get('actual_paid_price'),
                    saved_amount=data.get('saved_amount')
                )
                logs.append(trace)
            except Exception as e:
                print(f"Error parsing log line: {e}")
                continue
        
        # 按时间正序排列（最早的在前）
        logs.reverse()
        return logs
    
    def extract_region_from_log(self, log: WhiteboxTrace) -> str:
        """
        从日志中提取区域信息
        优先从 internal_variables 获取，否则从 app_id 推断或使用默认值
        """
        # 尝试从 internal_variables 获取 region
        region = log.internal_variables.get('region') or log.internal_variables.get('country')
        
        if not region:
            # 从 app_id 推断（假设 app_id 包含区域信息，如 app_brazil_001）
            app_id = log.internal_variables.get('app_id', '')
            app_name = log.internal_variables.get('app_name', '')
            
            # 简单的区域推断逻辑（可根据实际需求扩展）
            if 'brazil' in app_id.lower() or 'brazil' in app_name.lower():
                region = 'Brazil'
            elif 'china' in app_id.lower() or 'china' in app_name.lower():
                region = 'China'
            elif 'us' in app_id.lower() or 'usa' in app_id.lower():
                region = 'US'
            else:
                # 默认区域（可根据 device_id 或其他信息进一步推断）
                region = 'Unknown'
        
        return region
    
    def analyze_win_rate(self, logs: List[WhiteboxTrace]) -> Tuple[float, Dict]:
        """分析中标率"""
        request_ids = set()
        win_ids = set()
        
        for log in logs:
            request_ids.add(log.request_id)
            # 优先检查竞价结果
            if log.action == 'AUCTION_RESULT' or \
               (log.node == 'ADX' and log.action == 'FINAL_DECISION' and log.decision == 'PASS'):
                win_ids.add(log.request_id)
        
        total_requests = len(request_ids)
        win_count = len(win_ids)
        win_rate = (win_count / total_requests * 100) if total_requests > 0 else 0
        
        return win_rate, {
            'total_requests': total_requests,
            'win_count': win_count,
            'win_rate': win_rate
        }
    
    def aggregate_by_region_app(self, logs: List[WhiteboxTrace]) -> Dict[str, Dict]:
        """
        按 [Region + App_ID] 组合聚合统计
        返回: { 'Region_AppID': { 'win_rate': ..., 'timeout_rate': ..., 'total_requests': ... } }
        """
        # 按 request_id 分组
        request_map: Dict[str, List[WhiteboxTrace]] = defaultdict(list)
        for log in logs:
            request_map[log.request_id].append(log)
        
        # 按 Region + App_ID 聚合
        region_app_stats: Dict[str, Dict] = defaultdict(lambda: {
            'total_requests': 0,
            'win_count': 0,
            'timeout_count': 0,
            'total_ecpm': 0.0,
            'win_ecpm': 0.0,
            'rejected_potential_ecpm': 0.0,
            'request_ids': set()
        })
        
        for request_id, traces in request_map.items():
            # 提取区域和应用ID
            ssp_log = next((t for t in traces if t.node == 'SSP'), None)
            if not ssp_log:
                continue
            
            region = self.extract_region_from_log(ssp_log)
            app_id = ssp_log.internal_variables.get('app_id', 'Unknown')
            key = f"{region}_{app_id}"
            
            stats = region_app_stats[key]
            stats['request_ids'].add(request_id)
            stats['total_requests'] += 1
            
            # 检查是否中标
            auction_result = next((t for t in traces if t.action == 'AUCTION_RESULT'), None)
            if auction_result:
                stats['win_count'] += 1
                if auction_result.eCPM:
                    stats['win_ecpm'] += auction_result.eCPM
            
            # 检查是否超时
            timeout_log = next((t for t in traces if t.reason_code == 'LATENCY_TIMEOUT'), None)
            if timeout_log:
                stats['timeout_count'] += 1
                # 计算潜在 eCPM 损失
                potential_ecpm = timeout_log.internal_variables.get('highest_potential_ecpm_loss') or \
                                timeout_log.internal_variables.get('max_potential_ecpm') or 0
                stats['rejected_potential_ecpm'] += potential_ecpm
            
            # 累计总 eCPM（从所有相关日志）
            for trace in traces:
                if trace.eCPM:
                    stats['total_ecpm'] += trace.eCPM
        
        # 计算比率
        result = {}
        for key, stats in region_app_stats.items():
            total = stats['total_requests']
            win_rate = (stats['win_count'] / total * 100) if total > 0 else 0
            timeout_rate = (stats['timeout_count'] / total * 100) if total > 0 else 0
            avg_ecpm = stats['total_ecpm'] / total if total > 0 else 0
            win_avg_ecpm = stats['win_ecpm'] / stats['win_count'] if stats['win_count'] > 0 else 0
            
            result[key] = {
                'region': key.split('_')[0],
                'app_id': '_'.join(key.split('_')[1:]) if '_' in key else 'Unknown',
                'total_requests': total,
                'win_count': stats['win_count'],
                'win_rate': win_rate,
                'timeout_count': stats['timeout_count'],
                'timeout_rate': timeout_rate,
                'avg_ecpm': avg_ecpm,
                'win_avg_ecpm': win_avg_ecpm,
                'rejected_potential_ecpm': stats['rejected_potential_ecpm'],
                'request_ids': list(stats['request_ids'])
            }
        
        return result
    
    def analyze_reject_reasons(self, logs: List[WhiteboxTrace]) -> Dict:
        """分析拒绝原因分布"""
        reject_logs = [
            log for log in logs 
            if log.decision == 'REJECT' and log.reason_code
        ]
        
        reason_counter = Counter(log.reason_code for log in reject_logs)
        total_rejects = len(reject_logs)
        
        reason_distribution = {}
        for reason, count in reason_counter.items():
            percentage = (count / total_rejects * 100) if total_rejects > 0 else 0
            reason_distribution[reason] = {
                'count': count,
                'percentage': percentage
            }
        
        return {
            'total_rejects': total_rejects,
            'distribution': reason_distribution
        }
    
    def detect_anomalies(self, logs: List[WhiteboxTrace], region_app_stats: Dict[str, Dict]) -> List[Dict]:
        """
        检测异常情况（增强版：包含 P7/P8 级别商业逻辑诊断）
        """
        anomalies = []
        
        # 1. P7 视角：损耗折算 (Loss Valuation)
        anomalies.extend(self._calculate_roi_loss(logs))
        
        # 2. P8 视角：生态平衡与竞争力诊断
        anomalies.extend(self._detect_high_bid_low_win_rate(logs))
        
        # 2.5. 流量质量风险检测：因 q_factor 过低而落榜
        anomalies.extend(self._detect_quality_factor_penalty(logs))
        
        # 2.6. SKAN 隐私环境检测
        anomalies.extend(self._detect_skan_environment(logs))
        
        # 3. 突发异常检测：链路波动预警
        anomalies.extend(self._detect_link_fluctuation(logs, region_app_stats))
        
        # 4. 出价竞争力分析
        anomalies.extend(self._detect_competitiveness_issue(region_app_stats))
        
        # 5. 传统异常检测（保留原有逻辑）
        win_rate, win_stats = self.analyze_win_rate(logs)
        if win_rate < 10 and win_stats['total_requests'] >= 10:
            anomalies.append({
                'type': 'LOW_WIN_RATE',
                'severity': 'high',
                'title': '竞争激烈',
                'description': f'中标率仅为 {win_rate:.2f}%，低于 10% 阈值',
                'details': win_stats,
                'suggestion': '建议优化出价策略或调整底价设置'
            })
        
        reject_analysis = self.analyze_reject_reasons(logs)
        size_mismatch_pct = reject_analysis['distribution'].get('SIZE_MISMATCH', {}).get('percentage', 0)
        if size_mismatch_pct > 30:
            anomalies.append({
                'type': 'SIZE_MISMATCH_HIGH',
                'severity': 'medium',
                'title': '素材问题',
                'description': f'尺寸不匹配占比 {size_mismatch_pct:.2f}%，超过 30% 阈值',
                'details': reject_analysis,
                'suggestion': '建议检查广告素材尺寸配置，确保与需求匹配'
            })
        
        return anomalies
    
    def _detect_link_fluctuation(self, logs: List[WhiteboxTrace], region_app_stats: Dict[str, Dict]) -> List[Dict]:
        """
        检测链路波动：某个区域超时率比过去5分钟均值高30%
        增强版：P8 级别地域性波动洞察
        """
        anomalies = []
        
        if not logs:
            return anomalies
        
        # 按区域统计超时率
        region_timeout_stats = defaultdict(lambda: {'timeout': 0, 'total': 0, 'avg_latency': [], 'potential_loss': 0.0})
        
        for log in logs:
            region = self.extract_region_from_log(log)
            region_timeout_stats[region]['total'] += 1
            if log.reason_code == 'LATENCY_TIMEOUT':
                region_timeout_stats[region]['timeout'] += 1
                if log.latency_ms:
                    region_timeout_stats[region]['avg_latency'].append(log.latency_ms)
                # 计算潜在损失
                potential_ecpm = log.internal_variables.get('highest_potential_ecpm_loss', 0) or \
                                log.internal_variables.get('max_potential_ecpm', 0) or 0
                if potential_ecpm == 0 and log.eCPM:
                    potential_ecpm = log.eCPM
                region_timeout_stats[region]['potential_loss'] += potential_ecpm
        
        # 计算各区域超时率和平均延迟
        region_rates = {}
        for region, stats in region_timeout_stats.items():
            if stats['total'] < 5:  # 样本太少
                continue
            timeout_rate = (stats['timeout'] / stats['total'] * 100) if stats['total'] > 0 else 0
            avg_latency = sum(stats['avg_latency']) / len(stats['avg_latency']) if stats['avg_latency'] else 0
            region_rates[region] = {
                'timeout_rate': timeout_rate,
                'avg_latency': avg_latency,
                'total_requests': stats['total'],
                'timeout_count': stats['timeout'],
                'potential_loss': stats['potential_loss']
            }
        
        if not region_rates:
            return anomalies
        
        # 找出超时率最高的区域
        sorted_regions = sorted(region_rates.items(), key=lambda x: x[1]['timeout_rate'], reverse=True)
        highest_region, highest_stats = sorted_regions[0]
        
        # 计算其他区域的平均超时率
        other_regions = [r[1]['timeout_rate'] for r in sorted_regions[1:]]
        avg_other_rate = sum(other_regions) / len(other_regions) if other_regions else 0
        
        # 如果最高区域超时率显著高于其他区域（>30% 或绝对值 >15%）
        if highest_stats['timeout_rate'] > avg_other_rate * 1.3 or \
           (highest_stats['timeout_rate'] > 15 and avg_other_rate < 5):
            
            # 计算漏斗折损率（超时导致的有效请求损失）
            funnel_loss_rate = (highest_stats['timeout_count'] / highest_stats['total_requests'] * 100) if highest_stats['total_requests'] > 0 else 0
            
            # 计算经济损失
            hourly_loss = highest_stats['potential_loss'] * 12  # 5分钟 * 12 = 1小时
            
            # 判断延迟是否异常（>120ms）
            latency_abnormal = highest_stats['avg_latency'] > 120 if highest_stats['avg_latency'] > 0 else False
            
            anomalies.append({
                'type': 'LINK_FLUCTUATION',
                'severity': 'high',
                'insight_level': 'P8',  # P8 级别洞察
                'title': f'【P8 洞察】{highest_region} 地区链路响应延迟异常',
                'description': f'{highest_region} 地区链路响应延迟异常（平均 {highest_stats["avg_latency"]:.0f}ms），超时率 {highest_stats["timeout_rate"]:.1f}%，显著高于其他地区平均 {avg_other_rate:.1f}%，导致竞价漏斗顶端折损 {funnel_loss_rate:.1f}%',
                'details': {
                    'region': highest_region,
                    'timeout_rate': highest_stats['timeout_rate'],
                    'avg_other_timeout_rate': avg_other_rate,
                    'avg_latency': highest_stats['avg_latency'],
                    'timeout_count': highest_stats['timeout_count'],
                    'total_requests': highest_stats['total_requests'],
                    'funnel_loss_rate': funnel_loss_rate,
                    'potential_loss_5min': highest_stats['potential_loss'],
                    'estimated_hourly_loss': hourly_loss,
                    'latency_abnormal': latency_abnormal
                },
                'suggestion': f'【P8 级决策建议】{highest_region} 地区链路响应延迟异常（{highest_stats["avg_latency"]:.0f}ms+），导致竞价漏斗顶端折损 {funnel_loss_rate:.1f}%，预计每小时损失 ${hourly_loss:.2f}。建议调整中继服务器策略，切换备用 CDN 节点或将该地区超时阈值动态调整至 150ms。'
            })
        
        return anomalies
    
    def _detect_competitiveness_issue(self, region_app_stats: Dict[str, Dict]) -> List[Dict]:
        """
        检测出价竞争力缺失：Win Rate < 5% 且平均 eCPM 远低于中标价
        增强版：P7 级别竞争力诊断，分析 pCTR 模型预估偏差
        """
        anomalies = []
        
        # 计算行业平均 pCTR（从所有中标请求中）
        all_logs = self.read_logs(time_window_minutes=5, max_logs=1000)
        winning_logs = [log for log in all_logs if log.action == 'AUCTION_RESULT' or 
                       (log.node == 'ADX' and log.action == 'FINAL_DECISION' and log.decision == 'PASS')]
        
        industry_pctrs = [log.pCTR for log in winning_logs if log.pCTR and log.pCTR > 0]
        industry_avg_pctr = (sum(industry_pctrs) / len(industry_pctrs) * 100) if industry_pctrs else 1.2  # 默认1.2%
        
        for key, stats in region_app_stats.items():
            if stats['total_requests'] < 10:  # 样本太少
                continue
            
            win_rate = stats['win_rate']
            avg_ecpm = stats['avg_ecpm']
            win_avg_ecpm = stats['win_avg_ecpm']
            
            # 获取该区域/应用的出价日志，计算平均 pCTR
            region = stats['region']
            app_id = stats['app_id']
            region_app_logs = [log for log in all_logs 
                             if self.extract_region_from_log(log) == region and
                             log.internal_variables.get('app_id') == app_id]
            
            bid_logs = [log for log in region_app_logs 
                        if log.action in ['BID_CALCULATION', 'BID_SUBMITTED']]
            
            avg_pctr = 0.0
            avg_bid = 0.0
            if bid_logs:
                pctrs = [log.pCTR for log in bid_logs if log.pCTR and log.pCTR > 0]
                bids = [log.internal_variables.get('final_bid') or log.internal_variables.get('bid_price', 0) 
                       for log in bid_logs]
                avg_pctr = (sum(pctrs) / len(pctrs) * 100) if pctrs else 0
                avg_bid = sum(bids) / len(bids) if bids else 0
            
            # Win Rate < 5% 且平均 eCPM 远低于中标平均 eCPM（差距>30%）
            if win_rate < 5 and win_avg_ecpm > 0:
                ecpm_gap = ((win_avg_ecpm - avg_ecpm) / win_avg_ecpm * 100) if win_avg_ecpm > 0 else 0
                
                # 判断是否为 pCTR 模型预估偏低导致
                pctr_low = avg_pctr > 0 and avg_pctr < industry_avg_pctr * 0.6  # 低于行业均值60%
                bid_competitive = avg_bid > 0 and avg_bid >= 0.5  # 出价具备竞争力（>=0.5）
                
                if ecpm_gap > 30:  # 平均 eCPM 比中标平均低30%以上
                    # P7 洞察：出价高但 Win Rate 低，可能是 pCTR 预估偏低
                    if bid_competitive and pctr_low:
                        anomalies.append({
                            'type': 'COMPETITIVENESS_MISSING',
                            'severity': 'high',
                            'insight_level': 'P7',  # P7 级别洞察
                            'title': f'【P7 洞察】{region} 地区 {app_id} 应用竞争力诊断',
                            'description': f'广告主出价具备竞争力（平均 ${avg_bid:.2f}），但 pCTR 模型预估偏低（当前 {avg_pctr:.2f}%，行业均值 {industry_avg_pctr:.2f}%），导致 eCPM 排序靠后，Win Rate 仅 {win_rate:.2f}%',
                            'details': {
                                'region': region,
                                'app_id': app_id,
                                'win_rate': win_rate,
                                'avg_ecpm': avg_ecpm,
                                'win_avg_ecpm': win_avg_ecpm,
                                'ecpm_gap_percentage': ecpm_gap,
                                'avg_bid': avg_bid,
                                'avg_pctr': avg_pctr,
                                'industry_avg_pctr': industry_avg_pctr,
                                'pctr_gap_percentage': ((industry_avg_pctr - avg_pctr) / industry_avg_pctr * 100) if industry_avg_pctr > 0 else 0
                            },
                            'suggestion': f'【P7 级决策建议】建议优化素材创意以提升点击率。当前 pCTR 预估 {avg_pctr:.2f}% 低于行业均值 {industry_avg_pctr:.2f}%，导致 eCPM 排序靠后。建议：1) 优化广告素材创意，提升实际点击率；2) 调整 pCTR 模型参数，提高该应用的 CTR 得分；3) 针对该应用增加时段加成或地域加成。'
                        })
                    else:
                        # 传统竞争力缺失
                        anomalies.append({
                            'type': 'COMPETITIVENESS_MISSING',
                            'severity': 'high',
                            'title': '竞争力缺失',
                            'description': f'{region} 地区 {app_id} 应用 Win Rate 仅 {win_rate:.2f}%，且平均 eCPM ({avg_ecpm:.4f}) 远低于中标平均 ({win_avg_ecpm:.4f})，差距 {ecpm_gap:.1f}%',
                            'details': {
                                'region': region,
                                'app_id': app_id,
                                'win_rate': win_rate,
                                'avg_ecpm': avg_ecpm,
                                'win_avg_ecpm': win_avg_ecpm,
                                'ecpm_gap_percentage': ecpm_gap
                            },
                            'suggestion': f'建议针对 {region} 地区 {app_id} 应用优化出价策略，提升基础出价或调整 CTR 乘数，以提高竞争力。'
                        })
        
        return anomalies
    
    def _calculate_roi_loss(self, logs: List[WhiteboxTrace]) -> List[Dict]:
        """
        P7 视角：损耗折算 (Loss Valuation)
        遍历最近 500 条日志，识别所有 decision="REJECTED" 且 reason_code="LATENCY_TIMEOUT" 的请求
        应用公式：Potential_Loss = Sum(Rejected_eCPM × 1000 / Request_Count)
        """
        # 限制为最近 500 条日志
        recent_logs = logs[-500:] if len(logs) > 500 else logs
        
        # 按 request_id 分组
        request_map: Dict[str, List[WhiteboxTrace]] = defaultdict(list)
        for log in recent_logs:
            request_map[log.request_id].append(log)
        
        # 按地区统计延迟超时损失
        region_loss_map: Dict[str, Dict] = defaultdict(lambda: {
            'rejected_count': 0,
            'total_potential_ecpm': 0.0,
            'request_ids': set()
        })
        
        total_requests = len(request_map)
        
        for request_id, traces in request_map.items():
            # 检查是否为延迟超时拒绝
            timeout_reject = any(
                t.decision == 'REJECT' and t.reason_code == 'LATENCY_TIMEOUT' 
                for t in traces
            )
            
            if not timeout_reject:
                continue
            
            # 提取地区
            ssp_log = next((t for t in traces if t.node == 'SSP'), None)
            region = self.extract_region_from_log(ssp_log) if ssp_log else 'Unknown'
            
            # 计算潜在 eCPM 损失
            potential_ecpm = 0.0
            
            # 1. 优先从延迟超时日志获取
            for trace in traces:
                if trace.reason_code == 'LATENCY_TIMEOUT':
                    potential_ecpm = max(
                        potential_ecpm,
                        trace.internal_variables.get('highest_potential_ecpm_loss', 0) or
                        trace.internal_variables.get('max_potential_ecpm', 0) or 0
                    )
            
            # 2. 如果没有，从出价日志计算 eCPM
            if potential_ecpm == 0:
                for trace in traces:
                    if trace.action in ['BID_CALCULATION', 'BID_SUBMITTED']:
                        bid_price = trace.internal_variables.get('final_bid') or trace.internal_variables.get('bid_price') or 0
                        pctr = trace.pCTR or trace.internal_variables.get('pctr') or 0
                        pcvr = trace.pCVR or trace.internal_variables.get('pcvr') or 0
                        if bid_price and pctr and pcvr:
                            calculated_ecpm = bid_price * pctr * pcvr * 1000
                            potential_ecpm = max(potential_ecpm, calculated_ecpm)
                    elif trace.eCPM:
                        potential_ecpm = max(potential_ecpm, trace.eCPM)
            
            # 3. 如果还是没有，使用默认值（基于平均 eCPM）
            if potential_ecpm == 0:
                all_ecpms = [t.eCPM for t in recent_logs if t.eCPM and t.eCPM > 0]
                if all_ecpms:
                    avg_ecpm = sum(all_ecpms) / len(all_ecpms)
                    potential_ecpm = avg_ecpm * 0.5  # 保守估计为平均值的50%
            
            if potential_ecpm > 0:
                # 应用公式：Rejected_eCPM × 1000 / Request_Count
                normalized_loss = (potential_ecpm * 1000) / total_requests if total_requests > 0 else 0
                
                region_loss_map[region]['rejected_count'] += 1
                region_loss_map[region]['total_potential_ecpm'] += normalized_loss
                region_loss_map[region]['request_ids'].add(request_id)
        
        anomalies = []
        
        # 为每个地区生成 P7 损耗预警
        for region, loss_data in region_loss_map.items():
            if loss_data['rejected_count'] > 0:
                total_loss = loss_data['total_potential_ecpm']
                hourly_loss = total_loss * 12  # 假设是5分钟窗口
                
                anomalies.append({
                    'type': 'P7_LOSS_VALUATION',
                    'severity': 'high',
                    'insight_level': 'P7',
                    'title': f'【P7 损耗预警】{region} 因延迟波动导致潜在收入流失',
                    'description': f'{region} 地区因延迟波动导致 {loss_data["rejected_count"]} 个请求被拒绝，潜在收入流失 ${total_loss:.2f}',
                    'details': {
                        'region': region,
                        'rejected_count': loss_data['rejected_count'],
                        'total_potential_loss': total_loss,
                        'estimated_hourly_loss': hourly_loss,
                        'request_ids': list(loss_data['request_ids'])[:10]
                    },
                    'suggestion': f'【P7 损耗预警】{region} 因延迟波动导致潜在收入流失 ${total_loss:.2f}，预计每小时损失 ${hourly_loss:.2f}。建议优化该地区网络链路或调整超时阈值。'
                })
        
        return anomalies
    
    def _detect_high_bid_low_win_rate(self, logs: List[WhiteboxTrace]) -> List[Dict]:
        """
        P8 视角：生态平衡与竞争力诊断
        识别"高价落榜"案例：Bid > Avg_Winning_Bid × 1.2 且 Win_Rate < 5%
        归因分析：如果出现，输出关于 pCTR 低于大盘均值的建议
        """
        anomalies = []
        
        # 计算平均中标价
        winning_bids = []
        for log in logs:
            if log.action == 'AUCTION_RESULT' or \
               (log.node == 'ADX' and log.action == 'FINAL_DECISION' and log.decision == 'PASS'):
                # 获取中标价
                winner_bid = log.internal_variables.get('winner_bid') or \
                           log.internal_variables.get('final_bid') or \
                           log.internal_variables.get('bid_price') or 0
                if winner_bid > 0:
                    winning_bids.append(winner_bid)
        
        if not winning_bids:
            return anomalies
        
        avg_winning_bid = sum(winning_bids) / len(winning_bids)
        threshold_bid = avg_winning_bid * 1.2
        
        # 按 request_id 分组，分析每个广告主的出价和胜率
        request_map: Dict[str, List[WhiteboxTrace]] = defaultdict(list)
        for log in logs:
            request_map[log.request_id].append(log)
        
        # 按广告主（从 app_id 或 client_id 推断）聚合
        advertiser_stats: Dict[str, Dict] = defaultdict(lambda: {
            'total_bids': 0,
            'win_count': 0,
            'high_bids': [],  # 高于阈值的出价
            'all_bids': [],
            'pctrs': [],
            'request_ids': set()
        })
        
        for request_id, traces in request_map.items():
            # 提取广告主标识（使用 app_id 作为代理）
            ssp_log = next((t for t in traces if t.node == 'SSP'), None)
            if not ssp_log:
                continue
            
            advertiser_id = ssp_log.internal_variables.get('app_id') or \
                          ssp_log.internal_variables.get('client_id') or \
                          'Unknown'
            
            # 查找出价日志
            bid_log = next((t for t in traces 
                          if t.action in ['BID_CALCULATION', 'BID_SUBMITTED']), None)
            
            if not bid_log:
                continue
            
            bid_price = bid_log.internal_variables.get('final_bid') or \
                       bid_log.internal_variables.get('bid_price') or 0
            pctr = bid_log.pCTR or bid_log.internal_variables.get('pctr') or 0
            
            if bid_price > 0:
                advertiser_stats[advertiser_id]['total_bids'] += 1
                advertiser_stats[advertiser_id]['all_bids'].append(bid_price)
                advertiser_stats[advertiser_id]['request_ids'].add(request_id)
                
                if pctr > 0:
                    advertiser_stats[advertiser_id]['pctrs'].append(pctr)
                
                # 检查是否为高价出价
                if bid_price > threshold_bid:
                    advertiser_stats[advertiser_id]['high_bids'].append(bid_price)
            
            # 检查是否中标
            if any(t.action == 'AUCTION_RESULT' or 
                  (t.node == 'ADX' and t.action == 'FINAL_DECISION' and t.decision == 'PASS')
                  for t in traces):
                advertiser_stats[advertiser_id]['win_count'] += 1
        
        # 计算大盘平均 pCTR
        all_pctrs = [log.pCTR for log in logs if log.pCTR and log.pCTR > 0]
        market_avg_pctr = (sum(all_pctrs) / len(all_pctrs) * 100) if all_pctrs else 1.2  # 默认1.2%
        
        # 检测高价落榜案例
        for advertiser_id, stats in advertiser_stats.items():
            if stats['total_bids'] < 10:  # 样本太少
                continue
            
            win_rate = (stats['win_count'] / stats['total_bids'] * 100) if stats['total_bids'] > 0 else 0
            
            # 高价落榜条件：有高价出价 且 Win Rate < 5%
            if len(stats['high_bids']) > 0 and win_rate < 5:
                avg_bid = sum(stats['all_bids']) / len(stats['all_bids']) if stats['all_bids'] else 0
                avg_pctr = (sum(stats['pctrs']) / len(stats['pctrs']) * 100) if stats['pctrs'] else 0
                
                # 判断 pCTR 是否低于大盘均值
                pctr_below_market = avg_pctr > 0 and avg_pctr < market_avg_pctr * 0.8  # 低于大盘80%
                
                if pctr_below_market:
                    anomalies.append({
                        'type': 'P8_HIGH_BID_LOW_WIN_RATE',
                        'severity': 'high',
                        'insight_level': 'P8',
                        'title': f'【P8 策略建议】{advertiser_id} 高价低胜率现象诊断',
                        'description': f'检测到 {advertiser_id} 出价高于平均中标价 20% 以上（平均出价 ${avg_bid:.2f}，平均中标价 ${avg_winning_bid:.2f}），但 Win Rate 仅 {win_rate:.2f}%',
                        'details': {
                            'advertiser_id': advertiser_id,
                            'avg_bid': avg_bid,
                            'avg_winning_bid': avg_winning_bid,
                            'win_rate': win_rate,
                            'total_bids': stats['total_bids'],
                            'win_count': stats['win_count'],
                            'high_bid_count': len(stats['high_bids']),
                            'avg_pctr': avg_pctr,
                            'market_avg_pctr': market_avg_pctr,
                            'pctr_gap_percentage': ((market_avg_pctr - avg_pctr) / market_avg_pctr * 100) if market_avg_pctr > 0 else 0
                        },
                        'suggestion': f'【P8 策略建议】检测到高价低胜率现象。主因并非出价不足，而是 pCTR (预估点击率) 远低于大盘均值（当前 {avg_pctr:.2f}%，大盘均值 {market_avg_pctr:.2f}%）。建议引导广告主优化素材关键词或进行 A/B Test 以提升质量分。'
                    })
        
        return anomalies
    
    def get_error_logs(self, logs: List[WhiteboxTrace], limit: int = 100) -> List[Dict]:
        """获取最近的错误日志"""
        error_logs = [
            log for log in logs 
            if log.decision == 'REJECT'
        ]
        
        # 转换为字典格式
        error_dicts = []
        for log in error_logs[:limit]:
            error_dicts.append({
                'request_id': log.request_id,
                'timestamp': log.timestamp,
                'node': log.node,
                'action': log.action,
                'reason_code': log.reason_code,
                'reasoning': log.reasoning,
                'internal_variables': log.internal_variables
            })
        
        return error_dicts
    
    def generate_llm_prompt(self, error_logs: List[Dict], anomalies: List[Dict], 
                           region_app_stats: Dict[str, Dict]) -> str:
        """生成 LLM 提示词（增强版：包含时序分析和洞察）"""
        prompt = f"""你是一个广告交易系统的资深算法策略专家（P7/P8级别）。请基于以下深度分析结果，提供结构化的专家建议。

## 时序聚合分析结果：
"""
        # 添加区域-应用统计摘要
        if region_app_stats:
            prompt += "### 区域-应用维度统计（Top 5）：\n"
            sorted_stats = sorted(region_app_stats.items(), 
                                key=lambda x: x[1]['total_requests'], reverse=True)[:5]
            for key, stats in sorted_stats:
                prompt += f"- {stats['region']} + {stats['app_id']}: Win Rate {stats['win_rate']:.2f}%, Timeout Rate {stats['timeout_rate']:.2f}%, 平均 eCPM ${stats['avg_ecpm']:.4f}\n"
        
        prompt += f"""
## 异常检测结果（深度洞察）：
"""
        for anomaly in anomalies:
            prompt += f"""
### {anomaly['title']} ({anomaly['type']})
- 描述: {anomaly['description']}
- 严重程度: {anomaly['severity']}
- 详情: {json.dumps(anomaly.get('details', {}), ensure_ascii=False, indent=2)}
- 初步建议: {anomaly.get('suggestion', '')}
"""
        
        prompt += f"""
## 最近错误日志（共 {len(error_logs)} 条，示例前20条）：
"""
        for i, log in enumerate(error_logs[:20], 1):
            prompt += f"""
{i}. Request ID: {log['request_id']}
   - 节点: {log['node']}
   - 操作: {log['action']}
   - 原因代码: {log['reason_code']}
   - 说明: {log['reasoning']}
"""
        
        prompt += """
## 请提供结构化的专家建议（必须包含以下四个部分）：

【现象总结】
简要描述检测到的主要问题和异常现象，包括时间、区域、影响范围等关键信息。

【根因推测】
基于数据分析，推测可能导致问题的根本原因（如：CDN节点不稳、出价策略不当、网络延迟等）。

【经济损失评估】
量化评估当前问题导致的潜在经济损失，包括：
- 当前窗口损失金额
- 预计每小时/每天损失
- 影响范围和规模

【建议操作】
提供3-5条具体的、可执行的、优先级明确的建议，格式为：
1. 建议：XXX（优先级：高/中/低）
2. 建议：XXX（优先级：高/中/低）
...

请用中文回答，确保建议具有可操作性。
"""
        return prompt
    
    def call_llm_api(self, prompt: str, api_key: Optional[str] = None) -> Dict:
        """
        调用 LLM API (GPT-4o)
        如果未提供 API Key 或库未安装，返回模拟响应
        """
        api_key = api_key or os.getenv('OPENAI_API_KEY')
        
        if not api_key:
            # 返回模拟响应（用于演示）
            return self._generate_mock_response(prompt)
        
        try:
            # 尝试导入 openai 库
            try:
                import openai
            except ImportError:
                print("Warning: openai library not installed, using mock response")
                return self._generate_mock_response(prompt)
            
            # 使用 OpenAI API
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "你是一个专业的广告交易系统分析师，擅长分析日志并提供可操作的建议。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=1000
            )
            
            content = response.choices[0].message.content
            
            # 解析响应
            return self._parse_llm_response(content)
        except Exception as e:
            print(f"Error calling LLM API: {e}")
            return self._generate_mock_response(prompt)
    
    def _generate_mock_response(self, prompt: str) -> Dict:
        """生成模拟响应（当没有 API Key 时）- 增强版结构化格式"""
        # 基于 prompt 内容生成智能模拟响应
        if '链路波动' in prompt or 'LINK_FLUCTUATION' in prompt:
            return {
                'summary': '检测到巴西地区流量在最近时段超时率从 2% 飙升至 28%，增幅 1300%，预计导致每小时 $500 收入流失。',
                'root_cause': '推测为 CDN 节点不稳定或网络链路波动，导致请求处理延迟超过阈值。',
                'economic_impact': '当前5分钟窗口潜在损失约 $41.67，预计每小时损失 $500，每天损失约 $12,000。',
                'suggestions': [
                    '建议：切换巴西地区备用中继服务器（优先级：高）',
                    '建议：将该地区超时阈值动态调整至 150ms（优先级：高）',
                    '建议：检查 CDN 节点健康状态，必要时切换节点（优先级：中）',
                    '建议：增加该地区请求的优先级队列，优先处理（优先级：中）'
                ],
                'priority': '高'
            }
        elif '竞争力缺失' in prompt or 'COMPETITIVENESS_MISSING' in prompt:
            return {
                'summary': '检测到某大客户 Win Rate 持续低于 5%，且平均 eCPM 远低于中标平均，存在竞争力缺失问题。',
                'root_cause': '推测为出价策略过于保守，基础出价或 CTR 乘数设置不当，导致在竞价中处于劣势。',
                'economic_impact': '当前客户平均 eCPM 比中标平均低 35%，预计每小时损失约 $200 的潜在收入。',
                'suggestions': [
                    '建议：针对该客户提升基础出价 20%（优先级：高）',
                    '建议：优化 CTR 模型参数，提高该客户 CTR 得分（优先级：高）',
                    '建议：在黄金时段为该客户增加时段加成（优先级：中）',
                    '建议：分析竞争对手出价策略，调整出价区间（优先级：中）'
                ],
                'priority': '高'
            }
        elif 'ROI' in prompt or '损失预估' in prompt:
            return {
                'summary': '检测到被拒绝请求的潜在 eCPM 损失累计为 $125.50，预计每小时损失 $1,506。',
                'root_cause': '主要损失来源为延迟超时和出价低于底价，需要优化延迟处理和出价策略。',
                'economic_impact': '当前5分钟窗口损失 $125.50，预计每小时损失 $1,506，每天损失约 $36,144。',
                'suggestions': [
                    '建议：优先处理延迟超时问题，优化网络链路（优先级：高）',
                    '建议：调整底价策略，平衡流量质量和数量（优先级：高）',
                    '建议：优化出价算法，提高竞争力（优先级：中）',
                    '建议：增加请求重试机制，降低超时率（优先级：中）'
                ],
                'priority': '高'
            }
        elif '竞争激烈' in prompt or 'LOW_WIN_RATE' in prompt:
            return {
                'summary': '系统检测到中标率偏低，竞争激烈。主要原因是出价策略需要优化。',
                'root_cause': '推测为出价策略过于保守，或竞争对手出价更高，导致中标率下降。',
                'economic_impact': '当前中标率仅 8%，低于正常水平，预计每小时损失约 $300 的潜在收入。',
                'suggestions': [
                    '建议：将基础出价从 0.5 提升至 0.6，提高竞争力（优先级：高）',
                    '建议：针对 iOS 平台增加 1.3x 乘数（当前为 1.2x）（优先级：中）',
                    '建议：在黄金时段（9-11点，19-22点）增加 1.2x 时段加成（优先级：中）',
                    '建议：优化 CTR 模型，提高 CTR 得分估算准确性（优先级：低）'
                ],
                'priority': '高'
            }
        elif '尺寸不匹配' in prompt or 'SIZE_MISMATCH' in prompt:
            return {
                'summary': '检测到大量尺寸不匹配问题，影响广告投放效果。',
                'root_cause': '推测为广告素材库中尺寸配置不统一，或 SSP 请求的尺寸与需求不匹配。',
                'economic_impact': '尺寸不匹配导致约 35% 的请求被拒绝，预计每小时损失约 $150。',
                'suggestions': [
                    '建议：检查所有广告素材尺寸，确保与需求尺寸 320×50 匹配（优先级：高）',
                    '建议：在 SSP 请求阶段增加尺寸预检查，提前过滤不匹配请求（优先级：中）',
                    '建议：考虑支持多尺寸适配，增加 300×250 等常用尺寸（优先级：中）',
                    '建议：更新素材库，统一使用标准尺寸 320×50（优先级：低）'
                ],
                'priority': '中'
            }
        else:
            return {
                'summary': '系统运行正常，检测到少量异常。建议持续监控。',
                'root_cause': '当前异常属于正常波动范围，无需立即处理。',
                'economic_impact': '当前损失在可接受范围内，预计每小时损失约 $50。',
                'suggestions': [
                    '建议：定期检查白盒日志，关注异常趋势（优先级：低）',
                    '建议：优化过滤规则，平衡流量质量和数量（优先级：低）',
                    '建议：持续优化出价策略，提高中标率（优先级：低）'
                ],
                'priority': '低'
            }
    
    def _parse_llm_response(self, content: str) -> Dict:
        """解析 LLM 响应（增强版：支持结构化专家建议格式）"""
        summary = ""
        root_cause = ""
        economic_impact = ""
        suggestions = []
        priority = "中"
        
        # 提取现象总结
        if "【现象总结】" in content:
            start = content.index("【现象总结】") + len("【现象总结】")
            end = content.find("【", start)
            summary = content[start:end].strip() if end > 0 else content[start:].strip()
        
        # 提取根因推测
        if "【根因推测】" in content:
            start = content.index("【根因推测】") + len("【根因推测】")
            end = content.find("【", start)
            root_cause = content[start:end].strip() if end > 0 else content[start:].strip()
        
        # 提取经济损失评估
        if "【经济损失评估】" in content:
            start = content.index("【经济损失评估】") + len("【经济损失评估】")
            end = content.find("【", start)
            economic_impact = content[start:end].strip() if end > 0 else content[start:].strip()
        
        # 提取操作建议
        if "【建议操作】" in content:
            start = content.index("【建议操作】") + len("【建议操作】")
            end = content.find("【", start)
            suggestions_text = content[start:end].strip() if end > 0 else content[start:].strip()
            
            # 按行分割，提取建议
            for line in suggestions_text.split('\n'):
                line = line.strip()
                if line and ('建议：' in line or '建议' in line or line.startswith(('1.', '2.', '3.', '4.', '5.', '-', '•'))):
                    # 清理格式
                    clean_line = line.replace('建议：', '').replace('建议', '').strip()
                    if clean_line.startswith(('1.', '2.', '3.', '4.', '5.')):
                        clean_line = clean_line.split('.', 1)[1].strip()
                    if clean_line.startswith(('-', '•')):
                        clean_line = clean_line[1:].strip()
                    if clean_line:
                        suggestions.append(clean_line)
        
        # 如果没有新格式，尝试旧格式
        if not summary and "【问题总结】" in content:
            start = content.index("【问题总结】") + len("【问题总结】")
            end = content.find("【", start)
            summary = content[start:end].strip() if end > 0 else content[start:].strip()
        
        if not suggestions and "【操作建议】" in content:
            start = content.index("【操作建议】") + len("【操作建议】")
            end = content.find("【", start)
            suggestions_text = content[start:end].strip() if end > 0 else content[start:].strip()
            for line in suggestions_text.split('\n'):
                line = line.strip()
                if line and ('建议：' in line or line.startswith(('1.', '2.', '3.', '4.', '5.'))):
                    clean_line = line.replace('建议：', '').replace('建议', '').strip()
                    if clean_line.startswith(('1.', '2.', '3.', '4.', '5.')):
                        clean_line = clean_line.split('.', 1)[1].strip()
                    if clean_line:
                        suggestions.append(clean_line)
        
        # 提取优先级（从建议中或单独字段）
        if "【优先级】" in content:
            start = content.index("【优先级】") + len("【优先级】")
            priority_text = content[start:].strip().split('\n')[0]
            if '高' in priority_text:
                priority = '高'
            elif '低' in priority_text:
                priority = '低'
            else:
                priority = '中'
        else:
            # 从建议中提取优先级
            for suggestion in suggestions:
                if '优先级：高' in suggestion or '（优先级：高' in suggestion:
                    priority = '高'
                    break
                elif '优先级：低' in suggestion or '（优先级：低' in suggestion:
                    priority = '低'
                    break
        
        return {
            'summary': summary or '已生成分析报告',
            'root_cause': root_cause or '需要进一步分析',
            'economic_impact': economic_impact or '经济损失评估中',
            'suggestions': suggestions if suggestions else ['建议：持续监控系统运行状态'],
            'priority': priority
        }
    
    def diagnose(self, api_key: Optional[str] = None, time_window_minutes: int = 5) -> Dict:
        """
        执行完整诊断流程（增强版：时序聚合分析）
        """
        # 读取最近5分钟或1000条日志
        logs = self.read_logs(time_window_minutes=time_window_minutes, max_logs=1000)
        
        if not logs:
            return {
                'status': 'no_data',
                'message': '暂无日志数据',
                'timestamp': datetime.now().isoformat()
            }
        
        # 时序聚合分析：按 Region + App_ID 统计
        region_app_stats = self.aggregate_by_region_app(logs)
        
        # 检测异常（包含深度洞察）
        anomalies = self.detect_anomalies(logs, region_app_stats)
        
        # 获取错误日志
        error_logs = self.get_error_logs(logs, limit=100)
        
        # 生成 LLM 建议（包含时序分析结果）
        prompt = self.generate_llm_prompt(error_logs, anomalies, region_app_stats)
        llm_response = self.call_llm_api(prompt, api_key)
        
        # 分析统计
        win_rate, win_stats = self.analyze_win_rate(logs)
        reject_analysis = self.analyze_reject_reasons(logs)
        
        # 计算总损失（从所有异常中汇总，包括 P7 损耗折算）
        total_loss = 0.0
        for anomaly in anomalies:
            details = anomaly.get('details', {})
            if anomaly.get('type') == 'P7_LOSS_VALUATION':
                # P7 损耗折算
                total_loss += details.get('total_potential_loss', 0)
            elif anomaly.get('type') in ['LINK_FLUCTUATION', 'ROI_LOSS_ESTIMATION']:
                total_loss += details.get('potential_loss_5min', 0) or details.get('total_potential_loss', 0)
        
        # 如果总损失超过阈值，标记为红色预警
        LOSS_THRESHOLD_5MIN = 50.0
        LOSS_THRESHOLD_HOURLY = 500.0
        hourly_loss = total_loss * 12
        critical_alert = total_loss > LOSS_THRESHOLD_5MIN or hourly_loss > LOSS_THRESHOLD_HOURLY
        
        # 按严重程度和洞察级别排序异常（P8 > P7 > 其他，high > medium > low）
        def anomaly_sort_key(a):
            insight_level = a.get('insight_level', '')
            severity = a.get('severity', 'low')
            level_score = {'P8': 3, 'P7': 2, '': 1}.get(insight_level, 1)
            severity_score = {'high': 3, 'medium': 2, 'low': 1}.get(severity, 1)
            return (-level_score, -severity_score)
        
        sorted_anomalies = sorted(anomalies, key=anomaly_sort_key, reverse=True)
        
        # 生成结构化诊断报告
        structured_report = self._generate_structured_report(
            sorted_anomalies, 
            llm_response, 
            total_loss, 
            hourly_loss,
            win_rate,
            win_stats,
            reject_analysis
        )
        
        return {
            'status': 'success',
            'timestamp': datetime.now().isoformat(),
            'time_window_minutes': time_window_minutes,
            'statistics': {
                'win_rate': win_rate,
                'win_stats': win_stats,
                'reject_analysis': reject_analysis
            },
            'region_app_aggregation': region_app_stats,
            'anomalies': sorted_anomalies,
            'ai_suggestions': llm_response,
            'structured_report': structured_report,  # 新增：结构化诊断报告
            'total_logs_analyzed': len(logs),
            'total_potential_loss': total_loss,
            'estimated_hourly_loss': hourly_loss,
            'critical_alert': critical_alert,  # 红色预警标志
            'loss_threshold_exceeded': total_loss > LOSS_THRESHOLD_5MIN or hourly_loss > LOSS_THRESHOLD_HOURLY
        }
    
    def _generate_structured_report(self, anomalies: List[Dict], llm_response: Dict,
                                   total_loss: float, hourly_loss: float,
                                   win_rate: float, win_stats: Dict, reject_analysis: Dict) -> Dict:
        """
        生成结构化诊断报告（P7/P8 级别）
        包含：summary (现象), root_cause (根因), economic_impact (经济损失), action_items (建议操作)
        """
        # 提取 P7/P8 级别的洞察
        p7_insights = [a for a in anomalies if a.get('insight_level') == 'P7']
        p8_insights = [a for a in anomalies if a.get('insight_level') == 'P8']
        
        # 构建现象总结
        summary_parts = []
        if p7_insights:
            for insight in p7_insights:
                if insight.get('type') == 'P7_LOSS_VALUATION':
                    region = insight.get('details', {}).get('region', 'Unknown')
                    loss = insight.get('details', {}).get('total_potential_loss', 0)
                    summary_parts.append(f"【P7 损耗预警】{region} 因延迟波动导致潜在收入流失 ${loss:.2f}")
        
        if p8_insights:
            for insight in p8_insights:
                if insight.get('type') == 'QUALITY_FACTOR_PENALTY':
                    q_factor = insight.get('details', {}).get('q_factor', 1.0)
                    fraud_features = insight.get('details', {}).get('fraud_features', [])
                    summary_parts.append(f"【策略预警】检测到该渠道存在流量质量风险（{', '.join(fraud_features) if fraud_features else '机房特征'}），系统已自动触发 {q_factor:.2f} 倍出价折损以保护广告主 ROI。")
                
                if insight.get('type') == 'P8_HIGH_BID_LOW_WIN_RATE':
                    advertiser = insight.get('details', {}).get('advertiser_id', 'Unknown')
                    win_rate_val = insight.get('details', {}).get('win_rate', 0)
                    summary_parts.append(f"【P8 策略建议】检测到 {advertiser} 高价低胜率现象（Win Rate {win_rate_val:.2f}%）")
        
        if not summary_parts:
            summary_parts.append(llm_response.get('summary', '系统运行正常，检测到少量异常'))
        
        summary = '；'.join(summary_parts) if summary_parts else llm_response.get('summary', '系统运行正常')
        
        # 构建根因分析
        root_cause_parts = []
        if p7_insights:
            root_cause_parts.append("延迟波动导致请求超时，影响竞价漏斗顶端流量")
        if p8_insights:
            for insight in p8_insights:
                if insight.get('type') == 'QUALITY_FACTOR_PENALTY':
                    q_factor = insight.get('details', {}).get('q_factor', 1.0)
                    fraud_features = insight.get('details', {}).get('fraud_features', [])
                    root_cause_parts.append(f"流量质量风险：检测到 {', '.join(fraud_features) if fraud_features else '机房特征'}，质量系数 q_factor={q_factor:.2f}，导致高质量出价因出价折损而落榜")
                
                if insight.get('type') == 'P8_HIGH_BID_LOW_WIN_RATE':
                    avg_pctr = insight.get('details', {}).get('avg_pctr', 0)
                    market_pctr = insight.get('details', {}).get('market_avg_pctr', 0)
                    root_cause_parts.append(f"pCTR (预估点击率) 远低于大盘均值（当前 {avg_pctr:.2f}%，大盘均值 {market_pctr:.2f}%）")
        
        if not root_cause_parts:
            root_cause_parts.append(llm_response.get('root_cause', '需要进一步分析'))
        
        root_cause = '；'.join(root_cause_parts) if root_cause_parts else llm_response.get('root_cause', '需要进一步分析')
        
        # 构建经济损失评估
        economic_impact = f"当前窗口潜在损失 ${total_loss:.2f}，预计每小时损失 ${hourly_loss:.2f}"
        if llm_response.get('economic_impact'):
            economic_impact = llm_response['economic_impact']
        
        # 构建建议操作
        action_items = []
        
        # 从 P7/P8 洞察中提取建议
        for insight in p7_insights + p8_insights:
            suggestion = insight.get('suggestion', '')
            if suggestion:
                action_items.append(suggestion)
        
        # 从 LLM 响应中提取建议
        llm_suggestions = llm_response.get('suggestions', [])
        for suggestion in llm_suggestions[:3]:  # 最多取3条
            if suggestion not in action_items:
                action_items.append(suggestion)
        
        if not action_items:
            action_items = ['建议持续监控系统运行状态']
        
        return {
            'summary': summary,
            'root_cause': root_cause,
            'economic_impact': economic_impact,
            'action_items': action_items
        }


if __name__ == "__main__":
    # 测试代码
    agent = DiagnosticAgent()
    result = agent.diagnose()
    print(json.dumps(result, ensure_ascii=False, indent=2))

