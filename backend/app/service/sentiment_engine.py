"""
情绪分析引擎
整合 FinBERT、ARIMA、GARCH、LSTM 四模型综合打分
情绪分数随时间对数衰减，并考虑多条新闻的共振效应
"""
import logging
import math
from datetime import datetime, timedelta
from typing import Optional
from collections import defaultdict

import numpy as np

from app.config import load_settings
from app.service.cleaning_service import clean_alternative_data

logger = logging.getLogger(__name__)


def compute_daily_sentiment(
    alternative_data: list[dict],
    stock_code: str,
    date_range: list[str],
    settings: Optional[dict] = None,
) -> dict:
    """
    计算日期范围内每天的综合情绪分数

    流程:
    1. 清洗数据
    2. 对每条新闻用FinBERT打基础分
    3. 计算对数衰减
    4. 检测共振效应
    5. ARIMA趋势预测
    6. GARCH波动率调整
    7. LSTM综合（预留）
    8. 加权融合得到最终分数

    @param alternative_data: 另类数据列表
    @param stock_code: 目标股票代码
    @param date_range: 日期列表 ["YYYY-MM-DD", ...]
    @param settings: 系统参数配置
    @returns 包含每日分数和分析详情的字典
    """
    if settings is None:
        settings = load_settings()

    weights = settings.get("model_weights", {})
    alpha = settings.get("decay_alpha", 0.3)
    beta = settings.get("resonance_beta", 0.5)

    # Step 1: 数据清洗
    cleaning_result = clean_alternative_data(alternative_data, stock_code, settings)
    cleaned_data = cleaning_result["cleaned_data"]

    # Step 2: FinBERT 基础打分（当前使用规则引擎替代）
    scored_news = []
    for item in cleaned_data:
        raw_score = _rule_based_sentiment(item)
        scored_news.append({
            **item,
            "raw_sentiment": raw_score,
            "finbert_score": raw_score,
        })

    # Step 3 & 4: 计算每日情绪分数（含衰减和共振）
    daily_scores = []
    scoring_details = []
    historical_scores = []  # 用于ARIMA/GARCH

    for target_date in date_range:
        target_dt = datetime.strptime(target_date, "%Y-%m-%d")

        # 收集对当天有影响的所有新闻（发生在当天或之前）
        contributing_news = []
        positive_count = 0
        negative_count = 0

        for news in scored_news:
            news_date = news.get("date", "")
            try:
                news_dt = datetime.strptime(news_date, "%Y-%m-%d")
            except ValueError:
                continue

            # 只考虑当天及之前的新闻
            delta_days = (target_dt - news_dt).days
            if delta_days < 0:
                continue

            # 超过30天的新闻影响忽略不计
            if delta_days > 30:
                continue

            # 对数衰减: score(t) = score_0 * max(0, 1 - α * ln(1 + t))
            raw = news["raw_sentiment"]
            decay_factor = max(0, 1 - alpha * math.log(1 + delta_days))
            decayed_score = raw * decay_factor

            if decayed_score > 0:
                positive_count += 1
            elif decayed_score < 0:
                negative_count += 1

            contributing_news.append({
                "id": news.get("id", ""),
                "title": news.get("title", ""),
                "date": news_date,
                "raw_score": round(raw, 4),
                "decayed_score": round(decayed_score, 4),
                "decay_days": delta_days,
                "decay_factor": round(decay_factor, 4),
            })

        # 共振效应计算
        # 同方向新闻数量 > 1 时产生共振放大
        pos_resonance = 1 + beta * math.log(max(1, positive_count)) if positive_count > 1 else 1.0
        neg_resonance = 1 + beta * math.log(max(1, negative_count)) if negative_count > 1 else 1.0

        # 汇总FinBERT分数
        finbert_total = 0.0
        for cn in contributing_news:
            ds = cn["decayed_score"]
            if ds > 0:
                finbert_total += ds * pos_resonance
            elif ds < 0:
                finbert_total += ds * neg_resonance

        # 归一化到 [-1, 1]
        finbert_score = max(-1, min(1, finbert_total))

        # ARIMA 趋势分数（基于历史情绪分数的趋势外推）
        arima_score = _simple_arima_score(historical_scores)

        # GARCH 波动率调整（高波动时降低置信度）
        garch_adj = _simple_garch_adjustment(historical_scores)

        # LSTM 分数（预留，当前使用FinBERT分数权重替代）
        lstm_score = finbert_score * 0.8  # 简化版：跟随FinBERT方向但弱化

        # 加权融合
        w_finbert = weights.get("finbert", 0.4)
        w_arima = weights.get("arima", 0.2)
        w_garch = weights.get("garch", 0.2)
        w_lstm = weights.get("lstm", 0.2)

        # GARCH调整系数应用于总分
        raw_composite = (
            w_finbert * finbert_score
            + w_arima * arima_score
            + w_lstm * lstm_score
        )
        # GARCH调整：波动率高时压缩信号强度
        composite_score = raw_composite * garch_adj
        composite_score = max(-1, min(1, composite_score))

        resonance_factor = max(pos_resonance, neg_resonance)

        daily_scores.append({
            "date": target_date,
            "score": round(composite_score, 4),
            "finbert_score": round(finbert_score, 4),
            "arima_score": round(arima_score, 4),
            "garch_adjustment": round(garch_adj, 4),
            "lstm_score": round(lstm_score, 4),
            "contributing_news": contributing_news,
            "resonance_factor": round(resonance_factor, 4),
        })

        historical_scores.append(composite_score)

        # 打分详情
        for cn in contributing_news:
            scoring_details.append({
                "news_id": cn["id"],
                "title": cn["title"],
                "date": cn["date"],
                "target_date": target_date,
                "raw_score": cn["raw_score"],
                "decayed_score": cn["decayed_score"],
                "decay_days": cn["decay_days"],
            })

    return {
        "daily_scores": daily_scores,
        "cleaning_result": cleaning_result,
        "scoring_details": scoring_details,
    }


