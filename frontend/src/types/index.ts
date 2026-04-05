/**
 * API 服务类型定义
 */

export interface KlineDataPoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface AlternativeDataItem {
  id?: string
  stock_code: string
  date: string
  title: string
  content: string
  source: string
  category: string
  impact_level?: number | null
}

export interface SentimentScore {
  date: string
  score: number
  finbert_score: number
  arima_score: number
  garch_adjustment: number
  lstm_score: number
  contributing_news: ContributingNews[]
  resonance_factor: number
}

export interface ContributingNews {
  id: string
  title: string
  date: string
  raw_score: number
  decayed_score: number
  decay_days: number
  decay_factor: number
}

export interface TradeAction {
  date: string
  action: 'BUY' | 'SELL' | 'HOLD'
  price: number
  shares: number
  amount: number
  reason: string
  sentiment_score: number
}

export interface CleaningStep {
  step_name: string
  description: string
  input_count: number
  output_count: number
  removed_items: Record<string, unknown>[]
  params: Record<string, unknown>
}

export interface CleaningResult {
  steps: CleaningStep[]
  original_count: number
  final_count: number
  cleaned_data: AlternativeDataItem[]
}

export interface BacktestResult {
  kline_data: KlineDataPoint[]
  sentiment_scores: SentimentScore[]
  trades: TradeAction[]
  total_return: number
  annualized_return: number
  max_drawdown: number
  win_rate: number
  sharpe_ratio: number
  total_trades: number
  profitable_trades: number
  initial_capital: number
  final_capital: number
  cleaning_result: CleaningResult
  scoring_details: ScoringDetail[]
}

export interface ScoringDetail {
  news_id: string
  title: string
  date: string
  target_date: string
  raw_score: number
  decayed_score: number
  decay_days: number
}

export interface Settings {
  model_weights: {
    finbert: number
    arima: number
    garch: number
    lstm: number
  }
  decay_alpha: number
  resonance_beta: number
  trade: {
    buy_threshold: number
    sell_threshold: number
    daily_position_ratio: number
    initial_capital: number
    commission_rate: number
    slippage: number
  }
  cleaning: {
    dedup_similarity_threshold: number
    relevance_min_score: number
    min_content_length: number
  }
  llm: {
    provider: string
    api_key: string
    model_name: string
    base_url: string
  }
}
