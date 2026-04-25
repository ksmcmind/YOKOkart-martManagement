import { useState, useRef } from 'react'
import { useDispatch } from 'react-redux'
import * as XLSX from 'xlsx'
import Modal from './Modal'
import Button from './Button'
import { showToast } from '../store/slices/uiSlice'

/**
 * Reusable Bulk Upload Modal
 * 
 * Props:
 * - open: boolean
 * - onClose: function
 * - onDone: function (called after successful upload)
 * - title: string
 * - schemaFields: string[] (order of columns in CSV/XLSX)
 * - fieldValidators: object (key: fieldName, value: function(val) => true | string)
 * - onUpload: function(payload) => Promise (should return results: { created, updated, errors })
 * - downloadCSVTemplate: function
 * - downloadXLSXTemplate: function
 * - groupRows: function(rows) => payload (optional, defaults to returning rows)
 * - previewComponent: React.Component (optional, custom preview UI)
 * - instructions: React.ReactNode (optional)
 */
export default function BulkUploadModal({
  open,
  onClose,
  onDone,
  title = "Bulk Upload",
  schemaFields = [],
  fieldValidators = {},
  onUpload,
  downloadCSVTemplate,
  downloadXLSXTemplate,
  groupRows = (rows) => rows,
  previewComponent: PreviewComponent,
  instructions,
}) {
  const dispatch = useDispatch()
  const [step, setStep] = useState('upload') // upload, header-error, row-error, preview, done
  const [loading, setLoading] = useState(false)
  const [rawRows, setRawRows] = useState([])
  const [headers, setHeaders] = useState([])
  const [headerErrors, setHeaderErrors] = useState({ missing: [], unknown: [] })
  const [rowErrors, setRowErrors] = useState([])
  const [payload, setPayload] = useState([])
  const [result, setResult] = useState(null)
  const [file, setFile] = useState(null)
  const fileRef = useRef()

  const reset = () => {
    setStep('upload')
    setRawRows([])
    setHeaders([])
    setHeaderErrors({ missing: [], unknown: [] })
    setRowErrors([])
    setPayload([])
    setResult(null)
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const normalizeHeader = h => {
    if (!h) return ''
    return h.toString()
      .trim()
      .toLowerCase()
      .replace(/^\uFEFF/, '')        // Remove BOM
      .replace(/[^a-z0-9]/g, '_')    // Replace all non-alphanumeric with _
      .replace(/_+/g, '_')           // Collapse multiple _
      .replace(/^_+|_+$/g, '')       // Trim leading/trailing _
  }

  const splitCSVLine = (line) => {
    const out = []; let cur = ''; let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (c === ',' && !inQuote) { out.push(cur); cur = '' }
      else cur += c
    }
    out.push(cur)
    return out.map(s => s.trim().replace(/^"|"$/g, ''))
  }

  const parseCSV = (text) => {
    const cleanText = text.replace(/^\uFEFF/, '')
    const lines = cleanText.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#'))
    if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row')
    const [headerLine, ...rows] = lines
    const headers = splitCSVLine(headerLine).map(normalizeHeader)
    return {
      headers,
      rows: rows.map(row => {
        const vals = splitCSVLine(row)
        return headers.reduce((obj, h, i) => ({ ...obj, [h]: vals[i] ?? '' }), {})
      }),
    }
  }

  const parseXLSX = (buffer) => {
    const wb = XLSX.read(buffer, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    if (raw.length < 2) throw new Error('XLSX must have a header row and at least one data row')
    const headers = raw[0].map(h => normalizeHeader(h))
    const rows = raw.slice(1)
      .filter(r => r.some(c => String(c).trim()))
      .map(r => headers.reduce((obj, h, i) => ({ ...obj, [h]: String(r[i] ?? '') }), {}))
    return { headers, rows }
  }

  const validateRows = (headers, rows) => {
    const missing = schemaFields.filter(c => !headers.includes(c))
    const unknown = headers.filter(h => !schemaFields.includes(h))
    const headerOk = missing.length === 0

    const rowErrors = []
    if (headerOk) {
      rows.forEach((row, idx) => {
        schemaFields.forEach(col => {
          const raw = (row[col] ?? '').toString()
          if (fieldValidators[col]) {
            const result = fieldValidators[col](raw)
            if (result !== true) {
              rowErrors.push({ row: idx + 2, column: col, value: raw, reason: result })
            }
          }
        })
      })
    }

    return { ok: headerOk && rowErrors.length === 0, headerErrors: { missing, unknown }, rowErrors }
  }

  const processData = ({ headers: h, rows: r }) => {
    setHeaders(h); setRawRows(r)
    const { headerErrors: hErr } = validateRows(h, r)
    setHeaderErrors(hErr)
    
    if (hErr.missing.length) { 
      setStep('header-error')
      setLoading(false)
      return 
    }

    setPayload(groupRows(r))
    setStep('preview')
    setLoading(false)
  }

  const handleFile = (f) => {
    try {
      if (!f) return
      setFile(f)
      const name = f.name.toLowerCase()
      const isCSV = name.endsWith('.csv')
      const isXLSX = name.endsWith('.xlsx') || name.endsWith('.xls')
      
      if (!isCSV && !isXLSX) {
        dispatch(showToast({ message: 'Only .csv or .xlsx files accepted', type: 'error' }))
        return
      }

      setLoading(true)
      const reader = new FileReader()

      if (isCSV) {
        reader.onload = e => {
          try {
            const data = parseCSV(e.target.result)
            processData(data)
          } catch (err) {
            dispatch(showToast({ message: `CSV Error: ${err.message}`, type: 'error' }))
            setLoading(false)
          }
        }
        reader.readAsText(f)
      } else {
        reader.onload = e => {
          try {
            const data = parseXLSX(new Uint8Array(e.target.result))
            processData(data)
          } catch (err) {
            dispatch(showToast({ message: `XLSX Error: ${err.message}`, type: 'error' }))
            setLoading(false)
          }
        }
        reader.readAsArrayBuffer(f)
      }
    } catch (err) {
      dispatch(showToast({ message: 'Error opening file', type: 'error' }))
      setLoading(false)
    }
  }

  const handleUpload = async () => {
    setLoading(true)
    try {
      const res = await onUpload(payload, file)
      setResult(res)
      setStep('done')
      if (onDone) onDone()
    } catch (err) {
      dispatch(showToast({ message: err.message || 'Upload failed', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <Modal
      title={title}
      open={open} onClose={handleClose} size="xl"
      footer={
        <div className="flex justify-between items-center w-full">
          <div className="flex gap-4">
            {downloadCSVTemplate && (
              <button onClick={downloadCSVTemplate} className="text-[11px] font-bold text-primary-600 hover:underline uppercase tracking-wider">⬇ CSV Template</button>
            )}
            {downloadXLSXTemplate && (
              <button onClick={downloadXLSXTemplate} className="text-[11px] font-bold text-primary-600 hover:underline uppercase tracking-wider">⬇ XLSX Template</button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleClose} disabled={loading}>Cancel</Button>
            {step === 'preview' && (
              <Button variant="primary" onClick={handleUpload} loading={loading}>
                Upload {payload.length} Item{payload.length !== 1 ? 's' : ''}
              </Button>
            )}
            {step === 'done' && <Button variant="primary" onClick={handleClose}>Done</Button>}
          </div>
        </div>
      }
    >
      {step === 'upload' && (
        <div className="flex flex-col gap-4 py-6">
          <div
            className={`border-2 border-dashed rounded-2xl py-16 flex flex-col items-center gap-4 transition-all duration-200 ${
              loading ? 'bg-gray-50 border-gray-200 cursor-wait' : 'border-gray-200 bg-white hover:border-primary-400 hover:bg-primary-50 cursor-pointer'
            }`}
            onClick={() => !loading && fileRef.current.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); if(!loading) handleFile(e.dataTransfer.files[0]) }}
          >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-2 ${loading ? 'bg-gray-100' : 'bg-primary-50'}`}>
              {loading ? '⏳' : '📂'}
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-gray-800">Drop CSV or XLSX here</p>
              <p className="text-sm text-gray-400 mt-1">or click to browse from your computer</p>
            </div>
            {!loading && <Button variant="secondary" size="sm" className="mt-2">Select File</Button>}
          </div>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => handleFile(e.target.files[0])} />
        </div>
      )}

      {step === 'header-error' && (
        <div className="py-6 flex flex-col gap-4 text-center">
          <div className="text-4xl mb-2">⚠️</div>
          <h3 className="text-lg font-bold text-red-600">Column header mismatch</h3>
          <p className="text-sm text-gray-500">The following columns are missing from your file:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {headerErrors.missing.map(c => (
              <span key={c} className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold">{c}</span>
            ))}
          </div>
          <Button variant="secondary" onClick={reset} className="mx-auto mt-4">Try Again</Button>
        </div>
      )}

      {step === 'preview' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">{payload.length} items ready to upload</p>
            <button onClick={reset} className="text-xs text-gray-400 hover:text-red-500">✕ Change file</button>
          </div>
          <div className="overflow-x-auto max-h-80 border border-gray-100 rounded-lg">
            <table className="table text-xs w-full">
              <thead className="bg-gray-50 sticky top-0 text-left">
                <tr>
                  {schemaFields.slice(0, 8).map(f => <th key={f}>{f}</th>)}
                </tr>
              </thead>
              <tbody>
                {payload.slice(0, 10).map((item, i) => (
                  <tr key={i}>
                    {schemaFields.slice(0, 8).map(f => (
                      <td key={f} className="truncate max-w-[150px]">{String(item[f] || '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="py-10 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl">✓</div>
          <h3 className="text-lg font-bold text-gray-800">Upload Complete</h3>
          <p className="text-sm text-gray-500">{result?.created || 0} created, {result?.updated || 0} updated.</p>
        </div>
      )}
    </Modal>
  )
}
