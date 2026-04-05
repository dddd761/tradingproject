import { useState, useEffect, useCallback } from 'react'
import { Settings as SettingsIcon, Save, RotateCcw, Info, Zap, Brain, TrendingUp, BarChart3 } from 'lucide-react'
import { settingsApi } from '../../services/api'
import type { Settings } from '../../types'

/**
 * 参数调节页面
 * 展示所有模型公式和可调参数，支持实时修改
 */
export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  /** 加载设置 */
  useEffect(() => {
    settingsApi.get().then(res => {
      setSettings(res.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  /** 保存设置 */
  const handleSave = useCallback(async () => {
    if (!settings) return
    setSaving(true)
    try {
      await settingsApi.update(settings)
      setMessage('设置已保存')
      setTimeout(() => setMessage(''), 3000)
    } catch {
      setMessage('保存失败')
    } finally {
      setSaving(false)
    }
  }, [settings])

  /** 重置设置 */
  const handleReset = useCallback(async () => {
    try {
      const res = await settingsApi.reset()
      setSettings(res.data)
      setMessage('已重置为默认设置')
      setTimeout(() => setMessage(''), 3000)
    } catch {
      setMessage('重置失败')
    }
  }, [])

  /** 更新嵌套设置 */
  const updateSetting = useCallback((path: string, value: number | string) => {
    setSettings(prev => {
      if (!prev) return prev
      const next = JSON.parse(JSON.stringify(prev))
      const keys = path.split('.')
      let obj: Record<string, unknown> = next
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]] as Record<string, unknown>
      }
      obj[keys[keys.length - 1]] = value
      return next
    })
  }, [])

  if (loading || !settings) {
    return <div className="loading-overlay"><span className="loading-spinner" /> 加载中...</div>
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">参数调节</h1>
          <p className="page-subtitle">调整模型权重、衰减系数和交易参数，优化回测表现</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button className="btn btn-secondary" onClick={handleReset}>
            <RotateCcw size={14} /> 重置默认
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={14} /> {saving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </div>

      {message && (
        <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-md) var(--space-lg)', borderLeft: '3px solid var(--color-accent)' }}>
          {message}
        </div>
      )}

      <div className="grid-2">
        {/* 左列：模型权重和公式 */}
        <div>
          {/* 四模型权重 */}
          <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="card-header">
              <span className="card-title"><Brain size={16} /> 模型权重配置</span>
            </div>
            <div className="formula-card">
              <div className="formula-title">加权融合公式</div>
              <div className="formula-expression">
                Score = w₁·FinBERT + w₂·ARIMA + w₃·GARCH_adj + w₄·LSTM
              </div>
              <div className="formula-desc">
                四个模型的分数按权重融合为最终情绪分数。权重之和建议为1.0，但不强制。
                GARCH作为波动率调整因子作用于总分，高波动时自动降低信号置信度。
              </div>
            </div>
            <div className="formula-params">
              {[
                { key: 'finbert', label: 'FinBERT (NLP情绪)', icon: '🧠', desc: '基于金融预训练模型的文本情绪分析' },
                { key: 'arima', label: 'ARIMA (趋势预测)', icon: '📈', desc: '基于历史分数的线性趋势外推' },
                { key: 'garch', label: 'GARCH (波动率)', icon: '📊', desc: '波动率越高，信号置信度越低' },
                { key: 'lstm', label: 'LSTM (深度学习)', icon: '🤖', desc: '捕捉非线性时序模式' },
              ].map(({ key, label, icon, desc }) => (
                <div key={key} style={{ marginBottom: 'var(--space-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-xs)' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>{icon} {label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{desc}</span>
                  </div>
                  <div className="slider-container">
                    <input
                      type="range"
                      className="slider-input"
                      min={0} max={1} step={0.05}
                      value={settings.model_weights[key as keyof typeof settings.model_weights]}
                      onChange={(e) => updateSetting(`model_weights.${key}`, parseFloat(e.target.value))}
                    />
                    <span className="slider-value">
                      {settings.model_weights[key as keyof typeof settings.model_weights].toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
              <div style={{ padding: 'var(--space-sm) var(--space-md)', background: 'var(--color-bg-input)', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                权重总和: {(
                  settings.model_weights.finbert +
                  settings.model_weights.arima +
                  settings.model_weights.garch +
                  settings.model_weights.lstm
                ).toFixed(2)}
              </div>
            </div>
          </div>

          {/* 对数衰减 */}
          <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="card-header">
              <span className="card-title"><TrendingUp size={16} /> 对数衰减模型</span>
            </div>
            <div className="formula-card">
              <div className="formula-title">情绪衰减公式</div>
              <div className="formula-expression">
                Score(t) = Score₀ × max(0, 1 − α × ln(1 + t))
              </div>
              <div className="formula-desc">
                新闻情绪影响随时间对数递减。t 为新闻发布后的天数，α 为衰减速率系数。
                α 越大衰减越快，新闻影响持续时间越短。超过30天的新闻影响忽略不计。
              </div>
            </div>
            <div style={{ marginTop: 'var(--space-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-xs)' }}>
                <span style={{ fontSize: '13px', fontWeight: 500 }}>衰减系数 α</span>
              </div>
              <div className="slider-container">
                <input
                  type="range" className="slider-input"
                  min={0.05} max={1} step={0.05}
                  value={settings.decay_alpha}
                  onChange={(e) => updateSetting('decay_alpha', parseFloat(e.target.value))}
                />
                <span className="slider-value">{settings.decay_alpha.toFixed(2)}</span>
              </div>
              {/* 衰减曲线预览 */}
              <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)', background: 'var(--color-bg-input)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-sm)' }}>衰减曲线预览（初始分=1.0）</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '60px' }}>
                  {Array.from({ length: 20 }, (_, i) => {
                    const decay = Math.max(0, 1 - settings.decay_alpha * Math.log(1 + i))
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div
                          style={{
                            width: '100%',
                            height: `${Math.max(0, decay * 60)}px`,
                            background: decay > 0.5 ? 'var(--color-accent)' : decay > 0 ? 'var(--color-warning)' : 'var(--color-neutral)',
                            borderRadius: '2px 2px 0 0',
                            opacity: 0.7,
                            transition: 'height 0.3s ease',
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  <span>Day 0</span><span>Day 10</span><span>Day 19</span>
                </div>
              </div>
            </div>
          </div>

          {/* 共振效应 */}
          <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="card-header">
              <span className="card-title"><Zap size={16} /> 共振效应模型</span>
            </div>
            <div className="formula-card">
              <div className="formula-title">共振放大公式</div>
              <div className="formula-expression">
                Resonance = 1 + β × ln(n)
              </div>
              <div className="formula-desc">
                当同一时间窗口内存在多条同方向（同看涨或同看跌）新闻时，产生共振放大效应。
                n 为同方向新闻条数，β 为共振系数。β 越大，多条新闻的叠加效应越强。
              </div>
            </div>
            <div style={{ marginTop: 'var(--space-md)' }}>
              <div className="slider-container">
                <span style={{ fontSize: '13px', fontWeight: 500, minWidth: '90px' }}>共振系数 β</span>
                <input
                  type="range" className="slider-input"
                  min={0} max={2} step={0.1}
                  value={settings.resonance_beta}
                  onChange={(e) => updateSetting('resonance_beta', parseFloat(e.target.value))}
                />
                <span className="slider-value">{settings.resonance_beta.toFixed(1)}</span>
              </div>
              {/* 共振效果预览 */}
              <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)', background: 'var(--color-bg-input)', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-sm)' }}>共振倍数预览</div>
                {[1, 2, 3, 5, 8, 10].map(n => {
                  const resonance = n > 1 ? 1 + settings.resonance_beta * Math.log(n) : 1
                  return (
                    <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: '4px' }}>
                      <span style={{ width: '60px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>{n}条新闻</span>
                      <div style={{ flex: 1, height: '8px', background: 'var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(100, resonance / 3 * 100)}%`,
                          height: '100%',
                          background: 'var(--gradient-accent)',
                          borderRadius: '4px',
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)', minWidth: '45px' }}>×{resonance.toFixed(2)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 右列：交易参数和LLM配置 */}
        <div>
          {/* 交易参数 */}
          <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="card-header">
              <span className="card-title"><BarChart3 size={16} /> 交易参数</span>
            </div>

            <div className="form-group">
              <label className="form-label">买入阈值（情绪分 {'>'} 此值触发买入）</label>
              <div className="slider-container">
                <input
                  type="range" className="slider-input"
                  min={0} max={1} step={0.05}
                  value={settings.trade.buy_threshold}
                  onChange={(e) => updateSetting('trade.buy_threshold', parseFloat(e.target.value))}
                />
                <span className="slider-value" style={{ color: 'var(--color-bull)' }}>
                  +{settings.trade.buy_threshold.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">卖出阈值（情绪分 {'<'} 此值触发卖出）</label>
              <div className="slider-container">
                <input
                  type="range" className="slider-input"
                  min={-1} max={0} step={0.05}
                  value={settings.trade.sell_threshold}
                  onChange={(e) => updateSetting('trade.sell_threshold', parseFloat(e.target.value))}
                />
                <span className="slider-value" style={{ color: 'var(--color-bear)' }}>
                  {settings.trade.sell_threshold.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">每日仓位比例</label>
              <div className="slider-container">
                <input
                  type="range" className="slider-input"
                  min={0.01} max={1} step={0.01}
                  value={settings.trade.daily_position_ratio}
                  onChange={(e) => updateSetting('trade.daily_position_ratio', parseFloat(e.target.value))}
                />
                <span className="slider-value">
                  {(settings.trade.daily_position_ratio * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">初始资金（元）</label>
                <input
                  type="number" className="form-input"
                  value={settings.trade.initial_capital}
                  onChange={(e) => updateSetting('trade.initial_capital', parseInt(e.target.value) || 1000000)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">佣金费率</label>
                <input
                  type="number" className="form-input" step="0.0001"
                  value={settings.trade.commission_rate}
                  onChange={(e) => updateSetting('trade.commission_rate', parseFloat(e.target.value) || 0.0003)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">滑点</label>
              <input
                type="number" className="form-input" step="0.001"
                value={settings.trade.slippage}
                onChange={(e) => updateSetting('trade.slippage', parseFloat(e.target.value) || 0.001)}
              />
            </div>
          </div>

          {/* 数据清洗参数 */}
          <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="card-header">
              <span className="card-title"><SettingsIcon size={16} /> 数据清洗参数</span>
            </div>

            <div className="form-group">
              <label className="form-label">去重相似度阈值</label>
              <div className="slider-container">
                <input
                  type="range" className="slider-input"
                  min={0.5} max={1} step={0.05}
                  value={settings.cleaning.dedup_similarity_threshold}
                  onChange={(e) => updateSetting('cleaning.dedup_similarity_threshold', parseFloat(e.target.value))}
                />
                <span className="slider-value">{settings.cleaning.dedup_similarity_threshold.toFixed(2)}</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">最低相关性分数</label>
              <div className="slider-container">
                <input
                  type="range" className="slider-input"
                  min={0} max={1} step={0.05}
                  value={settings.cleaning.relevance_min_score}
                  onChange={(e) => updateSetting('cleaning.relevance_min_score', parseFloat(e.target.value))}
                />
                <span className="slider-value">{settings.cleaning.relevance_min_score.toFixed(2)}</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">最小内容长度（字）</label>
              <input
                type="number" className="form-input"
                value={settings.cleaning.min_content_length}
                onChange={(e) => updateSetting('cleaning.min_content_length', parseInt(e.target.value) || 10)}
              />
            </div>
          </div>

          {/* LLM配置 */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><Brain size={16} /> LLM 配置（预留接口）</span>
            </div>
            <div style={{ padding: 'var(--space-md)', background: 'var(--color-bg-input)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-md)', fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-sm)' }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>当前使用基于规则的情绪分析引擎。接入LLM后可实现更智能的数据去噪清洗和情绪判断。支持OpenAI API或本地Ollama部署。</span>
            </div>
            <div className="form-group">
              <label className="form-label">LLM 服务商</label>
              <select
                className="form-select"
                value={settings.llm.provider}
                onChange={(e) => updateSetting('llm.provider', e.target.value)}
              >
                <option value="none">未接入（使用规则引擎）</option>
                <option value="openai">OpenAI API</option>
                <option value="ollama">本地 Ollama</option>
              </select>
            </div>
            {settings.llm.provider !== 'none' && (
              <>
                <div className="form-group">
                  <label className="form-label">API Key / 地址</label>
                  <input
                    type="password"
                    className="form-input"
                    value={settings.llm.api_key}
                    onChange={(e) => updateSetting('llm.api_key', e.target.value)}
                    placeholder={settings.llm.provider === 'ollama' ? '无需API Key' : '输入API Key'}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">模型名称</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.llm.model_name}
                    onChange={(e) => updateSetting('llm.model_name', e.target.value)}
                    placeholder={settings.llm.provider === 'ollama' ? 'qwen2.5:7b' : 'gpt-4'}
                  />
                </div>
                {settings.llm.provider === 'ollama' && (
                  <div className="form-group">
                    <label className="form-label">Ollama 地址</label>
                    <input
                      type="text"
                      className="form-input"
                      value={settings.llm.base_url || 'http://localhost:11434'}
                      onChange={(e) => updateSetting('llm.base_url', e.target.value)}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
