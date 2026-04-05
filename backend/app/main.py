"""
FastAPI 应用入口
提供A股另类数据驱动的交易策略回测服务
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import stock, alternative_data, backtest, settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="A股另类数据回测系统",
    description="基于另类数据（财经新闻、政策消息）驱动的交易策略回测API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stock.router, prefix="/api/stock", tags=["股票数据"])
app.include_router(alternative_data.router, prefix="/api/alternative-data", tags=["另类数据"])
app.include_router(backtest.router, prefix="/api/backtest", tags=["回测"])
app.include_router(settings.router, prefix="/api/settings", tags=["参数设置"])


@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "message": "A股另类数据回测系统运行中"}
