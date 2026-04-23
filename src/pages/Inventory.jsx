// src/pages/Inventory.jsx
// Features: table view, inline edit, drag-and-drop reorder, bulk CSV upload modal
// CSV validation: all required columns must exist before passing to backend

import { useEffect, useState, useRef, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { showToast } from '../store/slices/uiSlice'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Modal from '../components/Modal'
import Input, { Select } from '../components/Input'
import useAuth from '../hooks/useAuth'
import api from '../api/index'

const UNITS = ['kg', 'g', 'l', 'ml', 'pcs', 'dozen']

// All columns that MUST exist in the CSV
const REQUIRED_CSV_COLUMNS = [
    'mongo_product_id',
    'variant_id',
    'sale_price',
    'mrp',
    'stock_qty',
    'stock_unit',
    'low_stock_alert',
]

// Optional columns (passed if present, ignored if not)
const OPTIONAL_CSV_COLUMNS = [
    'expiry_date',
    'batch_number',
    'aisle_location',
    'is_active',
]

const ALL_CSV_COLUMNS = [...REQUIRED_CSV_COLUMNS, ...OPTIONAL_CSV_COLUMNS]

const EMPTY_FORM = {
    mongo_product_id: '',
    mongo_mart_id: '',
    variant_id: '',
    sale_price: '',
    mrp: '',
    stock_qty: '',
    stock_unit: 'kg',
    low_stock_alert: '10',
    expiry_date: '',
    batch_number: '',
    aisle_location: '',
    is_active: true,
}

// ── CSV parser ─────────────────────────────────────────────────────────────────
const parseCSV = (text) => {
    const [headerLine, ...rows] = text.trim().split('\n')
    const headers = headerLine.split(',').map(h => h.trim().toLowerCase().replace(/ /g, '_'))
    return {
        headers,
        rows: rows
            .filter(r => r.trim())
            .map(row => {
                const vals = row.split(',').map(v => v.trim())
                return headers.reduce((obj, h, i) => ({ ...obj, [h]: vals[i] || '' }), {})
            })
    }
}

// ── Download CSV template ──────────────────────────────────────────────────────
const downloadTemplate = () => {
    const sample = [
        ALL_CSV_COLUMNS.join(','),
        '64f1a2b3c4d5e6f7a8b9c0d1,variant-500g,49.00,55.00,100,kg,10,2025-12-31,BATCH-001,A3-Shelf2,true',
        '64f1a2b3c4d5e6f7a8b9c0d2,variant-1kg,89.00,99.00,50,kg,5,2025-06-30,BATCH-002,B1-Shelf1,true',
    ]
    const blob = new Blob([sample.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'inventory_template.csv'
    a.click()
}

// ── Inline editable cell ───────────────────────────────────────────────────────
function EditableCell({ value, type = 'text', options, onSave }) {
    const [editing, setEditing] = useState(false)
    const [val, setVal] = useState(value)
    const ref = useRef()

    useEffect(() => { if (editing && ref.current) ref.current.focus() }, [editing])

    const commit = () => { setEditing(false); if (val !== value) onSave(val) }

    if (editing) {
        if (options) return (
            <select ref={ref} value={val} onChange={e => setVal(e.target.value)} onBlur={commit}
                className="w-full text-xs border border-primary-400 rounded px-1 py-0.5 bg-white outline-none">
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        )
        return (
            <input ref={ref} type={type} value={val}
                onChange={e => setVal(e.target.value)}
                onBlur={commit}
                onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setVal(value); setEditing(false) } }}
                className="w-full text-xs border border-primary-400 rounded px-1 py-0.5 bg-white outline-none"
            />
        )
    }

    return (
        <span onClick={() => setEditing(true)}
            className="cursor-pointer hover:bg-primary-50 hover:text-primary-700 px-1 py-0.5 rounded transition-colors block w-full text-xs"
            title="Click to edit">
            {value ?? '—'}
        </span>
    )
}

// ── Stock badge ────────────────────────────────────────────────────────────────
function StockBadge({ qty, alert }) {
    if (qty <= 0) return <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-medium">Out</span>
    if (qty <= alert) return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">Low</span>
    return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">OK</span>
}

