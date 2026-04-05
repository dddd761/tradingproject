"""
股票数据服务
使用akshare获取A股K线数据
"""
import logging
from datetime import datetime

import akshare as ak
import pandas as pd

from app.repository.data_store import data_store

logger = logging.getLogger(__name__)


def get_kline_data(stock_code: str, start_date: str, end_date: str) -> list[dict]:
    """
    获取A股日K线数据
    优先从缓存读取，缓存未命中则调用akshare

    @param stock_code: 股票代码，如 000001
    @param start_date: 开始日期 YYYYMMDD 或 YYYY-MM-DD
    @param end_date: 结束日期
    @returns K线数据列表
    """
    # 统一日期格式为 YYYYMMDD（akshare要求）
    start_fmt = start_date.replace("-", "")
    end_fmt = end_date.replace("-", "")

    # 尝试加载缓存
    cached = data_store.load_kline_cache(stock_code, start_fmt, end_fmt)
    if cached:
        logger.info(f"Loaded kline cache for {stock_code}")
        return cached

    try:
        # NOTE: akshare的股票日K线接口
        # symbol格式需要根据交易所添加前缀
        symbol = _format_symbol(stock_code)
        df = ak.stock_zh_a_hist(
            symbol=stock_code,
            period="daily",
            start_date=start_fmt,
            end_date=end_fmt,
            adjust="qfq",  # 前复权
        )

        if df is None or df.empty:
            logger.warning(f"No kline data found for {stock_code}")
            return []

        # 转换为标准格式
        kline_list = []
        for _, row in df.iterrows():
            kline_list.append({
                "date": str(row["日期"]),
                "open": float(row["开盘"]),
                "high": float(row["最高"]),
                "low": float(row["最低"]),
                "close": float(row["收盘"]),
                "volume": float(row["成交量"]),
            })

        # 缓存数据
        data_store.save_kline_cache(stock_code, start_fmt, end_fmt, kline_list)
        logger.info(f"Fetched and cached {len(kline_list)} kline records for {stock_code}")
        return kline_list

    except Exception as e:
        logger.error(f"Failed to fetch kline data for {stock_code}: {e}")
        raise ValueError(f"获取股票 {stock_code} K线数据失败: {str(e)}")


def _format_symbol(stock_code: str) -> str:
    """
    根据股票代码判断交易所
    沪市: 6开头; 深市: 0/3开头; 北交所: 4/8开头
    """
    if stock_code.startswith("6"):
        return f"sh{stock_code}"
    elif stock_code.startswith(("0", "3")):
        return f"sz{stock_code}"
    elif stock_code.startswith(("4", "8")):
        return f"bj{stock_code}"
    return stock_code
