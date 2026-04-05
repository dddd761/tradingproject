import { useState } from 'react'
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom'
import { BarChart3, Database, Settings, LineChart, Activity, Menu, X } from 'lucide-react'
import BacktestPage from './pages/backtest/BacktestPage'
import DataManagePage from './pages/data-manage/DataManagePage'
import SettingsPage from './pages/settings/SettingsPage'
import AnalysisPage from './pages/analysis/AnalysisPage'

/**
 * 应用主入口
 * 包含侧边栏导航和路由
 */
function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const apiUrl = localStorage.getItem('API_URL') || ''

  const handleSetApiUrl = () => {
    const url = prompt('请输入您的云端(Hugging Face)后端 API 地址 \n例: https://my-user-space.hf.space', apiUrl)
    if (url !== null) {
      localStorage.setItem('API_URL', url)
      window.location.reload()
    }
  }

  return (
    <HashRouter>
      <div className={`app-layout ${isSidebarOpen ? 'sidebar-active' : ''}`}>
        <button 
          className="mobile-toggle"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <div className="sidebar-logo-icon">
                <Activity size={20} />
              </div>
              <div>
                <div className="sidebar-logo-text">A股回测系统</div>
                <div className="sidebar-logo-sub">另类数据驱动</div>
              </div>
            </div>
          </div>
          <nav className="sidebar-nav">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <BarChart3 size={18} />
              策略回测
            </NavLink>
            <NavLink
              to="/data"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <Database size={18} />
              数据管理
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <Settings size={18} />
              参数调节
            </NavLink>
            <NavLink
              to="/analysis"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <LineChart size={18} />
              分析详情
            </NavLink>
          </nav>
          <div style={{ padding: 'var(--space-md)', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
              模型: FinBERT+ARIMA+LSTM
            </div>
            <button 
              onClick={handleSetApiUrl}
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', fontSize: '10px', padding: '6px' }}
            >
              🔗 {apiUrl ? '切换 API 地址' : '配置云端 API'}
            </button>
          </div>
        </aside>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<BacktestPage />} />
            <Route path="/data" element={<DataManagePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}

export default App