// ── Bulk Upload Modal ──────────────────────────────────────────────────────────
function BulkUploadModal({ open, onClose, martId, onDone, dispatch }) {
    const [step, setStep] = useState('upload')   // 'upload' | 'preview' | 'uploading' | 'done'
    const [csvRows, setCsvRows] = useState([])
    const [csvHeaders, setCsvHeaders] = useState([])
    const [missingCols, setMissingCols] = useState([])
    const [progress, setProgress] = useState(null) // { total, done }
    const [result, setResult] = useState(null)     // { created, errors }
    const fileRef = useRef()

    const reset = () => {
        setStep('upload'); setCsvRows([]); setCsvHeaders([])
        setMissingCols([]); setProgress(null); setResult(null)
        if (fileRef.current) fileRef.current.value = ''
    }

    const handleClose = () => { reset(); onClose() }

    // ── Read & validate CSV ──────────────────────────────────────────────────
    const handleFile = (file) => {
        if (!file) return
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const { headers, rows } = parseCSV(e.target.result)

                // Check all required columns exist
                const missing = REQUIRED_CSV_COLUMNS.filter(col => !headers.includes(col))
                setMissingCols(missing)
                setCsvHeaders(headers)
                setCsvRows(rows)

                if (missing.length === 0) {
                    setStep('preview')
                } else {
                    // Show error — don't proceed to preview
                    setStep('error')
                }
            } catch {
                dispatch(showToast({ message: 'Invalid CSV format', type: 'error' }))
            }
        }
        reader.readAsText(file)
    }

    // ── Build validated payload (only known columns) ─────────────────────────
    const buildPayload = () => csvRows.map(r => ({
        mongo_product_id: r.mongo_product_id || '',
        mongo_mart_id: martId,
        variant_id: r.variant_id || '',
        sale_price: parseFloat(r.sale_price) || 0,
        mrp: parseFloat(r.mrp) || 0,
        stock_qty: parseFloat(r.stock_qty) || 0,
        stock_unit: UNITS.includes(r.stock_unit) ? r.stock_unit : 'pcs',
        low_stock_alert: parseFloat(r.low_stock_alert) || 10,
        // Optional — only include if column was in CSV
        ...(csvHeaders.includes('expiry_date') && { expiry_date: r.expiry_date || null }),
        ...(csvHeaders.includes('batch_number') && { batch_number: r.batch_number || null }),
        ...(csvHeaders.includes('aisle_location') && { aisle_location: r.aisle_location || null }),
        ...(csvHeaders.includes('is_active') && { is_active: r.is_active !== 'false' }),
    }))

    // ── Upload ───────────────────────────────────────────────────────────────
    const handleUpload = async () => {
        const payload = buildPayload()
        setStep('uploading')
        setProgress({ total: payload.length, done: 0 })

        try {
            const res = await api.post('/inventory/bulk', { items: payload })
            setProgress({ total: payload.length, done: payload.length })

            if (res.success) {
                setResult({ created: res.data?.created ?? payload.length, errors: res.data?.errors || [] })
                setStep('done')
                onDone()
            } else {
                dispatch(showToast({ message: res.message || 'Bulk upload failed', type: 'error' }))
                setStep('preview')
            }
        } catch {
            dispatch(showToast({ message: 'Upload failed. Check connection.', type: 'error' }))
            setStep('preview')
        }
    }

    if (!open) return null

    return (
        <Modal
            title="Bulk Upload Inventory via CSV"
            open={open}
            onClose={handleClose}
            size="lg"
            footer={
                <div className="flex justify-between items-center w-full">
                    <button onClick={downloadTemplate}
                        className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                        ⬇ Download CSV Template
                    </button>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={handleClose}>Close</Button>
                        {step === 'preview' && (
                            <Button variant="primary" onClick={handleUpload}>
                                Upload {csvRows.length} Items
                            </Button>
                        )}
                        {step === 'error' && (
                            <Button variant="secondary" onClick={reset}>Try Again</Button>
                        )}
                        {step === 'done' && (
                            <Button variant="primary" onClick={handleClose}>Done</Button>
                        )}
                    </div>
                </div>
            }
        >
            {/* ── STEP: Upload ── */}
            {step === 'upload' && (
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                    <div
                        className="border-2 border-dashed border-gray-200 rounded-xl w-full py-14 flex flex-col items-center gap-3 cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
                        onClick={() => fileRef.current.click()}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
                    >
                        <span className="text-4xl">📂</span>
                        <p className="text-sm font-semibold text-gray-600">Drop CSV here or click to browse</p>
                        <p className="text-xs text-gray-400">Only .csv files accepted</p>
                    </div>
                    <input ref={fileRef} type="file" accept=".csv" className="hidden"
                        onChange={e => handleFile(e.target.files[0])} />

                    {/* Required columns info */}
                    <div className="w-full p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs font-semibold text-gray-500 mb-1">Required columns:</p>
                        <p className="text-xs font-mono text-gray-400 break-all">{REQUIRED_CSV_COLUMNS.join(', ')}</p>
                        <p className="text-xs font-semibold text-gray-500 mt-2 mb-1">Optional columns:</p>
                        <p className="text-xs font-mono text-gray-400 break-all">{OPTIONAL_CSV_COLUMNS.join(', ')}</p>
                    </div>
                </div>
            )}

            {/* ── STEP: Missing columns error ── */}
            {step === 'error' && (
                <div className="py-6 flex flex-col gap-4">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-sm font-bold text-red-700 mb-2">
                            ❌ CSV is missing {missingCols.length} required column{missingCols.length > 1 ? 's' : ''}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {missingCols.map(col => (
                                <span key={col} className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-mono font-semibold">
                                    {col}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Show which columns WERE found */}
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs font-semibold text-gray-500 mb-1">Columns found in your CSV:</p>
                        <div className="flex flex-wrap gap-1">
                            {csvHeaders.map(col => (
                                <span key={col}
                                    className={`px-2 py-0.5 rounded text-xs font-mono ${REQUIRED_CSV_COLUMNS.includes(col) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {col}
                                </span>
                            ))}
                        </div>
                    </div>

                    <p className="text-xs text-gray-400 text-center">
                        Fix your CSV and upload again, or download the template below.
                    </p>
                </div>
            )}

            {/* ── STEP: Preview ── */}
            {step === 'preview' && (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-700">
                            ✅ {csvRows.length} rows ready to upload
                        </p>
                        <button onClick={reset} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                            ✕ Change file
                        </button>
                    </div>

                    {/* Validation summary */}
                    <div className="flex flex-wrap gap-2">
                        {REQUIRED_CSV_COLUMNS.map(col => (
                            <span key={col} className="px-2 py-0.5 bg-green-50 border border-green-200 text-green-700 rounded text-xs font-mono">
                                ✓ {col}
                            </span>
                        ))}
                        {OPTIONAL_CSV_COLUMNS.filter(col => csvHeaders.includes(col)).map(col => (
                            <span key={col} className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-600 rounded text-xs font-mono">
                                ~ {col}
                            </span>
                        ))}
                    </div>

                    {/* Preview table (first 8 rows) */}
                    <div className="overflow-x-auto max-h-72 border border-gray-100 rounded-lg">
                        <table className="table text-xs w-full">
                            <thead>
                                <tr>
                                    <th className="text-gray-400 font-normal">#</th>
                                    {ALL_CSV_COLUMNS.filter(col => csvHeaders.includes(col)).map(h => (
                                        <th key={h} className={REQUIRED_CSV_COLUMNS.includes(h) ? 'text-gray-700' : 'text-gray-400'}>
                                            {h}
                                            {REQUIRED_CSV_COLUMNS.includes(h) && <span className="text-red-400 ml-0.5">*</span>}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {csvRows.slice(0, 8).map((row, i) => (
                                    <tr key={i}>
                                        <td className="text-gray-300">{i + 1}</td>
                                        {ALL_CSV_COLUMNS.filter(col => csvHeaders.includes(col)).map(col => (
                                            <td key={col} className={!row[col] && REQUIRED_CSV_COLUMNS.includes(col) ? 'bg-red-50 text-red-500' : ''}>
                                                {row[col] || <span className="text-gray-300">—</span>}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {csvRows.length > 8 && (
                            <p className="text-xs text-gray-400 text-center py-2">
                                + {csvRows.length - 8} more rows
                            </p>
                        )}
                    </div>

                    {/* Warn if any required cell is empty */}
                    {csvRows.some(row => REQUIRED_CSV_COLUMNS.some(col => !row[col])) && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
                            ⚠️ Some required cells are empty (highlighted in red). They will be uploaded with default/zero values.
                        </div>
                    )}
                </div>
            )}

            {/* ── STEP: Uploading ── */}
            {step === 'uploading' && progress && (
                <div className="py-10 flex flex-col items-center gap-4">
                    <p className="text-sm font-semibold text-gray-700">Uploading {progress.total} items…</p>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div
                            className="bg-primary-500 h-2.5 rounded-full transition-all duration-500"
                            style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-400">{progress.done} / {progress.total}</p>
                </div>
            )}

            {/* ── STEP: Done ── */}
            {step === 'done' && result && (
                <div className="py-8 flex flex-col items-center gap-4">
                    <span className="text-5xl">✅</span>
                    <p className="text-lg font-bold text-gray-800">{result.created} items uploaded successfully</p>
                    {result.errors?.length > 0 && (
                        <div className="w-full p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-xs font-semibold text-red-700 mb-1">{result.errors.length} errors:</p>
                            <ul className="text-xs text-red-600 space-y-0.5 max-h-32 overflow-y-auto">
                                {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    )
}

// ── Main Inventory page ────────────────────────────────────────────────────────
export default function Inventory() {
    const dispatch = useDispatch()
    const { martId } = useAuth()

    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [addOpen, setAddOpen] = useState(false)
    const [bulkOpen, setBulkOpen] = useState(false)
    const [form, setForm] = useState(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [search, setSearch] = useState('')
    const [dragIdx, setDragIdx] = useState(null)
    const [dragOverIdx, setDragOverIdx] = useState(null)

    const load = useCallback(() => {
        if (!martId) return
        setLoading(true)
        api.get(`/inventory?martId=${martId}`)
            .then(r => { setItems(r.data || []); setLoading(false) })
            .catch(() => setLoading(false))
    }, [martId])

    useEffect(() => { load() }, [load])

    const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

    // ── Add new item ───────────────────────────────────────────
    const handleAdd = async () => {
        const required = ['mongo_product_id', 'variant_id', 'sale_price', 'mrp', 'stock_qty', 'stock_unit', 'low_stock_alert']
        const missing = required.find(k => !form[k])
        if (missing) {
            dispatch(showToast({ message: `${missing.replace(/_/g, ' ')} is required`, type: 'error' }))
            return
        }
        setSaving(true)
        const res = await api.post('/inventory', {
            ...form,
            mongo_mart_id: martId,
            sale_price: parseFloat(form.sale_price),
            mrp: parseFloat(form.mrp),
            stock_qty: parseFloat(form.stock_qty),
            low_stock_alert: parseFloat(form.low_stock_alert),
        })
        setSaving(false)
        if (res.success) {
            dispatch(showToast({ message: 'Item added!', type: 'success' }))
            setAddOpen(false); setForm(EMPTY_FORM); load()
        } else {
            dispatch(showToast({ message: res.message || 'Failed', type: 'error' }))
        }
    }

    // ── Inline update ──────────────────────────────────────────
    const handleInlineUpdate = async (id, field, value) => {
        const payload = { [field]: ['sale_price', 'mrp', 'stock_qty', 'low_stock_alert'].includes(field) ? parseFloat(value) : value }
        const res = await api.patch(`/inventory/${id}`, payload)
        if (res.success) {
            setItems(prev => prev.map(it => it.id === id ? { ...it, ...payload } : it))
            dispatch(showToast({ message: 'Updated', type: 'success' }))
        } else {
            dispatch(showToast({ message: res.message || 'Update failed', type: 'error' }))
            load()
        }
    }

    // ── Toggle active ──────────────────────────────────────────
    const handleToggle = async (item) => {
        const res = await api.patch(`/inventory/${item.id}`, { is_active: !item.is_active })
        if (res.success) {
            setItems(prev => prev.map(it => it.id === item.id ? { ...it, is_active: !it.is_active } : it))
        } else {
            dispatch(showToast({ message: 'Toggle failed', type: 'error' }))
        }
    }

    // ── Drag reorder ───────────────────────────────────────────
    const handleDragStart = (idx) => setDragIdx(idx)
    const handleDragOver = (e, idx) => { e.preventDefault(); setDragOverIdx(idx) }
    const handleDrop = async (idx) => {
        if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return }
        const reordered = [...items]
        const [moved] = reordered.splice(dragIdx, 1)
        reordered.splice(idx, 0, moved)
        setItems(reordered)
        setDragIdx(null); setDragOverIdx(null)
        await api.patch('/inventory/reorder', { ids: reordered.map(i => i.id) })
    }

    const filtered = items.filter(it =>
        it.mongo_product_id?.toLowerCase().includes(search.toLowerCase()) ||
        it.variant_id?.toLowerCase().includes(search.toLowerCase()) ||
        it.aisle_location?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div>
            <PageHeader
                title="Inventory"
                subtitle="Manage stock levels — click any cell to edit inline"
                action={
                    <div className="flex gap-2">
                        {/* Bulk Upload replaces old Import CSV */}
                        <Button variant="secondary" onClick={() => setBulkOpen(true)}>⬆ Bulk Upload</Button>
                        <Button variant="secondary" onClick={load}>↻ Refresh</Button>
                        <Button variant="primary" onClick={() => { setForm({ ...EMPTY_FORM, mongo_mart_id: martId }); setAddOpen(true) }}>+ Add Item</Button>
                    </div>
                }
            />

            {/* Search */}
            <div className="mb-4">
                <input
                    className="input max-w-xs"
                    placeholder="Search by product ID, variant, aisle..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Stats bar */}
            {items.length > 0 && (
                <div className="flex gap-3 mb-4 flex-wrap">
                    {[
                        { label: 'Total Items', value: items.length, color: 'text-gray-700' },
                        { label: 'Out of Stock', value: items.filter(i => i.stock_qty <= 0).length, color: 'text-red-600' },
                        { label: 'Low Stock', value: items.filter(i => i.stock_qty > 0 && i.stock_qty <= i.low_stock_alert).length, color: 'text-yellow-600' },
                        { label: 'Active', value: items.filter(i => i.is_active).length, color: 'text-green-600' },
                    ].map(s => (
                        <div key={s.label} className="bg-white border border-gray-100 rounded-lg px-4 py-2 shadow-sm">
                            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                            <p className="text-xs text-gray-400">{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Main table */}
            <div className="card overflow-x-auto">
                {loading ? (
                    <div className="py-12 text-center text-gray-400">Loading...</div>
                ) : filtered.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">
                        {search ? 'No results found' : 'No inventory items yet. Add one or bulk upload CSV.'}
                    </div>
                ) : (
                    <table className="table text-xs w-full">
                        <thead>
                            <tr>
                                <th className="w-8"></th>
                                <th>Product ID</th>
                                <th>Variant</th>
                                <th>Sale Price</th>
                                <th>MRP</th>
                                <th>Stock Qty</th>
                                <th>Unit</th>
                                <th>Alert At</th>
                                <th>Status</th>
                                <th>Expiry</th>
                                <th>Batch</th>
                                <th>Aisle</th>
                                <th>Active</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((item, idx) => (
                                <tr
                                    key={item.id}
                                    draggable
                                    onDragStart={() => handleDragStart(idx)}
                                    onDragOver={e => handleDragOver(e, idx)}
                                    onDrop={() => handleDrop(idx)}
                                    onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                                    className={`transition-colors ${dragOverIdx === idx ? 'bg-primary-50 border-t-2 border-primary-400' : ''} ${dragIdx === idx ? 'opacity-40' : ''}`}
                                >
                                    <td className="cursor-grab active:cursor-grabbing text-gray-300 select-none text-center">⠿</td>
                                    <td><EditableCell value={item.mongo_product_id} onSave={v => handleInlineUpdate(item.id, 'mongo_product_id', v)} /></td>
                                    <td><EditableCell value={item.variant_id} onSave={v => handleInlineUpdate(item.id, 'variant_id', v)} /></td>
                                    <td><EditableCell value={item.sale_price} type="number" onSave={v => handleInlineUpdate(item.id, 'sale_price', v)} /></td>
                                    <td><EditableCell value={item.mrp} type="number" onSave={v => handleInlineUpdate(item.id, 'mrp', v)} /></td>
                                    <td><EditableCell value={item.stock_qty} type="number" onSave={v => handleInlineUpdate(item.id, 'stock_qty', v)} /></td>
                                    <td><EditableCell value={item.stock_unit} options={UNITS} onSave={v => handleInlineUpdate(item.id, 'stock_unit', v)} /></td>
                                    <td><EditableCell value={item.low_stock_alert} type="number" onSave={v => handleInlineUpdate(item.id, 'low_stock_alert', v)} /></td>
                                    <td><StockBadge qty={parseFloat(item.stock_qty)} alert={parseFloat(item.low_stock_alert)} /></td>
                                    <td><EditableCell value={item.expiry_date?.slice(0, 10) || ''} type="date" onSave={v => handleInlineUpdate(item.id, 'expiry_date', v)} /></td>
                                    <td><EditableCell value={item.batch_number || ''} onSave={v => handleInlineUpdate(item.id, 'batch_number', v)} /></td>
                                    <td><EditableCell value={item.aisle_location || ''} onSave={v => handleInlineUpdate(item.id, 'aisle_location', v)} /></td>
                                    <td>
                                        <button onClick={() => handleToggle(item)}
                                            className={`w-8 h-4 rounded-full transition-colors ${item.is_active ? 'bg-green-400' : 'bg-gray-200'}`}>
                                            <span className={`block w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${item.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Add Item Modal */}
            <Modal
                title="Add Inventory Item"
                open={addOpen}
                onClose={() => setAddOpen(false)}
                size="lg"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
                        <Button variant="primary" loading={saving} onClick={handleAdd}>Add Item</Button>
                    </>
                }
            >
                <div className="form-grid-2">
                    <Input label="Product ID (Mongo)" required value={form.mongo_product_id} onChange={e => setF('mongo_product_id', e.target.value)} placeholder="64f1a2b3c4d5e6f7a8b9c0d1" />
                    <Input label="Variant ID" required value={form.variant_id} onChange={e => setF('variant_id', e.target.value)} placeholder="variant-500g" />
                    <Input label="Sale Price (₹)" required type="number" value={form.sale_price} onChange={e => setF('sale_price', e.target.value)} placeholder="49.00" />
                    <Input label="MRP (₹)" required type="number" value={form.mrp} onChange={e => setF('mrp', e.target.value)} placeholder="55.00" />
                    <Input label="Stock Quantity" required type="number" value={form.stock_qty} onChange={e => setF('stock_qty', e.target.value)} placeholder="100" />
                    <Select label="Stock Unit" required value={form.stock_unit} onChange={e => setF('stock_unit', e.target.value)}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </Select>
                    <Input label="Low Stock Alert At" required type="number" value={form.low_stock_alert} onChange={e => setF('low_stock_alert', e.target.value)} placeholder="10" />
                    <Input label="Expiry Date" type="date" value={form.expiry_date} onChange={e => setF('expiry_date', e.target.value)} />
                    <Input label="Batch Number" value={form.batch_number} onChange={e => setF('batch_number', e.target.value)} placeholder="BATCH-2025-001" />
                    <Input label="Aisle Location" value={form.aisle_location} onChange={e => setF('aisle_location', e.target.value)} placeholder="A3-Shelf2" />
                </div>
            </Modal>

            {/* Bulk Upload Modal */}
            <BulkUploadModal
                open={bulkOpen}
                onClose={() => setBulkOpen(false)}
                martId={martId}
                onDone={load}
                dispatch={dispatch}
            />
        </div>
    )
}