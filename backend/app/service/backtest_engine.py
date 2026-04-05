"""
回测引擎
根据情绪分数执行模拟交易，计算绩效统计
"""
import logging
import math
from typing import Optional

from app.config import load_settings
from app.service.sentiment_engine import compute_daily_sentiment

logger = logging.getLogger(__name__)


def run_backtest(
    kline_data: list[dict],
    alternative_data: list[dict],
    stock_code: str,
    settings: Optional[dict] = None,
) -> dict:
    """
    执行回测

    @param kline_data: K线数据
    @param alternative_data: 另类数据
    @param stock_code: 股票代码
    @param settings: 参数配置
    @returns 完整的回测结果
    """
    if settings is None:
        settings = load_settings()

    trade_params = settings.get("trade", {})
    buy_threshold = trade_params.get("buy_threshold", 0.3)
    sell_threshold = trade_params.get("sell_threshold", -0.3)
    position_ratio = trade_params.get("daily_position_ratio", 0.1)
    initial_capital = trade_params.get("initial_capital", 1000000)
    commission_rate = trade_params.get("commission_rate", 0.0003)
    slippage = trade_params.get("slippage", 0.001)

    # 获取日期范围
    date_range = [k["date"] for k in kline_data]

    # 计算情绪分数
    sentiment_result = compute_daily_sentiment(
        alternative_data, stock_code, date_range, settings
    )
    daily_scores = sentiment_result["daily_scores"]

    # 构建日期到分数的映射
    score_map = {s["date"]: s for s in daily_scores}

    # 模拟交易
    capital = initial_capital
    position = 0  # 持仓股数
    trades = []
    daily_capital = []  # 每日总资产

    for kline in kline_data:
        date = kline["date"]
        close_price = kline["close"]
        open_price = kline["open"]

        sentiment = score_map.get(date, {})
        score = sentiment.get("score", 0.0)

        action = "HOLD"
        trade_shares = 0
        trade_amount = 0.0
        reason = ""

        if score >= buy_threshold and capital > 0:
            # 买入信号
            available_amount = capital * position_ratio
            # 考虑滑点和手续费
            effective_price = open_price * (1 + slippage)
            # A股最少买100股（1手）
            max_shares = int(available_amount / effective_price / 100) * 100
            if max_shares >= 100:
                trade_shares = max_shares
                trade_amount = trade_shares * effective_price
                commission = max(trade_amount * commission_rate, 5)  # 最低5元
                capital -= (trade_amount + commission)
                position += trade_shares
                action = "BUY"
                reason = f"情绪分数 {score:.2f} > 买入阈值 {buy_threshold}"

        elif score <= sell_threshold and position > 0:
            # 卖出信号 - 卖出全部持仓
            effective_price = open_price * (1 - slippage)
            trade_shares = position
            trade_amount = trade_shares * effective_price
            commission = max(trade_amount * commission_rate, 5)
            # A股卖出需要印花税千分之一
            stamp_tax = trade_amount * 0.001
            capital += (trade_amount - commission - stamp_tax)
            position = 0
            action = "SELL"
            reason = f"情绪分数 {score:.2f} < 卖出阈值 {sell_threshold}"

        total_assets = capital + position * close_price
        daily_capital.append(total_assets)

        trades.append({
            "date": date,
            "action": action,
            "price": close_price,
            "shares": trade_shares,
            "amount": round(trade_amount, 2),
            "reason": reason,
            "sentiment_score": score,
        })

    # 计算绩效统计
    final_capital = capital + position * kline_data[-1]["close"] if kline_data else capital
    total_return = (final_capital - initial_capital) / initial_capital * 100

    # 年化收益率
    trading_days = len(kline_data)
    years = trading_days / 252 if trading_days > 0 else 1
    annualized_return = ((final_capital / initial_capital) ** (1 / years) - 1) * 100 if years > 0 else 0

    # 最大回撤
    max_drawdown = _calculate_max_drawdown(daily_capital)

    # 胜率统计
    buy_trades = [t for t in trades if t["action"] == "BUY"]
    sell_trades = [t for t in trades if t["action"] == "SELL"]
    total_trades = len(buy_trades)

    # 配对买卖计算盈利次数
    profitable_trades = 0
    for i, sell in enumerate(sell_trades):
        if i < len(buy_trades):
            if sell["price"] > buy_trades[i]["price"]:
                profitable_trades += 1

    win_rate = (profitable_trades / total_trades * 100) if total_trades > 0 else 0

    # 夏普比率（简化版，以日收益率计算）
    sharpe_ratio = _calculate_sharpe(daily_capital)

    return {
        "kline_data": kline_data,
        "sentiment_scores": daily_scores,
        "trades": trades,
        "total_return": round(total_return, 2),
        "annualized_return": round(annualized_return, 2),
        "max_drawdown": round(max_drawdown, 2),
        "win_rate": round(win_rate, 2),
        "sharpe_ratio": round(sharpe_ratio, 4),
        "total_trades": total_trades,
        "profitable_trades": profitable_trades,
        "initial_capital": initial_capital,
        "final_capital": round(final_capital, 2),
        "cleaning_result": sentiment_result["cleaning_result"],
        "scoring_details": sentiment_result["scoring_details"],
    }


def _calculate_max_drawdown(daily_capital: list[float]) -> float:
    """
    计算最大回撤百分比
    """
    if not daily_capital:
        return 0.0

    peak = daily_capital[0]
    max_dd = 0.0

    for val in daily_capital:
        if val > peak:
            peak = val
        drawdown = (peak - val) / peak * 100
        if drawdown > max_dd:
            max_dd = drawdown

    return max_dd


def _calculate_sharpe(daily_capital: list[float], risk_free_rate: float = 0.03) -> float:
    """
    计算年化夏普比率
    """
    if len(daily_capital) < 2:
        return 0.0

    # 计算日收益率
    daily_returns = []
    for i in range(1, len(daily_capital)):
        if daily_capital[i - 1] > 0:
            ret = (daily_capital[i] - daily_capital[i - 1]) / daily_capital[i - 1]
            daily_returns.append(ret)

    if not daily_returns:
        return 0.0

    import numpy as np
    returns_arr = np.array(daily_returns)
    mean_return = float(np.mean(returns_arr))
    std_return = float(np.std(returns_arr))

    if std_return < 1e-10:
        return 0.0

    # 年化：日收益率 * 252，日标准差 * sqrt(252)
    daily_rf = risk_free_rate / 252
    sharpe = (mean_return - daily_rf) / std_return * math.sqrt(252)
    return sharpe
