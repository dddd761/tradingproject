"""
回测 API 路由
"""
import logging
from fastapi import APIRouter, HTTPException

from app.schema.models import BacktestRequest
from app.service.stock_service import get_kline_data
from app.service.backtest_engine import run_backtest
from app.repository.data_store import data_store
from app.config import load_settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/run")
async def execute_backtest(request: BacktestRequest):
    """
    执行回测

    @param request: 包含股票代码、起止日期的回测请求
    """
    try:
        # 获取K线数据
        kline_data = get_kline_data(
            request.stock_code, request.start_date, request.end_date
        )
        if not kline_data:
            raise HTTPException(
                status_code=400,
                detail=f"未获取到股票 {request.stock_code} 在指定时间范围内的K线数据",
            )

        # 获取另类数据
        alternative_data = data_store.load_alternative_data(request.stock_code)

        # 加载设置
        settings = load_settings()

        # 执行回测
        result = run_backtest(kline_data, alternative_data, request.stock_code, settings)

        return {"code": 0, "data": result}

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Backtest error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"回测执行失败: {str(e)}")
