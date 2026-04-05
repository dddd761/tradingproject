import { useState } from 'react'
import { LineChart, Filter, Layers, PieChart, ChevronDown, ChevronRight, Eye } from 'lucide-react'
import type { BacktestResult, CleaningStep, ScoringDetail } from '../../types'

/**
 * 分析详情页面
 * 展示数据清洗流程、打分过程和模型贡献分解
 * NOTE: 通过全局状态或localStorage获取最新回测结果
 */
export default function AnalysisPage() {
  // NOTE: 从localStorage读取最新回测结果（由回测页面写入）
  const [result] = useState<BacktestResult | null>(() => {
    try {
      const saved = localStorage.getItem('latest_backtest_result')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())

  const toggleStep = (idx: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  if (!result) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">分析详情</h1>
          <p className="page-subtitle">查看数据清洗流程、情绪打分过程和各模型贡献分解</p>
        </div>
        <div className="card">
          <div className="empty-state">
            <LineChart size={56} style={{ opacity: 0.3, color: 'var(--color-accent)' }} />
            <p className="empty-state-text" style={{ fontSize: '16px', marginTop: 'var(--space-md)' }}>
              暂无分析数据
            </p>
            <p className="empty-state-hint">请先在「策略回测」页面执行一次回测，分析结果将自动展示在此页面</p>
          </div>
        </div>
      </div>
    )
  }

  const cleaningResult = result.cleaning_result
  const scoringDetails = result.scoring_details || []

  // 计算模型平均贡献
  const avgScores = result.sentiment_scores.reduce(
    (acc, s) => ({
      finbert: acc.finbert + Math.abs(s.finbert_score),
      arima: acc.arima + Math.abs(s.arima_score),
      garch: acc.garch + Math.abs(1 - s.garch_adjustment),
      lstm: acc.lstm + Math.abs(s.lstm_score),
    }),
    { finbert: 0, arima: 0, garch: 0, lstm: 0 }
  )
  const total = avgScores.finbert + avgScores.arima + avgScores.garch + avgScores.lstm || 1
  const contributions = {
    finbert: ((avgScores.finbert / total) * 100).toFixed(1),
    arima: ((avgScores.arima / total) * 100).toFixed(1),
    garch: ((avgScores.garch / total) * 100).toFixed(1),
    lstm: ((avgScores.lstm / total) * 100).toFixed(1),
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">分析详情</h1>
        <p className="page-subtitle">数据清洗流程、情绪打分过程和各模型贡献分解</p>
      </div>

      <div className="grid-2">
        {/* 左列：数据清洗流程 */}
        <div>
          <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="card-header">
              <span className="card-title"><Filter size={16} /> 数据清洗流程</span>
              <span className="badge badge-info">
                {cleaningResult.original_count} → {cleaningResult.final_count} 条
              </span>
            </div>

            {/* 清洗概览条 */}
            <div style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-md)', background: 'var(--color-bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: 'var(--space-sm)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>清洗保留率</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
                  {cleaningResult.original_count > 0
                    ? ((cleaningResult.final_count / cleaningResult.original_count) * 100).toFixed(1)
                    : 0}%
                </span>
              </div>
              <div style={{ height: '6px', background: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  width: `${cleaningResult.original_count > 0 ? (cleaningResult.final_count / cleaningResult.original_count) * 100 : 0}%`,
                  height: '100%',
                  background: 'var(--gradient-accent)',
                  borderRadius: '3px',
                }} />
              </div>
            </div>

            {/* 清洗步骤 */}
            <div className="flow-steps">
              {cleaningResult.steps.map((step: CleaningStep, idx: number) => (
                <div key={idx}>
                  <div
                    className="flow-step"
                    style={{ cursor: 'pointer' }}
                    onClick={() => toggleStep(idx)}
                  >
                    <div className="flow-step-number">{idx + 1}</div>
                    <div className="flow-step-content">
                      <div className="flow-step-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                        {step.step_name}
                        {expandedSteps.has(idx) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                      <div className="flow-step-desc">{step.description}</div>
                      <div className="flow-step-stats">
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          输入: <span style={{ color: 'var(--color-accent)' }}>{step.input_count}</span>
                        </span>
                        <span style={{ color: 'var(--color-text-muted)' }}>→</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          输出: <span style={{ color: 'var(--color-bear)' }}>{step.output_count}</span>
                        </span>
                        <span style={{ color: 'var(--color-bull)', fontSize: '11px' }}>
                          移除 {step.input_count - step.output_count} 条
                        </span>
                      </div>

                      {/* 展开的被移除数据详情 */}
                      {expandedSteps.has(idx) && step.removed_items.length > 0 && (
                        <div style={{ marginTop: 'var(--space-md)', maxHeight: '200px', overflowY: 'auto' }}>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-sm)' }}>
                            被移除的数据:
                          </div>
                          {step.removed_items.map((item: Record<string, unknown>, i: number) => (
                            <div
                              key={i}
                              style={{
                                padding: 'var(--space-sm)',
                                background: 'var(--color-bg-primary)',
                                borderRadius: 'var(--radius-sm)',
                                marginBottom: 'var(--space-xs)',
                                fontSize: '11px',
                                borderLeft: '2px solid var(--color-bull)',
                              }}
                            >
                              <div style={{ color: 'var(--color-text-secondary)' }}>{String(item.title || '')}</div>
                              <div style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                原因: {String(item._removal_reason || '未知')}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {idx < cleaningResult.steps.length - 1 && <div className="flow-connector" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右列：打分详情和模型贡献 */}
        <div>
          {/* 模型贡献分解 */}
          <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="card-header">
              <span className="card-title"><PieChart size={16} /> 模型贡献分解</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {[
                { name: 'FinBERT', pct: contributions.finbert, color: '#4f8eff', icon: '🧠' },
                { name: 'ARIMA', pct: contributions.arima, color: '#7c5cfc', icon: '📈' },
                { name: 'GARCH', pct: contributions.garch, color: '#f59e0b', icon: '📊' },
                { name: 'LSTM', pct: contributions.lstm, color: '#22c55e', icon: '🤖' },
              ].map(({ name, pct, color, icon }) => (
                <div key={name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                    <span>{icon} {name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color }}>{pct}%</span>
                  </div>
                  <div style={{ height: '10px', background: 'var(--color-border)', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: color,
                      borderRadius: '5px',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 每日情绪分数分解 */}
          <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="card-header">
              <span className="card-title"><Layers size={16} /> 每日情绪分数分解</span>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>综合分</th>
                    <th>FinBERT</th>
                    <th>ARIMA</th>
                    <th>GARCH</th>
                    <th>LSTM</th>
                    <th>共振</th>
                    <th>新闻数</th>
                  </tr>
                </thead>
                <tbody>
                  {result.sentiment_scores
                    .filter(s => s.contributing_news.length > 0 || s.score !== 0)
                    .slice(0, 100)
                    .map((s, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{s.date}</td>
                        <td>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                            color: s.score > 0 ? 'var(--color-bull)' : s.score < 0 ? 'var(--color-bear)' : 'var(--color-text-muted)',
                          }}>
                            {s.score > 0 ? '+' : ''}{s.score.toFixed(3)}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{s.finbert_score.toFixed(3)}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{s.arima_score.toFixed(3)}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{s.garch_adjustment.toFixed(2)}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{s.lstm_score.toFixed(3)}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>×{s.resonance_factor.toFixed(2)}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{s.contributing_news.length}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 打分详情 */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><Eye size={16} /> 新闻打分详情</span>
            </div>
            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
              {scoringDetails.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-state-text">无打分数据</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>新闻日期</th>
                      <th>目标日期</th>
                      <th>标题</th>
                      <th>原始分</th>
                      <th>衰减分</th>
                      <th>衰减天数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoringDetails.slice(0, 100).map((d: ScoringDetail, i: number) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{d.date}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{d.target_date}</td>
                        <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px' }}>
                          {d.title}
                        </td>
                        <td style={{
                          fontFamily: 'var(--font-mono)', fontSize: '11px',
                          color: d.raw_score > 0 ? 'var(--color-bull)' : 'var(--color-bear)',
                        }}>
                          {d.raw_score > 0 ? '+' : ''}{d.raw_score.toFixed(3)}
                        </td>
                        <td style={{
                          fontFamily: 'var(--font-mono)', fontSize: '11px',
                          color: d.decayed_score > 0 ? 'var(--color-bull)' : 'var(--color-bear)',
                        }}>
                          {d.decayed_score > 0 ? '+' : ''}{d.decayed_score.toFixed(3)}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                          {d.decay_days}天
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
