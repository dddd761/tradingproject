export interface TradeSignal {
  date: string;
  type: 'buy' | 'sell';
  price: number;
  position: number;
}

export interface BacktestResult {
  dates: string[];
  k_lines: number[][]; // [open, close, low, high, volume]
  signals: TradeSignal[];
  positions: number[];
  win_rate: number;
  total_return: number;
  max_drawdown: number;
  total_trades?: number;
}

export interface BacktestRequest {
  stock_code: string;
  strategy_type: string;
  params: Record<string, any>;
  start_date: string;
  end_date: string;
  strategy_code?: string;
  event_data?: any[];
}
