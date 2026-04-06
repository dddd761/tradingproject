import * as XLSX from 'xlsx'
import { useState, useCallback, useRef, useEffect } from 'react'
import { Upload, FileText, Trash2, Plus, Download, Search, Edit3, X, Check, Shield } from 'lucide-react'
import { alternativeDataApi } from '../../services/api'
import type { AlternativeDataItem } from '../../types'

/**
 * 数据管理页面
 * 支持CSV/JSON导入、本地隐私存储、数据浏览、编辑和删除
 */
export default function DataManagePage() {
  const [stockCode, setStockCode] = useState('301308')
  const [data, setData] = useState<AlternativeDataItem[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [dragActive, setDragActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<AlternativeDataItem>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<Partial<AlternativeDataItem>>({
    date: '', title: '', content: '', source: '手动添加', category: '新闻', impact_level: 3,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  /** 加载数据 (合并云端和本地) */
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. 加载云端公开数据 (选填)
      let combinedData: AlternativeDataItem[] = []
      try {
        const res = await alternativeDataApi.getByStock(stockCode)
        combinedData = [...res.data]
      } catch (e) {
        console.warn("Cloud data unavailable")
      }

      // 2. 加载本地隐私数据
      const localKey = `local_alt_data_${stockCode}`
      const localDataStr = localStorage.getItem(localKey)
      if (localDataStr) {
        const localData = JSON.parse(localDataStr) as AlternativeDataItem[]
        // 标记为本地隐私数据
        const markedLocal = localData.map(d => ({ ...d, source: `🏠 本地隐私: ${d.source}` }))
        combinedData = [...markedLocal, ...combinedData]
      }

      setData(combinedData)
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '加载失败' })
    } finally {
      setLoading(false)
    }
  }, [stockCode])

  // 初始加载
  useEffect(() => {
    loadData()
  }, [loadData])

  /** 本地解析 Excel 并存入隐私仓库 */
  const handleFileUpload = useCallback(async (file: File) => {
    const fileNameLower = file.name.toLowerCase()
    const isExcel = fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls')
    const isJson = fileNameLower.endsWith('.json')
    const isCsv = fileNameLower.endsWith('.csv')

    if (!isCsv && !isJson && !isExcel) {
      setMessage({ type: 'error', text: '仅支持 CSV, XLSX 和 JSON 格式文件' })
      return
    }

    setLoading(true)
    try {
      if (isExcel || isCsv) {
        // --- 本地隐私解析逻辑 (Excel/CSV) ---
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const binaryStr = e.target?.result
            const workbook = XLSX.read(binaryStr, { type: 'binary' })
            const sheetName = workbook.SheetNames[0]
            const sheet = workbook.Sheets[sheetName]
            const rawData = XLSX.utils.sheet_to_json(sheet) as any[]

            // 映射列名适配 A股另类数据 Excel/CSV
            const mappedItems: AlternativeDataItem[] = rawData.map((row, idx) => ({
              id: `local_${Date.now()}_${idx}`,
              stock_code: stockCode,
              date: row['证据时间'] || row['日期'] || row['date'] || '',
              title: row['来源文章'] || row['标题'] || row['title'] || '无标题',
              content: row['证据文本'] || row['内容'] || row['content'] || '',
              source: row['所属案件-案由'] || row['来源'] || row['source'] || '本地上传',
              category: row['分类'] || row['category'] || '新闻',
              impact_level: row['影响等级'] || row['impact_level'] || null
            }))

            // 存入本地 LocalStorage
            const localKey = `local_alt_data_${stockCode}`
            const existingStr = localStorage.getItem(localKey)
            const existing = existingStr ? JSON.parse(existingStr) : []
            localStorage.setItem(localKey, JSON.stringify([...mappedItems, ...existing]))

            setMessage({ type: 'success', text: `本地隐私导入成功: ${mappedItems.length} 条` })
            loadData()
          } catch (err) {
            setMessage({ type: 'error', text: '文件解析失败' })
          }
        }
        reader.readAsBinaryString(file)
      } else if (isJson) {
        // --- 本地隐私解析逻辑 (JSON) ---
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const textStr = e.target?.result as string
            const rawData = JSON.parse(textStr)
            const items = Array.isArray(rawData) ? rawData : (rawData.items || [])
            const mappedItems: AlternativeDataItem[] = items.map((row: any, idx: number) => ({
              id: `local_${Date.now()}_${idx}`,
              stock_code: stockCode,
              date: row['date'] || row['日期'] || '',
              title: row['title'] || row['标题'] || '无标题',
              content: row['content'] || row['内容'] || '',
              source: row['source'] || row['来源'] || '本地上传',
              category: row['category'] || row['分类'] || '新闻',
              impact_level: row['impact_level'] || row['影响等级'] || null
            }))

            // 存入本地 LocalStorage
            const localKey = `local_alt_data_${stockCode}`
            const existingStr = localStorage.getItem(localKey)
            const existing = existingStr ? JSON.parse(existingStr) : []
            localStorage.setItem(localKey, JSON.stringify([...mappedItems, ...existing]))

            setMessage({ type: 'success', text: `本地隐私导入成功: ${mappedItems.length} 条` })
            loadData()
          } catch (err) {
            setMessage({ type: 'error', text: 'JSON文件解析失败' })
          }
        }
        reader.readAsText(file)
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '导入设置失败' })
    } finally {
      setLoading(false)
    }
  }, [stockCode, loadData])

  /** 拖拽处理 */
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0])
  }, [handleFileUpload])

  /** 删除数据 (支持云端和本地隐私数据) */
  const handleDelete = useCallback(async (itemId: string) => {
    try {
      if (itemId.startsWith('local_')) {
        // --- 删除本地隐私数据 ---
        const localKey = `local_alt_data_${stockCode}`
        const localDataStr = localStorage.getItem(localKey)
        if (localDataStr) {
          const localData = JSON.parse(localDataStr) as AlternativeDataItem[]
          const filtered = localData.filter(d => d.id !== itemId)
          localStorage.setItem(localKey, JSON.stringify(filtered))
          setData(prev => prev.filter(d => d.id !== itemId))
          setMessage({ type: 'success', text: '本地隐私条目已删除' })
        }
      } else {
        // --- 删除云端公开数据 ---
        await alternativeDataApi.delete(stockCode, itemId)
        setData(prev => prev.filter(d => d.id !== itemId))
        setMessage({ type: 'success', text: '云端公开条目已删除' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: '删除失败: ' + (err instanceof Error ? err.message : '未知错误') })
    }
  }, [stockCode])

  /** 编辑保存 */
  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return
    try {
      await alternativeDataApi.update(stockCode, editingId, editForm)
      setData(prev => prev.map(d => d.id === editingId ? { ...d, ...editForm } : d))
      setEditingId(null)
      setMessage({ type: 'success', text: '更新成功' })
    } catch (err) {
      setMessage({ type: 'error', text: '更新失败' })
    }
  }, [stockCode, editingId, editForm])

  /** 添加单条数据 */
  const handleAddSingle = useCallback(async () => {
    try {
      await alternativeDataApi.addSingle({
        ...addForm,
        stock_code: stockCode,
      } as AlternativeDataItem)
      setShowAddForm(false)
      setAddForm({ date: '', title: '', content: '', source: '手动添加', category: '新闻', impact_level: 3 })
      setMessage({ type: 'success', text: '添加成功' })
      loadData()
    } catch (err) {
      setMessage({ type: 'error', text: '添加失败' })
    }
  }, [stockCode, addForm, loadData])

  /** 下载模板 */
  const handleDownloadTemplate = useCallback(() => {
    const csv = 'date,title,content,source,category,impact_level\n2024-01-15,某公司发布利好公告,公司与知名企业签署战略合作协议...,新浪财经,新闻,4\n2024-01-20,央行降息政策出台,中国人民银行宣布下调利率...,央行官网,政策,5'
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'alternative_data_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  // 过滤数据
  const filteredData = data.filter(item =>
    !searchQuery ||
    item.title.includes(searchQuery) ||
    item.content.includes(searchQuery) ||
    item.date.includes(searchQuery)
  )

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">数据管理</h1>
        <p className="page-subtitle">导入和管理用于情绪分析的另类数据（新闻、政策、公告等）</p>
      </div>

      {/* 消息提示 */}
      {message.text && (
        <div
          className={`card ${message.type === 'error' ? 'toast-error' : 'toast-success'}`}
          style={{ marginBottom: 'var(--space-md)', borderLeft: `3px solid ${message.type === 'error' ? 'var(--color-bull)' : 'var(--color-bear)'}`, padding: 'var(--space-md) var(--space-lg)', cursor: 'pointer' }}
          onClick={() => setMessage({ type: '', text: '' })}
        >
          {message.text}
        </div>
      )}

      {/* 股票代码 + 操作栏 */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">股票代码</label>
            <input
              id="data-stock-code"
              type="text"
              className="form-input"
              value={stockCode}
              onChange={(e) => setStockCode(e.target.value)}
              placeholder="如 000001"
              style={{ width: '140px' }}
            />
          </div>
          <button className="btn btn-primary" onClick={loadData} disabled={loading}>
            <Search size={14} /> 加载数据
          </button>
          <button className="btn btn-secondary" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus size={14} /> 手动添加
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              if (window.confirm(`确定要清空股票 ${stockCode} 的本地隐私数据吗？这不会影响云端公开数据。`)) {
                localStorage.removeItem(`local_alt_data_${stockCode}`)
                loadData()
                setMessage({ type: 'success', text: '本地隐私数据已清空' })
              }
            }}
            style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: 'var(--color-bull)' }}
          >
            <Trash2 size={14} /> 清空本地
          </button>
          <button className="btn btn-secondary" onClick={handleDownloadTemplate}>
            <Download size={14} /> 下载模板
          </button>
        </div>
      </div>

      {/* 手动添加表单 */}
      {showAddForm && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="card-header">
            <span className="card-title"><Plus size={16} /> 手动添加数据</span>
            <button className="btn btn-sm btn-secondary" onClick={() => setShowAddForm(false)}><X size={14} /></button>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">日期</label>
              <input type="date" className="form-input" value={addForm.date} onChange={(e) => setAddForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">来源</label>
              <input type="text" className="form-input" value={addForm.source} onChange={(e) => setAddForm(p => ({ ...p, source: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">分类</label>
              <select className="form-select" value={addForm.category} onChange={(e) => setAddForm(p => ({ ...p, category: e.target.value }))}>
                <option value="新闻">新闻</option>
                <option value="政策">政策</option>
                <option value="公告">公告</option>
                <option value="其他">其他</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">影响等级 (1-5)</label>
              <input type="number" className="form-input" min={1} max={5} value={addForm.impact_level ?? 3} onChange={(e) => setAddForm(p => ({ ...p, impact_level: parseInt(e.target.value) }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">标题</label>
            <input type="text" className="form-input" value={addForm.title} onChange={(e) => setAddForm(p => ({ ...p, title: e.target.value }))} placeholder="输入新闻标题" />
          </div>
          <div className="form-group">
            <label className="form-label">正文内容</label>
            <textarea className="form-input" rows={3} value={addForm.content} onChange={(e) => setAddForm(p => ({ ...p, content: e.target.value }))} placeholder="输入新闻正文..." style={{ resize: 'vertical' }} />
          </div>
          <button className="btn btn-primary" onClick={handleAddSingle} disabled={!addForm.date || !addForm.title}>
            <Check size={14} /> 确认添加
          </button>
        </div>
      )}

      <div className="grid-2" style={{ gridTemplateColumns: '1fr 2fr' }}>
        {/* 文件上传区 */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Upload size={16} /> 导入数据</span>
          </div>
          <div
            className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="upload-zone-icon">📁</div>
            <div className="upload-zone-text">拖拽文件到此处或点击选择</div>
            <div className="upload-zone-hint">支持 CSV, XLSX 和 JSON 格式</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
          </div>
          <div style={{ marginTop: 'var(--space-lg)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            <strong>支持格式：</strong>
            <br />• <strong>CSV/Excel</strong>: 需包含日期、标题、正文等列
            <br />• <strong>JSON</strong>: 数组或 {'{'}"items": [...]{'}'} 格式
            <br /><br />
            <strong>特别适配：</strong>
            <br />已支持“证据时间、来源文章、证据文本”等导出格式
          </div>
        </div>

        {/* 数据列表 */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><FileText size={16} /> 已有数据 ({filteredData.length})</span>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="搜索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '180px', fontSize: '12px', padding: '6px 12px' }}
              />
            </div>
          </div>
          {loading ? (
            <div className="loading-overlay"><span className="loading-spinner" /> 加载中...</div>
          ) : filteredData.length === 0 ? (
            <div className="empty-state">
              <FileText size={36} style={{ opacity: 0.3 }} />
              <p className="empty-state-text">暂无数据</p>
              <p className="empty-state-hint">请先点击"加载数据"或导入文件</p>
            </div>
          ) : (
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>标题</th>
                    <th>分类</th>
                    <th>影响</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{item.date}</td>
                      <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {editingId === item.id ? (
                          <input
                            className="form-input"
                            value={editForm.title || ''}
                            onChange={(e) => setEditForm(p => ({ ...p, title: e.target.value }))}
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                          />
                        ) : (
                          item.title
                        )}
                      </td>
                      <td><span className="badge badge-info">{item.category}</span></td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{item.impact_level || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                          {editingId === item.id ? (
                            <>
                              <button className="btn btn-sm btn-primary" onClick={handleSaveEdit}><Check size={12} /></button>
                              <button className="btn btn-sm btn-secondary" onClick={() => setEditingId(null)}><X size={12} /></button>
                            </>
                          ) : (
                            <>
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => { setEditingId(item.id || null); setEditForm(item) }}
                              >
                                <Edit3 size={12} />
                              </button>
                              <button className="btn btn-sm btn-danger" onClick={() => item.id && handleDelete(item.id)}>
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