def _rule_based_sentiment(news: dict) -> float:
    """
    基于规则的情绪打分引擎（替代FinBERT）
    后续可切换为真实FinBERT模型

    使用关键词权重和语义规则打分
    """
    text = (news.get("title", "") + " " + news.get("content", "")).lower()

    # 看涨关键词和权重
    positive_keywords = {
        "利好": 0.6, "上涨": 0.5, "增长": 0.4, "突破": 0.5, "大涨": 0.7,
        "涨停": 0.8, "创新高": 0.6, "业绩增长": 0.6, "超预期": 0.7,
        "政策支持": 0.5, "降息": 0.4, "减税": 0.4, "刺激": 0.3,
        "订单": 0.3, "中标": 0.5, "合作": 0.3, "投资": 0.2,
        "回购": 0.4, "增持": 0.5, "分红": 0.3, "盈利": 0.4,
        "扭亏为盈": 0.7, "净利润增长": 0.6, "营收增长": 0.5,
    }

    # 看跌关键词和权重
    negative_keywords = {
        "利空": -0.6, "下跌": -0.5, "下滑": -0.4, "暴跌": -0.7,
        "跌停": -0.8, "创新低": -0.6, "业绩下滑": -0.6, "不及预期": -0.7,
        "监管处罚": -0.6, "加息": -0.4, "增税": -0.4, "收缩": -0.3,
        "亏损": -0.5, "减持": -0.5, "退市": -0.8, "ST": -0.7,
        "违规": -0.6, "诉讼": -0.4, "罚款": -0.5, "负债": -0.3,
        "净利润下降": -0.6, "营收下降": -0.5, "风险": -0.3,
    }

    score = 0.0
    hit_count = 0

    for kw, weight in positive_keywords.items():
        if kw in text:
            score += weight
            hit_count += 1

    for kw, weight in negative_keywords.items():
        if kw in text:
            score += weight
            hit_count += 1

    # 考虑预设的影响等级
    impact = news.get("impact_level")
    if impact is not None:
        try:
            impact_val = int(impact)
            # impact_level 1-5 映射为调整系数 0.5-1.5
            impact_factor = 0.5 + (impact_val - 1) * 0.25
            score *= impact_factor
        except (ValueError, TypeError):
            pass

    # 归一化到 [-1, 1]
    if hit_count > 0:
        score = score / max(hit_count, 1)
    return max(-1.0, min(1.0, score))


def _simple_arima_score(historical_scores: list[float]) -> float:
    """
    简化版ARIMA趋势预测
    基于最近N个分数的移动平均趋势

    NOTE: 后续应替换为statsmodels的ARIMA模型
    当前使用线性趋势外推作为替代
    """
    if len(historical_scores) < 3:
        return 0.0

    # 使用最近5个数据点的线性拟合
    recent = historical_scores[-5:]
    n = len(recent)
    x = np.arange(n)
    y = np.array(recent)

    # 最小二乘线性拟合
    if np.std(y) < 1e-10:
        return float(y[-1]) if len(y) > 0 else 0.0

    slope = np.polyfit(x, y, 1)[0]

    # 预测下一个值
    predicted = y[-1] + slope
    return max(-1.0, min(1.0, float(predicted)))


def _simple_garch_adjustment(historical_scores: list[float]) -> float:
    """
    简化版GARCH波动率调整
    波动率高时返回较低的系数以降低信号置信度

    NOTE: 后续应替换为arch库的GARCH模型
    当前使用滚动标准差作为波动率代理
    """
    if len(historical_scores) < 5:
        return 1.0

    recent = historical_scores[-10:]
    volatility = float(np.std(recent))

    # 波动率越高，调整系数越低
    # 正常波动率 ~0.1-0.3，极端波动率 > 0.5
    if volatility < 0.1:
        return 1.0
    elif volatility < 0.3:
        return 0.9
    elif volatility < 0.5:
        return 0.7
    else:
        return 0.5
