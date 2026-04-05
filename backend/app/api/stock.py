"""
股票数据 API 路由
"""
import logging
from fastapi import APIRouter, HTTPException

from app.service.stock_service import get_kline_data

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{stock_code}/kline")
async def get_stock_kline(stock_code: str, start_date: str, end_date: str):
    """
    获取股票K线数据

    @param stock_code: 股票代码，如 000001
    @param start_date: 开始日期 YYYY-MM-DD
    @param end_date: 结束日期 YYYY-MM-DD
    """
    try:
        kline = get_kline_data(stock_code, start_date, end_date)
        return {"code": 0, "data": kline, "message": "success"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Get kline error: {e}")
        raise HTTPException(status_code=500, detail=f"获取K线数据失败: {str(e)}")
