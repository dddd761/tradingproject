"""
数据模型定义（Pydantic Schema）
用于请求/响应的数据校验和序列化
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date


class AlternativeDataItem(BaseModel):
    """另类数据条目"""
    id: Optional[str] = None
    stock_code: str = Field(..., description="股票代码，如 000001")
    date: str = Field(..., description="日期 YYYY-MM-DD")
    title: str = Field(..., description="标题")
    content: str = Field(..., description="正文内容")
    source: str = Field(default="手动导入", description="来源")
    category: str = Field(default="新闻", description="分类：新闻/政策/公告/其他")
    impact_level: Optional[int] = Field(default=None, description="预估影响等级 1-5")


class AlternativeDataImport(BaseModel):
    """批量导入另类数据"""
    stock_code: str
    items: list[AlternativeDataItem]


class BacktestRequest(BaseModel):
    """回测请求参数"""
    stock_code: str = Field(..., description="股票代码")
    start_date: str = Field(..., description="开始日期 YYYY-MM-DD")
    end_date: str = Field(..., description="结束日期 YYYY-MM-DD")
    alternative_data: Optional[list[AlternativeDataItem]] = Field(default=None, description="可选的另类数据，由前端直接传输实现隐私隔离")


class KlineDataPoint(BaseModel):
    """K线数据点"""
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float


class SentimentScore(BaseModel):
    """每日情绪分数"""
    date: str
    score: float = Field(..., description="综合情绪分数 -1 到 1")
    finbert_score: float = 0.0
    arima_score: float = 0.0
    garch_adjustment: float = 0.0
    lstm_score: float = 0.0
    contributing_news: list[dict] = Field(default_factory=list, description="贡献的新闻列表")
    resonance_factor: float = 1.0


class TradeAction(BaseModel):
    """交易操作记录"""
    date: str
    action: str = Field(..., description="BUY / SELL / HOLD")
    price: float
    shares: int = 0
    amount: float = 0.0
    reason: str = ""
    sentiment_score: float = 0.0


class BacktestResult(BaseModel):
    """回测结果"""
    kline_data: list[KlineDataPoint]
    sentiment_scores: list[SentimentScore]
    trades: list[TradeAction]
    # 绩效统计
    total_return: float = Field(..., description="总收益率 %")
    annualized_return: float = Field(default=0.0, description="年化收益率 %")
    max_drawdown: float = Field(default=0.0, description="最大回撤 %")
    win_rate: float = Field(default=0.0, description="胜率 %")
    sharpe_ratio: float = Field(default=0.0, description="夏普比率")
    total_trades: int = 0
    profitable_trades: int = 0
    initial_capital: float = 1000000
    final_capital: float = 1000000


class CleaningStep(BaseModel):
    """数据清洗步骤记录"""
    step_name: str
    description: str
    input_count: int
    output_count: int
    removed_items: list[dict] = Field(default_factory=list)
    params: dict = Field(default_factory=dict)


class CleaningResult(BaseModel):
    """数据清洗完整结果"""
    steps: list[CleaningStep]
    original_count: int
    final_count: int
    cleaned_data: list[AlternativeDataItem]


class ScoringDetail(BaseModel):
    """打分详情（单条新闻）"""
    news_id: str
    title: str
    date: str
    raw_score: float
    decayed_score: float
    decay_days: int
    model_scores: dict = Field(default_factory=dict)


class SettingsUpdate(BaseModel):
    """参数更新请求"""
    model_weights: Optional[dict] = None
    decay_alpha: Optional[float] = None
    resonance_beta: Optional[float] = None
    trade: Optional[dict] = None
    cleaning: Optional[dict] = None
    llm: Optional[dict] = None
