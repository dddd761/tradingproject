import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Search, TrendingUp, TrendingDown, Target, BarChart3, AlertTriangle } from 'lucide-react'
import { backtestApi } from '../../services/api'
import type { BacktestResult, KlineDataPoint, TradeAction, SentimentScore } from '../../types'
import { createChart, CandlestickSeries, LineSeries, HistogramSeries, createSeriesMarkers } from 'lightweight-charts'

/**
 * 回测主页面
 * 提供股票代码输入、日期选择、K线图展示和回测结果
 */
export default function BacktestPage() {
  const [stockCode, setStockCode] = useState('000001')
  const [startDate, setStartDate] = useState('2024-01-01')
  const [endDate, setEndDate] = useState('2024-12-31')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [error, setError] = useState('')
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const sentimentChartRef = useRef<HTMLDivElement>(null)

  /** 执行回测 */
  const handleBacktest = useCallback(async () => {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const response = await backtestApi.run(stockCode, startDate, endDate)
      setResult(response.data)
      // NOTE: 保存结果到localStorage供分析详情页读取
      try { localStorage.setItem('latest_backtest_result', JSON.stringify(response.data)) } catch { /* 忽略存储限制 */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : '回测失败')
    } finally {
      setLoading(false)
    }
  }, [stockCode, startDate, endDate])

  /** 渲染K线图 */
  useEffect(() => {
    if (!result || !chartContainerRef.current) return

    const container = chartContainerRef.current
    container.innerHTML = ''

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 450,
      layout: {
        background: { color: '#1a2236' },
        textColor: '#8b95a8',
        fontFamily: "'Inter', sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(42, 53, 80, 0.5)' },
        horzLines: { color: 'rgba(42, 53, 80, 0.5)' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: 'rgba(79, 142, 255, 0.4)', style: 2 },
        horzLine: { color: 'rgba(79, 142, 255, 0.4)', style: 2 },
      },
      timeScale: {
        borderColor: '#2a3550',
        timeVisible: false,
      },
      rightPriceScale: {
        borderColor: '#2a3550',
      },
    })

    // K线序列
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#ef4444',
      downColor: '#22c55e',
      borderUpColor: '#ef4444',
      borderDownColor: '#22c55e',
      wickUpColor: '#ef4444',
      wickDownColor: '#22c55e',
    })

    const candleData = result.kline_data.map((k: KlineDataPoint) => ({
      time: k.date,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
    }))
    candleSeries.setData(candleData as any)

    // 买卖信号标记
    const buyMarkers: any[] = []
    const sellMarkers: any[] = []
    result.trades.forEach((t: TradeAction) => {
      if (t.action === 'BUY') {
        buyMarkers.push({
          time: t.date,
          position: 'belowBar',
          color: '#ef4444',
          shape: 'arrowUp',
          text: `买 ${t.shares}股`,
          size: 1.5,
        })
      } else if (t.action === 'SELL') {
        sellMarkers.push({
          time: t.date,
          position: 'aboveBar',
          color: '#22c55e',
          shape: 'arrowDown',
          text: `卖 ${t.shares}股`,
          size: 1.5,
        })
      }
    })
    const allMarkers = [...buyMarkers, ...sellMarkers].sort(
      (a, b) => (a.time > b.time ? 1 : -1)
    )
    createSeriesMarkers(candleSeries, allMarkers as any)

    // 成交量
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    })
    volumeSeries.setData(
      result.kline_data.map((k: KlineDataPoint) => ({
        time: k.date,
        value: k.volume,
        color: k.close >= k.open ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)',
      })) as any
    )

    chart.timeScale().fitContent()

    // 响应式
    const handleResize = () => {
      chart.applyOptions({ width: container.clientWidth })
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [result])

  /** 渲染情绪分数图 */
  useEffect(() => {
    if (!result || !sentimentChartRef.current) return

    const container = sentimentChartRef.current
    container.innerHTML = ''

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 200,
      layout: {
        background: { color: '#1a2236' },
        textColor: '#8b95a8',
        fontFamily: "'Inter', sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(42, 53, 80, 0.3)' },
        horzLines: { color: 'rgba(42, 53, 80, 0.3)' },
      },
      rightPriceScale: { borderColor: '#2a3550' },
      timeScale: { borderColor: '#2a3550' },
    })

    // 情绪分数线
    const sentimentLine = chart.addSeries(LineSeries, {
      color: '#4f8eff',
      lineWidth: 2,
      priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(3) },
    })
    sentimentLine.setData(
      result.sentiment_scores.map((s: SentimentScore) => ({
        time: s.date,
        value: s.score,
      })) as any
    )

    // 零线
    const zeroLine = chart.addSeries(LineSeries, {
      color: 'rgba(107, 114, 128, 0.5)',
      lineWidth: 1,
      lineStyle: 2,
      priceFormat: { type: 'custom', formatter: () => '0' },
    })
    zeroLine.setData(
      result.sentiment_scores.map((s: SentimentScore) => ({
        time: s.date,
        value: 0,
      })) as any
    )

    // 买卖阈值线
    const buyThresholdLine = chart.addSeries(LineSeries, {
      color: 'rgba(239, 68, 68, 0.4)',
      lineWidth: 1,
      lineStyle: 3,
    })
    buyThresholdLine.setData(
      result.sentiment_scores.map((s: SentimentScore) => ({
        time: s.date,
        value: 0.3,
      })) as any
    )

    const sellThresholdLine = chart.addSeries(LineSeries, {
      color: 'rgba(34, 197, 94, 0.4)',
      lineWidth: 1,
      lineStyle: 3,
    })
    sellThresholdLine.setData(
      result.sentiment_scores.map((s: SentimentScore) => ({
        time: s.date,
        value: -0.3,
      })) as any
    )

    chart.timeScale().fitContent()

    const handleResize = () => {
      chart.applyOptions({ width: container.clientWidth })
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [result])

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">策略回测</h1>
        <p className="page-subtitle">基于另类数据情绪分析的A股交易策略回测</p>
      </div>

      {/* 控制面板 */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '140px' }}>
            <label className="form-label">股票代码</label>
            <div style={{ position: 'relative' }}>
              <input
                id="stock-code-input"
                type="text"
                className="form-input"
                value={stockCode}
                onChange={(e) => setStockCode(e.target.value)}
                placeholder="如 000001"
                style={{ paddingLeft: '36px' }}
              />
              <Search
                size={14}
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}
              />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">开始日期</label>
            <input
              id="start-date-input"
              type="date"
              className="form-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">结束日期</label>
            <input
              id="end-date-input"
              type="date"
              className="form-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <button
            id="start-backtest-btn"
            className="btn btn-primary btn-lg"
            onClick={handleBacktest}
            disabled={loading || !stockCode}
          >
            {loading ? (
              <>
                <span className="loading-spinner" />
                回测中...
              </>
            ) : (
              <>
                <Play size={16} />
                开始回测
              </>
            )}
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', color: 'var(--color-bull)' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* 回测结果 */}
      {result && (
        <>
          {/* 绩效统计 */}
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">总收益率</span>
              <span className={`stat-value ${result.total_return >= 0 ? 'positive' : 'negative'}`}>
                {result.total_return >= 0 ? '+' : ''}{result.total_return}%
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">年化收益率</span>
              <span className={`stat-value ${result.annualized_return >= 0 ? 'positive' : 'negative'}`}>
                {result.annualized_return >= 0 ? '+' : ''}{result.annualized_return}%
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">最大回撤</span>
              <span className="stat-value negative">-{result.max_drawdown}%</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">胜率</span>
              <span className={`stat-value ${result.win_rate >= 50 ? 'positive' : 'neutral'}`}>
                {result.win_rate}%
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">夏普比率</span>
              <span className={`stat-value ${result.sharpe_ratio >= 0 ? 'positive' : 'negative'}`}>
                {result.sharpe_ratio}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">交易次数</span>
              <span className="stat-value neutral">
                {result.total_trades}
              </span>
              <span className="stat-change" style={{ color: 'var(--color-text-muted)' }}>
                盈利 {result.profitable_trades} 次
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">初始资金</span>
              <span className="stat-value neutral">
                {(result.initial_capital / 10000).toFixed(0)}万
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">最终资金</span>
              <span className={`stat-value ${result.final_capital >= result.initial_capital ? 'positive' : 'negative'}`}>
                {(result.final_capital / 10000).toFixed(2)}万
              </span>
            </div>
          </div>

          {/* K线图 */}
          <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="card-header">
              <span className="card-title">
                <BarChart3 size={16} />
                K线图 · {stockCode}
              </span>
              <div style={{ display: 'flex', gap: 'var(--space-md)', fontSize: '12px' }}>
                <span style={{ color: 'var(--color-bull)' }}>▲ 买入信号</span>
                <span style={{ color: 'var(--color-bear)' }}>▼ 卖出信号</span>
              </div>
            </div>
            <div ref={chartContainerRef} className="chart-container" style={{ border: 'none' }} />
          </div>

          {/* 情绪分数图 */}
          <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="card-header">
              <span className="card-title">
                <TrendingUp size={16} />
                每日情绪分数
              </span>
              <div style={{ display: 'flex', gap: 'var(--space-md)', fontSize: '12px' }}>
                <span style={{ color: 'var(--color-accent)' }}>— 综合情绪分</span>
                <span style={{ color: 'rgba(239, 68, 68, 0.5)' }}>··· 买入阈值</span>
                <span style={{ color: 'rgba(34, 197, 94, 0.5)' }}>··· 卖出阈值</span>
              </div>
            </div>
            <div ref={sentimentChartRef} className="chart-container" style={{ border: 'none' }} />
          </div>

          {/* 交易明细 */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Target size={16} />
                交易明细
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>操作</th>
                    <th>价格</th>
                    <th>数量</th>
                    <th>金额</th>
                    <th>情绪分</th>
                    <th>原因</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades
                    .filter((t: TradeAction) => t.action !== 'HOLD')
                    .map((t: TradeAction, i: number) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{t.date}</td>
                        <td>
                          <span className={`badge ${t.action === 'BUY' ? 'badge-bull' : 'badge-bear'}`}>
                            {t.action === 'BUY' ? '买入' : '卖出'}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>¥{t.price.toFixed(2)}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{t.shares}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>¥{t.amount.toFixed(2)}</td>
                        <td>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              color: t.sentiment_score > 0 ? 'var(--color-bull)' : t.sentiment_score < 0 ? 'var(--color-bear)' : 'var(--color-text-muted)',
                            }}
                          >
                            {t.sentiment_score > 0 ? '+' : ''}{t.sentiment_score.toFixed(3)}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.reason}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {result.trades.filter((t: TradeAction) => t.action !== 'HOLD').length === 0 && (
                <div className="empty-state">
                  <TrendingDown size={32} style={{ opacity: 0.4 }} />
                  <p className="empty-state-text">无交易记录</p>
                  <p className="empty-state-hint">情绪分数未触达买卖阈值，请检查另类数据或调整参数</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 初始空状态 */}
      {!result && !loading && !error && (
        <div className="card">
          <div className="empty-state">
            <BarChart3 size={56} style={{ opacity: 0.3, color: 'var(--color-accent)' }} />
            <p className="empty-state-text" style={{ fontSize: '16px', marginTop: 'var(--space-md)' }}>
              输入股票代码，选择时间范围，点击开始回测
            </p>
            <p className="empty-state-hint">
              请先在「数据管理」页面导入相关的另类数据（财经新闻、政策消息等）
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
