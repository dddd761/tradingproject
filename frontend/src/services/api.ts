/**
 * API 服务封装
 * 统一管理所有后端API调用
 */
import type { BacktestResult, Settings, AlternativeDataItem } from '../types'

// 在应用中，如果部署到 Netlify，优先检查 localStorage 是否有手动设置的 API 地址
// 这样您可以在手机打开网页后，随时点击左下角的“配置 API”按钮连接到您的云端(Hugging Face)后端
const getBaseUrl = () => {
  // 1. 优先检查环境变量 (由 Vite 注入，适用于打包部署)
  const envUrl = import.meta.env.VITE_API_BASE_URL
  if (envUrl) return `${envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl}/api`

  // 2. 检查 localStorage 是否有手动设置的 API 地址 (适用于手机端手动配置)
  const savedUrl = localStorage.getItem('API_URL')
  if (savedUrl) return `${savedUrl.endsWith('/') ? savedUrl.slice(0, -1) : savedUrl}/api`

  // 3. 开发环境
  if (import.meta.env.DEV) return 'http://localhost:8000/api'

  // 4. 生产环境默认使用相对路径 (利用 Netlify _redirects 代理或原域部署)
  return window.location.origin + '/api'
}

const BASE_URL = getBaseUrl()

/**
 * 通用请求封装
 */
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: '请求失败' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  return response.json()
}

/** 股票数据API */
export const stockApi = {
  getKline: (code: string, startDate: string, endDate: string) =>
    request<{ code: number; data: unknown[] }>(
      `/stock/${code}/kline?start_date=${startDate}&end_date=${endDate}`
    ),
}

/** 另类数据API */
export const alternativeDataApi = {
  getByStock: (stockCode: string) =>
    request<{ code: number; data: AlternativeDataItem[]; total: number }>(
      `/alternative-data/${stockCode}`
    ),

  importFile: async (stockCode: string, file: File) => {
    const formData = new FormData()
    formData.append('stock_code', stockCode)
    formData.append('file', file)
    const response = await fetch(`${BASE_URL}/alternative-data/import`, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: '导入失败' }))
      throw new Error(error.detail || '导入失败')
    }
    return response.json()
  },

  addSingle: (item: AlternativeDataItem) =>
    request<{ code: number; message: string }>('/alternative-data/add', {
      method: 'POST',
      body: JSON.stringify(item),
    }),

  delete: (stockCode: string, itemId: string) =>
    request<{ code: number; message: string }>(
      `/alternative-data/${stockCode}/${itemId}`,
      { method: 'DELETE' }
    ),

  update: (stockCode: string, itemId: string, updates: Partial<AlternativeDataItem>) =>
    request<{ code: number; data: AlternativeDataItem }>(
      `/alternative-data/${stockCode}/${itemId}`,
      { method: 'PUT', body: JSON.stringify(updates) }
    ),

  getTemplate: () =>
    request<{ code: number; template: string; columns: Record<string, string> }>(
      '/alternative-data/template/csv'
    ),
}

/** 回测API */
export const backtestApi = {
  run: (stockCode: string, startDate: string, endDate: string, alternativeData?: AlternativeDataItem[]) =>
    request<{ code: number; data: BacktestResult }>('/backtest/run', {
      method: 'POST',
      body: JSON.stringify({
        stock_code: stockCode,
        start_date: startDate,
        end_date: endDate,
        alternative_data: alternativeData,
      }),
    }),
}

/** 参数设置API */
export const settingsApi = {
  get: () => request<{ code: number; data: Settings }>('/settings/'),

  update: (updates: Partial<Settings>) =>
    request<{ code: number; data: Settings; message: string }>('/settings/', {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  reset: () =>
    request<{ code: number; data: Settings; message: string }>('/settings/reset', {
      method: 'POST',
    }),
}
