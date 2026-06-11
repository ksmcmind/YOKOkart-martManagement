// src/pages/Inventory.jsx
//
// Works correctly with the fixed inventorySlice.js.
// filteredItems and filteredPagination now always reflect real backend results.

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import * as XLSX from 'xlsx'
import {
    fetchInventory,
    fetchInventoryFiltered,
    fetchInventorySummary,
    addInventoryItem,
    updateInventoryItem,
    toggleInventoryActive,
    deleteInventoryItem,
    bulkUploadInventory,
    restockInventoryItem,
    selectInventoryItems,
    selectInventoryLoading,
    selectInventorySaving,
    selectInventoryRestocking,
    selectInventoryStats,
    selectFilteredItems,
    selectFilteredLoading,
    selectFilteredPagination,
    selectInventorySummary,
    selectInventorySummaryLoading,
} from '../store/slices/inventorySlice'
import { showToast } from '../store/slices/uiSlice'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Grid from '../components/Grid'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Input, { Select } from '../components/Input'
import BulkUploadModal from '../components/BulkUploadModal'
import useAuth from '../hooks/useAuth'
import api from '../api/index'
import AlgoliaProductSearch from '../components/AlgoliaProductSearch'

// ── Constants ────────────────────────────────────────────────────────────────

const UNITS = ['kg', 'g', 'l', 'ml', 'pcs', 'dozen']

const USER_TXN_TYPES = ['restock', 'sale', 'return', 'damage', 'expired', 'theft', 'adjustment', 'transfer', 'opening_stock']

const SCHEMA_FIELDS = [
    'product_code', 'variant_code', 'sale_price', 'cogs', 'mrp',
    'stock_qty', 'stock_unit', 'low_stock_alert',
    'expiry_date', 'batch_number', 'aisle_location', 'is_active',
]

const FIELD_VALIDATORS = {
    product_id: v => /^[a-f0-9]{24}$/i.test((v || '').trim()) || 'must be 24-char hex ObjectId',
    variant_id: v => (v || '').trim().length > 0 && v.length <= 50 || 'required, max 50 chars',
    sale_price: v => { const n = parseFloat(v); if (isNaN(n)) return 'must be a number'; if (n < 0) return 'must be >= 0'; return true },
    cogs: v => { const n = parseFloat(v); if (isNaN(n)) return 'must be a number'; if (n < 0) return 'must be >= 0'; return true },
    mrp: v => { const n = parseFloat(v); if (isNaN(n)) return 'must be a number'; if (n < 0) return 'must be >= 0'; return true },
    stock_qty: v => { const n = parseFloat(v); if (isNaN(n)) return 'must be a number'; if (n < 0) return 'must be >= 0'; return true },
    stock_unit: v => UNITS.includes((v || '').toLowerCase().trim()) || `must be one of: ${UNITS.join(', ')}`,
    low_stock_alert: v => { const n = parseFloat(v); if (isNaN(n)) return 'must be a number'; if (n < 0) return 'must be >= 0'; return true },
    expiry_date: v => { if (!v || !v.trim()) return true; const d = new Date(v); if (isNaN(d.getTime())) return 'must be YYYY-MM-DD'; return true },
    batch_number: v => { if (!v || !v.trim()) return true; return v.length <= 50 || 'max 50 chars' },
    aisle_location: v => { if (!v || !v.trim()) return true; return v.length <= 50 || 'max 50 chars' },
    is_active: v => ['true', 'false'].includes((v || '').toLowerCase().trim()) || 'must be "true" or "false"',
}

// ── Template generators ───────────────────────────────────────────────────────

const SAMPLE_ROW = ['64f1a2b3c4d5e6f7a8b9c0d1', 'VID-AMUL-500', '49.00', '40.00', '55.00', '100', 'pcs', '10', '2026-12-31', 'BATCH-001', 'A3-Shelf2', 'true']
const SAMPLE_ROW_2 = ['64f1a2b3c4d5e6f7a8b9c0d2', 'VID-TATA-1KG', '22.00', '18.00', '24.00', '50', 'kg', '5', '', '', 'B1-Shelf1', 'true']

const downloadCSVTemplate = () => {
    const comments = [
        '# Inventory Bulk Upload — CSV Template',
        '# mongo_mart_id is NOT in this CSV — backend fills it from your session.',
        '# stock_unit: kg | g | l | ml | pcs | dozen',
        '# Dates: YYYY-MM-DD format.',
        '',
    ]
    const blob = new Blob([[...comments, SCHEMA_FIELDS.join(','), SAMPLE_ROW.join(','), SAMPLE_ROW_2.join(',')].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'inventory_template.csv'; a.click()
    URL.revokeObjectURL(a.href)
}

const downloadXLSXTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([SCHEMA_FIELDS, SAMPLE_ROW, SAMPLE_ROW_2])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory')
    XLSX.writeFile(wb, 'inventory_template.xlsx')
}

// ── Empty forms ───────────────────────────────────────────────────────────────

const EMPTY_FORM = {
    product_id: '', variant_id: '', variant_label: '', sale_price: '', mrp: '',
    stock_qty: '', stock_unit: 'pcs', low_stock_alert: '10',
    type: 'restock', expiry_date: '', batch_number: '', aisle_location: '', is_active: true,
}

const EMPTY_RESTOCK_FORM = { stock_qty: '', mode: 'add', txn_type: 'restock', reason: '' }

// These are the "committed" filters — what was last sent to the backend.
// The FilterBar maintains its own draft internally.
const EMPTY_FILTERS = {
    search: '',
    stock_unit: '',
    is_active: '',
    low_stock_only: '',
    out_of_stock: '',
    expiring_soon: '',
    expired: '',
    min_sale_price: '',
    max_sale_price: '',
    expiry_before: '',
    expiry_after: '',
    sort_by: 'created_at',
    sort_order: 'DESC',
    page: 1,
    limit: 25,
}

// ── EditableCell ──────────────────────────────────────────────────────────────

function EditableCell({ value, type = 'text', options, onSave }) {
    const [editing, setEditing] = useState(false)
    const [val, setVal] = useState(value)
    const ref = useRef()

    useEffect(() => { if (editing && ref.current) ref.current.focus() }, [editing])
    useEffect(() => { setVal(value) }, [value])

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
                onChange={e => setVal(e.target.value)} onBlur={commit}
                onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setVal(value); setEditing(false) } }}
                className="w-full text-xs border border-primary-400 rounded px-1 py-0.5 bg-white outline-none" />
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

// ── FilterBar ─────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
    { value: 'created_at', label: 'Date Created' },
    { value: 'updated_at', label: 'Last Updated' },
    { value: 'sale_price', label: 'Price' },
    { value: 'stock_qty', label: 'Stock Qty' },
    { value: 'expiry_date', label: 'Expiry Date' },
    { value: 'last_restocked_at', label: 'Last Restocked' },
]

const STOCK_STATUS_OPTIONS = [
    { value: '', label: 'All Items' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'low_stock', label: 'Low Stock' },
    { value: 'out_of_stock', label: 'Out of Stock' },
    { value: 'expiring_soon', label: 'Expiring Soon' },
    { value: 'expired', label: 'Expired' },
]

function getStockStatusValue(f) {
    if (f.out_of_stock === 'true') return 'out_of_stock'
    if (f.low_stock_only === 'true') return 'low_stock'
    if (f.is_active === 'false') return 'inactive'
    if (f.is_active === 'true') return 'active'
    if (f.expiring_soon === 'true') return 'expiring_soon'
    if (f.expired === 'true') return 'expired'
    return ''
}

function getActiveChips(f) {
    const chips = []
    if (f.search) chips.push({ key: 'search', label: `"${f.search}"` })
    if (f.stock_unit) chips.push({ key: 'unit', label: `Unit: ${f.stock_unit}` })
    const sv = getStockStatusValue(f)
    if (sv) chips.push({ key: 'status', label: STOCK_STATUS_OPTIONS.find(o => o.value === sv)?.label || sv })
    if (f.min_sale_price || f.max_sale_price)
        chips.push({ key: 'price', label: `₹${f.min_sale_price || '0'} – ₹${f.max_sale_price || '∞'}` })
    if (f.expiry_after || f.expiry_before) {
        const p = []
        if (f.expiry_after) p.push(`after ${f.expiry_after}`)
        if (f.expiry_before) p.push(`before ${f.expiry_before}`)
        chips.push({ key: 'expiry', label: `Expiry ${p.join(', ')}` })
    }
    return chips
}

// FilterBar owns its own draft. The parent only sees committed values via onSearch.
function FilterBar({ committedFilters, onSearch, onReset, loading, martId }) {
    const [draft, setDraft] = useState(committedFilters)
    const [expanded, setExpanded] = useState(false)

    // Sync draft when parent resets
    useEffect(() => { setDraft(committedFilters) }, [committedFilters])

    // Debounced search on typing
    useEffect(() => {
        const timer = setTimeout(() => {
            onSearch({ ...draft, page: 1 })
        }, 300)
        return () => clearTimeout(timer)
    }, [draft.search])

    const set = (k, v) => setDraft(f => ({ ...f, [k]: v }))

    const commit = () => {
        onSearch({ ...draft, page: 1 })
    }
    const reset = () => {
        setDraft(EMPTY_FILTERS)
        onReset()
    }
    const onEnter = e => { if (e.key === 'Enter') commit() }

    const chips = getActiveChips(committedFilters) // from committed, not draft
    const statusVal = getStockStatusValue(draft)

    const setStatus = (v) => setDraft(f => ({
        ...f,
        out_of_stock: v === 'out_of_stock' ? 'true' : '',
        low_stock_only: v === 'low_stock' ? 'true' : '',
        is_active: v === 'active' ? 'true' : v === 'inactive' ? 'false' : '',
        expiring_soon: v === 'expiring_soon' ? 'true' : '',
        expired: v === 'expired' ? 'true' : '',
    }))

    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

            {/* Top bar */}
            <div className="flex gap-2 p-3">
                <div className="relative flex-1 min-w-0">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        value={draft.search}
                        onChange={e => set('search', e.target.value)}
                        onKeyDown={onEnter}
                        placeholder="Search product, variant, batch, aisle…"
                        className="w-full text-xs pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-4 focus:ring-green-500/10 focus:border-green-500 focus:outline-none transition-all bg-gray-50 focus:bg-white placeholder-gray-400"
                    />
                </div>

                {/* Sort — desktop */}
                <div className="hidden md:flex items-center gap-1.5 px-3 border border-gray-200 rounded-xl bg-gray-50 shrink-0">
                    <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                    </svg>
                    <select value={draft.sort_by} onChange={e => set('sort_by', e.target.value)}
                        className="text-xs bg-transparent outline-none py-2 text-gray-700 cursor-pointer">
                        {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <button onClick={() => set('sort_order', draft.sort_order === 'ASC' ? 'DESC' : 'ASC')}
                        className="text-gray-500 hover:text-primary-600 font-bold text-sm transition-colors w-5 text-center">
                        {draft.sort_order === 'ASC' ? '↑' : '↓'}
                    </button>
                </div>

                {/* Filters toggle */}
                <button
                    onClick={() => setExpanded(e => !e)}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-all shrink-0 ${expanded
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-600'
                        }`}
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                    </svg>
                    <span className="hidden sm:inline">Filters</span>
                    {chips.length > 0 && (
                        <span className={`text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ${expanded ? 'bg-white text-primary-600' : 'bg-primary-600 text-white'
                            }`}>{chips.length}</span>
                    )}
                </button>

                {/* Search button */}
                <button onClick={commit} disabled={loading}
                    className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white rounded-xl disabled:opacity-50 transition-colors shadow-sm shrink-0">
                    {loading
                        ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    }
                    <span className="hidden sm:inline">{loading ? 'Searching…' : 'Search'}</span>
                </button>
            </div>

            {/* Active chips strip */}
            {chips.length > 0 && !expanded && (
                <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-t border-gray-100 bg-primary-50/60">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary-500 shrink-0">Active:</span>
                    {chips.map(c => (
                        <span key={c.key} className="inline-flex items-center text-[11px] font-semibold bg-white border border-primary-200 text-primary-700 px-2.5 py-0.5 rounded-full shadow-sm">
                            {c.label}
                        </span>
                    ))}
                    <button onClick={reset} className="ml-auto text-[11px] font-bold text-red-500 hover:text-red-700 transition-colors shrink-0">
                        ✕ Clear all
                    </button>
                </div>
            )}

            {/* Expanded panel */}
            {expanded && (
                <div className="border-t border-gray-100">
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                        {/* Status */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Stock Status</p>
                            <div className="space-y-1">
                                {STOCK_STATUS_OPTIONS.map(opt => (
                                    <button key={opt.value} onClick={() => setStatus(opt.value)}
                                        className={`w-full text-left text-xs px-3 py-2 rounded-lg border font-medium transition-all ${statusVal === opt.value
                                            ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                                            : 'bg-white border-gray-200 text-gray-600 hover:border-primary-200 hover:bg-primary-50/50'
                                            }`}>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Unit */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Stock Unit</p>
                            <div className="grid grid-cols-3 gap-1">
                                {['', ...UNITS].map(u => (
                                    <button key={u || 'all'} onClick={() => set('stock_unit', u)}
                                        className={`text-xs py-2 px-1 rounded-lg border font-medium transition-all ${draft.stock_unit === u
                                            ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                                            : 'bg-white border-gray-200 text-gray-600 hover:border-primary-200 hover:bg-primary-50/50'
                                            }`}>
                                        {u || 'All'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Price */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Sale Price (₹)</p>
                            <div className="space-y-2">
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">₹</span>
                                    <input type="number" placeholder="Min price" value={draft.min_sale_price}
                                        onChange={e => set('min_sale_price', e.target.value)}
                                        className="w-full text-xs pl-6 pr-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-primary-400 bg-white transition-colors" />
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">₹</span>
                                    <input type="number" placeholder="Max price" value={draft.max_sale_price}
                                        onChange={e => set('max_sale_price', e.target.value)}
                                        className="w-full text-xs pl-6 pr-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-primary-400 bg-white transition-colors" />
                                </div>
                            </div>
                        </div>

                        {/* Expiry + Sort */}
                        {/* Expiry + Sort + Per Page */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Expiry Date</p>
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-gray-400 w-8 shrink-0 font-medium">After</span>
                                        <input type="date" value={draft.expiry_after} onChange={e => set('expiry_after', e.target.value)}
                                            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-primary-400 bg-white" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-gray-400 w-8 shrink-0 font-medium">Before</span>
                                        <input type="date" value={draft.expiry_before} onChange={e => set('expiry_before', e.target.value)}
                                            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-primary-400 bg-white" />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Sort By</p>
                                <div className="flex gap-1">
                                    <select value={draft.sort_by} onChange={e => set('sort_by', e.target.value)}
                                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white outline-none focus:border-primary-400">
                                        {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                    <button onClick={() => set('sort_order', draft.sort_order === 'ASC' ? 'DESC' : 'ASC')}
                                        className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:border-primary-300 font-bold text-gray-600 transition-colors">
                                        {draft.sort_order === 'ASC' ? '↑' : '↓'}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Per Page</p>
                                <div className="grid grid-cols-4 gap-1">
                                    {[10, 25, 50, 100].map(n => (
                                        <button key={n} onClick={() => set('limit', n)}
                                            className={`text-xs py-2 px-1 rounded-lg border font-medium transition-all ${draft.limit === n
                                                ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                                                : 'bg-white border-gray-200 text-gray-600 hover:border-primary-200 hover:bg-primary-50/50'
                                                }`}>
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Panel footer */}
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                        <button onClick={reset} className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors">
                            ✕ Clear all filters
                        </button>
                        <button onClick={commit} disabled={loading}
                            className="flex items-center gap-2 text-xs font-bold px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 transition-colors shadow-sm">
                            {loading
                                ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                : null
                            }
                            {loading ? 'Searching…' : 'Apply & Search'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── PaginationBar ─────────────────────────────────────────────────────────────

function PaginationBar({ pagination, onPageChange }) {
    if (!pagination || pagination.total_pages <= 1) return null
    const { page, total_pages, total, limit } = pagination
    const from = (page - 1) * limit + 1
    const to = Math.min(page * limit, total)

    const getPages = () => {
        if (total_pages <= 7) return Array.from({ length: total_pages }, (_, i) => i + 1)
        const pages = [1]
        if (page > 3) pages.push('...')
        for (let i = Math.max(2, page - 1); i <= Math.min(total_pages - 1, page + 1); i++) pages.push(i)
        if (page < total_pages - 2) pages.push('...')
        pages.push(total_pages)
        return pages
    }

    return (
        <div className="flex items-center justify-between py-3 px-1 border-t border-gray-100 mt-1">
            <span className="text-xs text-gray-500">
                Showing <span className="font-semibold text-gray-700">{from}–{to}</span> of{' '}
                <span className="font-semibold text-gray-700">{total}</span> items
            </span>
            <div className="flex items-center gap-1">
                <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
                    className="px-2.5 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:border-primary-300 hover:text-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    ← Prev
                </button>
                {getPages().map((p, i) =>
                    p === '...'
                        ? <span key={`e${i}`} className="px-1 text-xs text-gray-400">…</span>
                        : <button key={p} onClick={() => onPageChange(p)}
                            className={`w-8 h-8 text-xs font-semibold rounded-lg border transition-colors ${p === page
                                ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                                : 'border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-600'
                                }`}>
                            {p}
                        </button>
                )}
                <button onClick={() => onPageChange(page + 1)} disabled={page >= total_pages}
                    className="px-2.5 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:border-primary-300 hover:text-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    Next →
                </button>
            </div>
        </div>
    )
}

// ── RestockModal ──────────────────────────────────────────────────────────────

function RestockModal({ open, onClose, item, martId }) {
    const dispatch = useDispatch()
    const restocking = useSelector(selectInventoryRestocking)
    const [form, setForm] = useState(EMPTY_RESTOCK_FORM)

    useEffect(() => { if (open) setForm(EMPTY_RESTOCK_FORM) }, [open, item?.id])
    if (!item) return null

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
    const currentQty = parseFloat(item.stock_qty)
    const inputQty = parseFloat(form.stock_qty) || 0
    const projected = form.mode === 'add' ? currentQty + inputQty : inputQty
    const isNeg = projected < 0

    const handleSubmit = async () => {
        if (!form.stock_qty || isNaN(parseFloat(form.stock_qty))) {
            dispatch(showToast({ message: 'Quantity is required', type: 'error' })); return
        }
        if (parseFloat(form.stock_qty) < 0) {
            dispatch(showToast({ message: 'Quantity must be non-negative', type: 'error' })); return
        }
        if (isNeg) {
            dispatch(showToast({ message: `Result would be negative (${projected})`, type: 'error' })); return
        }
        const action = await dispatch(restockInventoryItem({
            mongo_product_id: item.mongo_product_id,
            mongo_mart_id: martId,
            variant_id: item.variant_id,
            sale_price: parseFloat(item.sale_price),
            mrp: parseFloat(item.mrp),
            stock_qty: parseFloat(form.stock_qty),
            stock_unit: item.stock_unit,
            low_stock_alert: parseFloat(item.low_stock_alert),
            aisle_location: item.aisle_location || null,
            expiry_date: item.expiry_date || null,
            batch_number: item.batch_number || null,
            mode: form.mode,
            txn_type: form.txn_type,
            type: item.type,
            reason: form.reason || null,
        }))
        if (restockInventoryItem.fulfilled.match(action)) onClose()
    }

    return (
        <Modal title={`Restock — ${item.product_name || 'Stock Product'} [${item.product_code || item.mongo_product_id} / ${item.variant_code || item.variant_id}]`}
            open={open} onClose={onClose} size="md"
            footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" loading={restocking} onClick={handleSubmit}>Update Stock</Button></>}>
            <div className="space-y-5">
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Current Stock</p>
                    <p className="text-lg font-bold text-gray-900">{currentQty} <span className="text-xs text-gray-500">{item.stock_unit}</span></p>
                </div>
                <div>
                    <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold block mb-2">Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                        {['add', 'set'].map(m => (
                            <button key={m} type="button" onClick={() => set('mode', m)}
                                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${form.mode === m ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-primary-300'
                                    }`}>
                                {m === 'add' ? 'ADD (delta)' : 'SET (absolute)'}
                            </button>
                        ))}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">
                        {form.mode === 'add' ? '"Got 50 more units" — added to current stock.' : '"Recount says 47" — replaces current stock.'}
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Input label={form.mode === 'add' ? 'Add Quantity *' : 'New Total *'}
                        type="number" value={form.stock_qty} onChange={e => set('stock_qty', e.target.value)} placeholder="50" />
                    <Select label="Transaction Type *" value={form.txn_type} onChange={e => set('txn_type', e.target.value)}>
                        {USER_TXN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </Select>
                </div>
                <div className={`rounded-lg px-4 py-3 border ${isNeg ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Projected Stock</p>
                    <p className={`text-lg font-bold ${isNeg ? 'text-red-600' : 'text-green-700'}`}>
                        {projected} <span className="text-xs">{item.stock_unit}</span>
                        {isNeg && <span className="text-xs ml-2">⚠ Cannot go negative</span>}
                    </p>
                </div>
                <Input label="Reason / Notes" value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="Supplier delivery #INV-1234" />
            </div>
        </Modal>
    )
}

// ── HistoryModal ──────────────────────────────────────────────────────────────

const TXN_TYPES_ALL = ['restock', 'sale', 'return', 'damage', 'expired', 'theft', 'adjustment', 'transfer', 'opening_stock']
const EMPTY_TXN_FILTERS = { type: '', from: '', to: '', page: 1, limit: 50 }

function HistoryModal({ open, onClose, item }) {
    const [filters, setFilters] = useState(EMPTY_TXN_FILTERS)
    const [loading, setLoading] = useState(false)
    const [txns, setTxns] = useState([])
    const [pagination, setPagination] = useState(null)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!open || !item?.id) return
        setFilters(EMPTY_TXN_FILTERS); setTxns([]); setPagination(null); setError(null)
    }, [open, item?.id])

    useEffect(() => {
        if (!open || !item?.id) return
        const params = new URLSearchParams({ limit: filters.limit, page: filters.page })
        if (filters.type) params.set('type', filters.type)
        if (filters.from) params.set('from', filters.from)
        if (filters.to) params.set('to', filters.to)

        setLoading(true)
        setError(null)
        api.get(`/inventory/${item.id}/transactions?${params}`)
            .then(res => {
                if (res.success) {
                    setTxns(res.data || [])
                    setPagination(res.pagination || null)
                } else {
                    setError(res.message || 'Failed to load')
                }
            })
            .catch(err => setError(err?.message || 'Network error'))
            .finally(() => setLoading(false))
    }, [open, item?.id, filters])

    if (!item) return null

    const setF = (k, v) => setFilters(f => ({ ...f, [k]: v, page: 1 }))

    const typeColor = t => ({ restock: 'green', sale: 'blue', return: 'yellow', damage: 'red', expired: 'red', theft: 'red', adjustment: 'gray', transfer: 'purple', opening_stock: 'green' })[t] || 'gray'
    const fmtDT = iso => !iso ? '—' : new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })
    const net = txns.reduce((s, t) => s + parseFloat(t.qty_change || 0), 0)

    return (
        <Modal title={`Stock History — ${item.product_name || 'Stock Product'} [${item.product_code || item.mongo_product_id} / ${item.variant_code || item.variant_id}]`}
            open={open} onClose={onClose} size="xl"
            footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-end mb-4 pb-4 border-b border-gray-100">
                <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Type</p>
                    <select value={filters.type} onChange={e => setF('type', e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-primary-400">
                        <option value="">All types</option>
                        {TXN_TYPES_ALL.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">From</p>
                    <input type="date" value={filters.from} onChange={e => setF('from', e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-primary-400" />
                </div>
                <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">To</p>
                    <input type="date" value={filters.to} onChange={e => setF('to', e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-primary-400" />
                </div>
                {(filters.type || filters.from || filters.to) && (
                    <button onClick={() => setFilters(EMPTY_TXN_FILTERS)}
                        className="text-xs font-semibold text-red-500 hover:text-red-700 self-end pb-1.5">✕ Clear</button>
                )}
                {pagination && (
                    <div className="ml-auto text-right self-end">
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Total</p>
                        <p className="text-xl font-bold text-gray-800">{pagination.total}</p>
                    </div>
                )}
            </div>

            {loading ? (
                <p className="text-sm text-gray-500 py-10 text-center">Loading…</p>
            ) : error ? (
                <p className="text-sm text-red-500 py-10 text-center">{error}</p>
            ) : !txns.length ? (
                <p className="text-sm text-gray-500 py-10 text-center">No transactions match your filters.</p>
            ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b-2 border-gray-200">
                                {['Type', 'Change', 'Before → After', 'Reason', 'When', 'By / Order'].map(h => (
                                    <th key={h} className="text-left text-[10px] uppercase tracking-widest font-bold text-gray-500 pb-2 pr-3 whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {txns.map(t => {
                                const change = parseFloat(t.qty_change)
                                const pos = change >= 0
                                return (
                                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-2 pr-3 align-top"><Badge variant={typeColor(t.type)} size="xs">{t.type.toUpperCase()}</Badge></td>
                                        <td className={`py-2 pr-3 text-right font-bold tabular-nums whitespace-nowrap ${pos ? 'text-green-700' : 'text-red-600'}`}>
                                            {pos ? '+' : ''}{change}
                                        </td>
                                        <td className="py-2 pr-3 text-center text-gray-500 tabular-nums whitespace-nowrap">
                                            {t.qty_before} → <span className="font-bold text-gray-800">{t.qty_after}</span>
                                        </td>
                                        <td className="py-2 pr-3 text-gray-700 max-w-[180px] truncate" title={t.reason || ''}>
                                            {t.reason || <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">{fmtDT(t.created_at)}</td>
                                        <td className="py-2 text-gray-600 whitespace-nowrap">
                                            {t.staff_name && <span className="text-gray-700">{t.staff_name}</span>}
                                            {t.order_id && <span className="text-blue-600 font-mono text-[10px]">{t.staff_name ? ' · ' : ''}#{t.order_id.slice(0, 8)}</span>}
                                            {!t.staff_name && !t.order_id && <span className="text-gray-300">—</span>}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
                        <span className="text-[11px] text-gray-500 tabular-nums">
                            Net change:{' '}
                            <span className={`font-bold ${net >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                {(net >= 0 ? '+' : '') + net.toFixed(2)}
                            </span>
                        </span>
                        {pagination && pagination.total_pages > 1 && (
                            <div className="flex items-center gap-1 ml-auto">
                                <span className="text-[11px] text-gray-400 mr-2">
                                    {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                                </span>
                                <button onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))} disabled={!pagination.has_prev}
                                    className="px-2 py-1 text-xs border border-gray-200 rounded hover:border-primary-300 disabled:opacity-40 disabled:cursor-not-allowed">‹</button>
                                {Array.from({ length: Math.min(pagination.total_pages, 5) }, (_, i) => i + 1).map(p => (
                                    <button key={p} onClick={() => setFilters(f => ({ ...f, page: p }))}
                                        className={`w-7 h-7 text-xs border rounded transition-colors ${p === pagination.page ? 'bg-primary-600 border-primary-600 text-white font-bold' : 'border-gray-200 hover:border-primary-300'}`}>
                                        {p}
                                    </button>
                                ))}
                                <button onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))} disabled={!pagination.has_next}
                                    className="px-2 py-1 text-xs border border-gray-200 rounded hover:border-primary-300 disabled:opacity-40 disabled:cursor-not-allowed">›</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Modal>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Inventory() {
    const dispatch = useDispatch()
    const { martId, staffId } = useAuth()

    const items = useSelector(selectInventoryItems)
    const localStats = useSelector(selectInventoryStats)
    const filteredItems = useSelector(selectFilteredItems)
    const filteredLoad = useSelector(selectFilteredLoading)
    const pagination = useSelector(selectFilteredPagination)
    const backendSummary = useSelector(selectInventorySummary)
    const summaryLoading = useSelector(selectInventorySummaryLoading)
    const saving = useSelector(selectInventorySaving)

    // Helper functions for sorting/styling expired & expiring soon items
    const parseDate = (dStr) => {
        if (!dStr) return null;
        const parts = dStr.slice(0, 10).split('-');
        if (parts.length === 3) {
            if (parts[2].length === 4) return new Date(parts[2], parts[1] - 1, parts[0]);
            if (parts[0].length === 4) return new Date(parts[0], parts[1] - 1, parts[2]);
        }
        return new Date(dStr);
    };

    const getExpiryDiffDays = (expiryDate) => {
        if (!expiryDate) return null;
        const expDate = parseDate(expiryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (expDate) expDate.setHours(0, 0, 0, 0);
        const diffTime = expDate - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const checkIsExpired = (expiryDate) => {
        const diff = getExpiryDiffDays(expiryDate);
        return diff !== null && diff < 0;
    };

    const checkIsExpiringSoon = (expiryDate) => {
        const diff = getExpiryDiffDays(expiryDate);
        return diff !== null && diff >= 0 && diff <= 60;
    };

    const sortedFilteredItems = useMemo(() => {
        return [...filteredItems].sort((a, b) => {
            const aExpired = checkIsExpired(a.expiry_date);
            const bExpired = checkIsExpired(b.expiry_date);
            if (aExpired && !bExpired) return -1;
            if (!aExpired && bExpired) return 1;
            if (aExpired && bExpired) {
                if (a.expiry_date && b.expiry_date) return new Date(a.expiry_date) - new Date(b.expiry_date);
                if (a.expiry_date) return -1;
                if (b.expiry_date) return 1;
            }

            const aExpiring = checkIsExpiringSoon(a.expiry_date);
            const bExpiring = checkIsExpiringSoon(b.expiry_date);
            if (aExpiring && !bExpiring) return -1;
            if (!aExpiring && bExpiring) return 1;
            if (aExpiring && bExpiring) {
                if (a.expiry_date && b.expiry_date) return new Date(a.expiry_date) - new Date(b.expiry_date);
                if (a.expiry_date) return -1;
                if (b.expiry_date) return 1;
            }

            if (a.expiry_date && b.expiry_date) return new Date(a.expiry_date) - new Date(b.expiry_date);
            if (a.expiry_date) return -1;
            if (b.expiry_date) return 1;

            return 0;
        });
    }, [filteredItems]);

    const [committedFilters, setCommittedFilters] = useState(EMPTY_FILTERS)
    const [addOpen, setAddOpen] = useState(false)
    const [bulkOpen, setBulkOpen] = useState(false)
    const [restockItem, setRestockItem] = useState(null)
    const [historyItem, setHistoryItem] = useState(null)
    const [form, setForm] = useState(EMPTY_FORM)
    const [activeTab, setActiveTab] = useState('inventory')
    const [martBatches, setMartBatches] = useState([])
    const [martBatchesLoading, setMartBatchesLoading] = useState(false)

    // ── Batch tab dedicated search + filter pills (same as warehouse inventory) ──
    const [batchSearch, setBatchSearch] = useState('')
    const [batchFilter, setBatchFilter] = useState('expiring_soon') // 'all' | 'expiring_soon' | 'expired' | 'low_stock'

    const sortedMartBatches = useMemo(() => {
        return [...martBatches].sort((a, b) => {
            const aExpired = checkIsExpired(a.expiry_date);
            const bExpired = checkIsExpired(b.expiry_date);
            if (aExpired && !bExpired) return -1;
            if (!aExpired && bExpired) return 1;
            if (aExpired && bExpired) {
                if (a.expiry_date && b.expiry_date) return new Date(a.expiry_date) - new Date(b.expiry_date);
                if (a.expiry_date) return -1;
                if (b.expiry_date) return 1;
            }

            const aExpiring = checkIsExpiringSoon(a.expiry_date);
            const bExpiring = checkIsExpiringSoon(b.expiry_date);
            if (aExpiring && !bExpiring) return -1;
            if (!aExpiring && bExpiring) return 1;
            if (aExpiring && bExpiring) {
                if (a.expiry_date && b.expiry_date) return new Date(a.expiry_date) - new Date(b.expiry_date);
                if (a.expiry_date) return -1;
                if (b.expiry_date) return 1;
            }

            if (a.expiry_date && b.expiry_date) return new Date(a.expiry_date) - new Date(b.expiry_date);
            if (a.expiry_date) return -1;
            if (b.expiry_date) return 1;

            return 0;
        });
    }, [martBatches]);

    // Fetch batches when batch tab is active, batchSearch changes (debounced), or batchFilter changes
    useEffect(() => {
        if (!martId || activeTab !== 'batches') return

        const doFetch = () => {
            setMartBatchesLoading(true)
            const queryParams = new URLSearchParams({ martId })
            if (batchSearch.trim()) queryParams.set('search', batchSearch.trim())
            if (batchFilter === 'expiring_soon') queryParams.set('expiring_soon', 'true')
            if (batchFilter === 'expired') queryParams.set('expired', 'true')
            if (batchFilter === 'low_stock') queryParams.set('low_stock_only', 'true')

            api.get(`/inventory/batches?${queryParams.toString()}`)
                .then(res => {
                    if (res.success) setMartBatches(res.data || [])
                    else setMartBatches([])
                })
                .catch(err => { console.error('Failed to fetch batches:', err); setMartBatches([]) })
                .finally(() => setMartBatchesLoading(false))
        }

        const delay = setTimeout(doFetch, batchSearch ? 400 : 0)
        return () => clearTimeout(delay)
    }, [martId, activeTab, batchSearch, batchFilter])

    const batchColumns = [
        {
            key: 'product', label: 'Product',
            render: r => (
                <div className="space-y-0.5">
                    <p className="font-bold text-gray-900 text-xs leading-tight">{r.product_name || 'Unknown'}</p>
                    <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold border border-gray-200 inline-block">#{r.product_code}</span>
                </div>
            ),
        },
        {
            key: 'variant', label: 'Variant',
            render: r => (
                <div className="space-y-0.5">
                    <p className="font-semibold text-gray-800 text-xs leading-tight">{r.variant_name || '—'}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                        <span className="bg-blue-50 text-blue-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-blue-100 uppercase font-mono">
                            {r.variant_code || 'default'}
                        </span>
                        {r.display_size && (
                            <span className="bg-violet-50 text-violet-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-violet-100 uppercase">
                                {r.display_size}
                            </span>
                        )}
                        {r.unit_type && (
                            <span className="bg-teal-50 text-teal-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-teal-100 uppercase">
                                {r.unit_type}
                            </span>
                        )}
                    </div>
                </div>
            ),
        },
        { key: 'batch_number', label: 'Batch #', render: r => <span className="font-mono text-xs font-bold text-gray-700">{r.batch_number || '—'}</span> },
        {
            key: 'stock', label: 'Available',
            render: r => <span className="font-bold text-gray-800 text-xs">{parseFloat(r.stock_qty).toLocaleString()} <span className="text-[9px] text-gray-500 uppercase">pcs</span></span>,
        },
        {
            key: 'expiry', label: 'Expiry',
            render: r => {
                if (!r.expiry_date) return <span className="text-gray-400 text-xs">—</span>
                const d = new Date(r.expiry_date)
                const diff = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24))
                const color = diff < 0 ? 'text-rose-700 font-black' : diff <= 60 ? 'text-orange-600 font-bold' : 'text-gray-700'
                return <span className={`text-xs ${color}`}>{d.toLocaleDateString('en-GB')}{diff <= 60 && <span className="ml-1 text-[9px]">{diff < 0 ? '🚨 EXP' : `🚨 ${diff}d`}</span>}</span>
            },
        },
        {
            key: 'pricing', label: 'Sale / MRP',
            render: r => (
                <div className="text-[11px]">
                    <span className="font-bold text-primary-600">₹{r.sale_price}</span>
                    <span className="text-gray-400 line-through ml-1">₹{r.mrp}</span>
                </div>
            ),
        },
        { key: 'aisle', label: 'Aisle', render: r => <span className="text-xs text-gray-600">{r.aisle_location || '—'}</span> },
    ]

    // Initial load — full list for stats + summary widget
    useEffect(() => {
        if (!martId) return
        dispatch(fetchInventory(martId))
        dispatch(fetchInventorySummary(martId))
    }, [martId, dispatch])

    // Filtered fetch — fires only when committedFilters changes (Search button clicked)
    // fetchInventoryFiltered now hits /inventory/filters → real filtered+paginated data
    useEffect(() => {
        if (!martId) return
        dispatch(fetchInventoryFiltered({ martId, ...committedFilters }))
    }, [martId, committedFilters, dispatch])

    const handleSearch = useCallback(f => setCommittedFilters({ ...f, page: 1 }), [])
    const handleFilterReset = useCallback(() => setCommittedFilters(EMPTY_FILTERS), [])
    const handlePageChange = useCallback(p => setCommittedFilters(f => ({ ...f, page: p })), [])

    const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

    const handleInlineUpdate = (id, field, value) => {
        if (field === 'stock_qty') {
            dispatch(showToast({ message: 'Use the Restock button to change stock (audit-logged).', type: 'info' }))
            return
        }
        const isNum = ['sale_price', 'mrp', 'low_stock_alert'].includes(field)
        dispatch(updateInventoryItem({ id, patch: { [field]: isNum ? parseFloat(value) : value } }))
    }

    const handleAdd = async () => {
        const required = ['product_id', 'variant_id', 'sale_price', 'mrp', 'stock_qty', 'stock_unit', 'low_stock_alert', 'type']
        const missing = required.find(k => form[k] === '' || form[k] === null || form[k] === undefined)
        if (missing) { dispatch(showToast({ message: `${missing.replace(/_/g, ' ')} is required`, type: 'error' })); return }
        if (!/^[a-f0-9]{24}$/i.test(form.product_id)) { dispatch(showToast({ message: 'Product ID must be 24-char hex ObjectId', type: 'error' })); return }
        if (parseFloat(form.sale_price) > parseFloat(form.mrp)) { dispatch(showToast({ message: 'Sale price cannot exceed MRP', type: 'error' })); return }

        const action = await dispatch(addInventoryItem({
            mongo_product_id: form.product_id, variant_id: form.variant_id,
            mongo_mart_id: martId, mongo_staff_id: staffId,
            sale_price: parseFloat(form.sale_price), mrp: parseFloat(form.mrp),
            stock_qty: parseFloat(form.stock_qty), stock_unit: form.stock_unit,
            low_stock_alert: parseFloat(form.low_stock_alert), type: form.type,
            expiry_date: form.expiry_date || null, batch_number: form.batch_number || null,
            aisle_location: form.aisle_location || null, is_active: form.is_active,
        }))
        if (addInventoryItem.fulfilled.match(action)) {
            setAddOpen(false); setForm(EMPTY_FORM)
            dispatch(fetchInventorySummary(martId))
        }
    }

    const handleRefresh = () => {
        dispatch(fetchInventory(martId))
        dispatch(fetchInventorySummary(martId))
        dispatch(fetchInventoryFiltered({ martId, ...committedFilters }))
    }

    const columns = [
        {
            key: 'product', label: 'Product Code',
            render: r => <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold border border-gray-200">#{r.product_code}</span>,
        },
        {
            key: 'details', label: 'Product & Variant Details',
            render: r => (
                <div className="space-y-0.5">
                    <p className="font-bold text-gray-900 leading-tight text-xs">{r.variant_name || 'Unknown Variant'}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="bg-blue-50 text-blue-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-blue-100 uppercase font-mono">
                            Var: {r.variant_code || 'default'}
                        </span>
                        {r.display_size && (
                            <span className="bg-violet-50 text-violet-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-violet-100 uppercase">
                                {r.display_size}
                            </span>
                        )}
                        {(r.stock_unit || r.unit_type) && (
                            <span className="bg-teal-50 text-teal-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-teal-100 uppercase">
                                {r.stock_unit || r.unit_type}
                            </span>
                        )}
                    </div>
                </div>
            )
        },
        {
            key: 'cogs', label: 'COGS',
            render: r => (
                <div className="flex items-center gap-3 text-[11px]">
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400 font-bold text-[9px] uppercase">Cost:</span>
                        <span className="font-bold text-primary-600 flex items-center">₹<EditableCell value={r.cogs} type="number" onSave={v => handleInlineUpdate(r.id, 'cogs', v)} /></span>
                    </div>
                </div>
            )
        },
        {
            key: 'pricing', label: 'Pricing',
            render: r => (
                <div className="flex items-center gap-3 text-[11px]">
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400 font-bold text-[9px] uppercase">Sale:</span>
                        <span className="font-bold text-primary-600 flex items-center">₹<EditableCell value={r.sale_price} type="number" onSave={v => handleInlineUpdate(r.id, 'sale_price', v)} /></span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400 font-bold text-[9px] uppercase">MRP:</span>
                        <span className="text-gray-400 line-through"><EditableCell value={r.mrp} type="number" onSave={v => handleInlineUpdate(r.id, 'mrp', v)} /></span>
                    </div>
                </div>
            ),
        },

        {
            key: 'stock', label: 'Inventory',
            render: r => {
                const isLow = parseFloat(r.stock_qty) <= parseFloat(r.low_stock_alert)
                return (
                    <div className="flex items-center gap-3 text-[11px]">
                        <div className="flex items-center gap-1">
                            <span className="text-gray-400 font-bold text-[9px] uppercase">Qty:</span>
                            <span className={`font-bold ${isLow ? 'text-red-600' : 'text-gray-800'}`}>
                                {parseFloat(r.stock_qty).toLocaleString()}<span className="ml-0.5 text-[9px] uppercase text-gray-500">{r.stock_unit || r.unit_type || 'pcs'}</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-gray-400 font-bold text-[9px] uppercase">Alert:</span>
                            <EditableCell value={r.low_stock_alert} type="number" onSave={v => handleInlineUpdate(r.id, 'low_stock_alert', v)} />
                        </div>
                    </div>
                )
            },
        },
        {
            key: 'location', label: 'Logistics',
            render: r => (
                <div className="flex items-center gap-3 text-[10px]">
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400 font-bold text-[9px] uppercase">Aisle:</span>
                        <EditableCell value={r.aisle_location || '—'} onSave={v => handleInlineUpdate(r.id, 'aisle_location', v)} />
                    </div>
                </div>
            ),
        },

        {
            key: 'status', label: 'Active',
            render: r => (
                <div className="flex items-center justify-center">
                    <button onClick={e => { e.stopPropagation(); dispatch(toggleInventoryActive(r)) }}
                        className={`w-7 h-4 rounded-full transition-all duration-200 relative ${r.is_active ? 'bg-green-500 shadow-sm' : 'bg-gray-300'}`}>
                        <span className={`absolute top-0.5 left-0.5 block w-3 h-3 rounded-full bg-white transition-transform duration-200 ${r.is_active ? 'translate-x-3' : 'translate-x-0'}`} />
                    </button>
                </div>
            ),
        },
        {
            key: 'actions', label: '',
            render: r => (
                <div className="flex justify-end pr-2 gap-1">
                    <button onClick={e => { e.stopPropagation(); setRestockItem(r) }}
                        className="text-[10px] text-green-700 font-black hover:bg-green-50 px-2 py-1 rounded transition-colors uppercase tracking-tighter">Stock</button>
                    <button onClick={e => { e.stopPropagation(); setHistoryItem(r) }}
                        className="text-[10px] text-gray-600 font-black hover:bg-gray-100 px-2 py-1 rounded transition-colors uppercase tracking-tighter">History</button>
                </div>
            ),
        },
    ]

    const statsCards = backendSummary
        ? [
            { label: 'Total Items', value: backendSummary.total_items, color: 'text-gray-700' },
            { label: 'Out of Stock', value: backendSummary.out_of_stock, color: 'text-red-600' },
            { label: 'Low Stock', value: backendSummary.low_stock, color: 'text-yellow-600' },
            { label: 'Active', value: backendSummary.active_items, color: 'text-green-600' },
            { label: 'In Active', value: backendSummary.inactive_items, color: 'text-gray-600' },
            { label: 'Expiring Soon', value: backendSummary.expiring_soon, color: 'text-orange-500' },
            { label: 'Expired', value: backendSummary.expired, color: 'text-red-800 font-bold' },
            {
                label: 'Stock Value',
                value: backendSummary.total_stock_value != null
                    ? `₹${Number(backendSummary.total_stock_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                    : '—',
                color: 'text-primary-600',
            },
        ]
        : [
            { label: 'Total Items', value: localStats.total, color: 'text-gray-700' },
            { label: 'Out of Stock', value: localStats.outOfStock, color: 'text-red-600' },
            { label: 'Low Stock', value: localStats.lowStock, color: 'text-yellow-600' },
            { label: 'Active', value: localStats.active, color: 'text-green-600' },
        ]

    return (
        <div className="p-4 sm:p-6 space-y-4">
            <PageHeader
                title="Inventory"
                subtitle="Manage stock, prices, and availability for your mart"
                action={
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setBulkOpen(true)} >📤 Bulk Upload</Button>
                        <Button variant="secondary" onClick={handleRefresh} disabled={!martId}>↻ Refresh</Button>
                        <Button variant="primary" onClick={() => { setForm(EMPTY_FORM); setAddOpen(true) }} >+ Add Item</Button>
                    </div>
                }
            />

            {/* Segmented Tab Switcher */}
            {martId && (
                <div className="flex bg-gray-100 p-1 rounded-xl w-fit border border-gray-200">
                    <button
                        onClick={() => setActiveTab('inventory')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                            activeTab === 'inventory'
                                ? 'bg-white text-gray-800 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        🎒 Shelf Inventory
                    </button>
                    <button
                        onClick={() => setActiveTab('batches')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                            activeTab === 'batches'
                                ? 'bg-white text-gray-800 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        📦 Supplier Batch Tracking
                    </button>
                </div>
            )}

            {/* Stats */}
            {martId && (items.length > 0 || backendSummary) && (
                <div className="flex gap-3 flex-wrap">
                    {statsCards.map(s => (
                        <div key={s.label} className="bg-white border border-gray-100 rounded-xl px-4 py-2.5 shadow-sm min-w-[100px]">
                            <p className={`text-xl font-bold ${s.color}`}>
                                {summaryLoading && backendSummary === null ? '…' : s.value}
                            </p>
                            <p className="text-[11px] text-gray-400">{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Filter Bar */}
            {martId && (
                <FilterBar
                    committedFilters={committedFilters}
                    onSearch={handleSearch}
                    onReset={handleFilterReset}
                    loading={filteredLoad}
                    martId={martId}
                />
            )}

            {/* Result summary line */}
            {martId && pagination && (
                <div className="flex items-center justify-between px-1">
                    <p className="text-xs text-gray-500">
                        {pagination.total === 0
                            ? 'No items match your filters'
                            : <><span className="font-semibold text-gray-700">{pagination.total}</span> item{pagination.total !== 1 ? 's' : ''} found</>
                        }
                    </p>
                    {pagination.total_pages > 1 && (
                        <p className="text-xs text-gray-400">Page {pagination.page} of {pagination.total_pages}</p>
                    )}
                </div>
            )}

            {/* Grid */}
            {!martId ? (
                <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-500 font-medium">
                    Please select a mart from the dropdown to view its inventory.
                </div>
            ) : activeTab === 'batches' ? (
                <div className="space-y-3">
                    {/* Batch Search + Filter Pills — same UX as warehouse inventory */}
                    <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                        <div className="flex flex-col lg:flex-row gap-3 items-center">
                            {/* Search */}
                            <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 hover:border-primary-300 hover:bg-white transition-all duration-200">
                                <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    value={batchSearch}
                                    onChange={e => setBatchSearch(e.target.value)}
                                    placeholder="Search product, variant, batch number..."
                                    className="w-full text-xs outline-none bg-transparent font-medium text-gray-700 placeholder-gray-400"
                                />
                                {batchSearch && (
                                    <button
                                        onClick={() => setBatchSearch('')}
                                        className="text-xs text-gray-400 hover:text-rose-500 font-bold shrink-0 transition-colors"
                                    >✕</button>
                                )}
                            </div>

                            {/* Filter Pills */}
                            <div className="flex items-center gap-2 flex-wrap">
                                {[
                                    { id: 'expiring_soon', label: 'Expiring Soon', emoji: '⏳' },
                                    { id: 'all',           label: 'All Batches',   emoji: '📦' },
                                    { id: 'expired',       label: 'Expired',       emoji: '🚫' },
                                    { id: 'low_stock',     label: 'Low Stock',     emoji: '⚠️' },
                                ].map(f => (
                                    <button
                                        key={f.id}
                                        onClick={() => setBatchFilter(f.id)}
                                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border transition-all duration-150 whitespace-nowrap ${
                                            batchFilter === f.id
                                                ? f.id === 'expiring_soon'
                                                    ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
                                                    : f.id === 'expired'
                                                        ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                                                        : f.id === 'low_stock'
                                                            ? 'bg-rose-500 border-rose-500 text-white shadow-sm'
                                                            : 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                                        }`}
                                    >
                                        {f.emoji} {f.label}
                                        {martBatchesLoading && batchFilter === f.id && (
                                            <svg className="w-3 h-3 animate-spin ml-1" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Active filter summary */}
                        {(batchSearch || batchFilter !== 'expiring_soon') && (
                            <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-gray-100">
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Filters:</span>
                                {batchFilter !== 'all' && (
                                    <span className="inline-flex items-center text-[11px] font-semibold bg-white border border-primary-200 text-primary-700 px-2.5 py-0.5 rounded-full shadow-sm">
                                        {batchFilter === 'expiring_soon' ? '⏳ Expiring Soon' : batchFilter === 'expired' ? '🚫 Expired' : '⚠️ Low Stock'}
                                    </span>
                                )}
                                {batchSearch && (
                                    <span className="inline-flex items-center text-[11px] font-semibold bg-white border border-primary-200 text-primary-700 px-2.5 py-0.5 rounded-full shadow-sm">
                                        🔍 "{batchSearch}"
                                    </span>
                                )}
                                <span className="ml-auto text-[11px] font-bold text-gray-500">
                                    {martBatchesLoading ? 'Loading…' : `${sortedMartBatches.length} batch${sortedMartBatches.length !== 1 ? 'es' : ''}`}
                                </span>
                                <button
                                    onClick={() => { setBatchSearch(''); setBatchFilter('expiring_soon') }}
                                    className="text-[11px] font-bold text-red-400 hover:text-red-600 transition-colors"
                                >✕ Reset</button>
                            </div>
                        )}
                    </div>

                    <Grid
                        columns={batchColumns}
                        data={sortedMartBatches}
                        loading={martBatchesLoading}
                        emptyText="No product batches found matching search criteria."
                        pagination={false}
                        showSearch={false}
                        rowClassName={row => {
                            const isExpired = checkIsExpired(row.expiry_date);
                            const isExpiring = checkIsExpiringSoon(row.expiry_date);
                            const isLow = parseFloat(row.stock_qty || 0) > 0 && parseFloat(row.stock_qty || 0) <= parseFloat(row.low_stock_alert || 10);
                            if (isExpired) return 'bg-red-900 text-white font-semibold border-l-4 border-red-600';
                            if (isExpiring) return 'bg-orange-50 text-orange-950 border-l-4 border-orange-500 font-medium';
                            if (isLow) return 'bg-red-50 text-red-900 border-l-4 border-red-500 font-semibold';
                            return '';
                        }}
                    />
                </div>
            ) : (
                <Grid
                    columns={columns}
                    data={sortedFilteredItems}
                    loading={filteredLoad}
                    emptyText="No inventory items match your filters."
                    pagination={false}
                    showSearch={false}
                    rowClassName={row => {
                        const isExpired = checkIsExpired(row.expiry_date);
                        const isExpiring = checkIsExpiringSoon(row.expiry_date);
                        const isLow = parseFloat(row.stock_qty || 0) <= parseFloat(row.low_stock_alert || 0);
                        if (isExpired) return 'bg-red-900 text-white font-semibold border-l-4 border-red-600';
                        if (isExpiring) return 'bg-orange-50 text-orange-950 border-l-4 border-orange-500 font-medium';
                        if (isLow) return 'bg-red-50 text-red-900 border-l-4 border-red-500 font-semibold';
                        return '';
                    }}
                />
            )}

            {/* Pagination */}
            {martId && activeTab === 'inventory' && <PaginationBar pagination={pagination} onPageChange={handlePageChange} />}

            {/* Add Modal */}
            <Modal title="Add Inventory Item" open={addOpen} onClose={() => setAddOpen(false)} size="lg"
                footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={handleAdd}>Add Item</Button></>}>
                <div className="space-y-8">
                    <section className="space-y-4">
                        <h4 className="text-[10px] font-extrabold text-primary-600 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1 h-3 bg-primary-600 rounded-full" />Product Reference
                        </h4>
                        <AlgoliaProductSearch
                            mode="variant"
                            label="Search Catalog Variant *"
                            value={form.variant_label}
                            placeholder="Search by brand, product name, or SKU…"
                            onSelect={(v) => {
                                setF('product_id', v.productId)
                                setF('variant_id', v.variantId)
                                setF('variant_label', v.displayLabel)
                            }}
                            onClear={() => {
                                setF('product_id', '')
                                setF('variant_id', '')
                                setF('variant_label', '')
                            }}
                        />
                        {form.product_id && (
                            <p className="text-[10px] text-gray-400 font-mono">
                                Product ID: {form.product_id} · Variant ID: {form.variant_id}
                            </p>
                        )}
                    </section>
                    <section className="space-y-4">
                        <h4 className="text-[10px] font-extrabold text-primary-600 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1 h-3 bg-primary-600 rounded-full" />Pricing
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <Input label="Sale Price (₹) *" type="number" value={form.sale_price} onChange={e => setF('sale_price', e.target.value)} placeholder="49.00" />
                            <Input label="MRP (₹) *" type="number" value={form.mrp} onChange={e => setF('mrp', e.target.value)} placeholder="55.00" />
                        </div>
                    </section>
                    <section className="space-y-4">
                        <h4 className="text-[10px] font-extrabold text-primary-600 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1 h-3 bg-primary-600 rounded-full" />Stock Information
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <Input label="Stock Qty *" type="number" value={form.stock_qty} onChange={e => setF('stock_qty', e.target.value)} placeholder="100" />
                            <Select label="Stock Unit *" value={form.stock_unit} onChange={e => setF('stock_unit', e.target.value)}>
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </Select>
                            <Select label="Transaction Type *" value={form.type} onChange={e => setF('type', e.target.value)}>
                                {USER_TXN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </Select>
                            <Input label="Low Stock Alert *" type="number" value={form.low_stock_alert} onChange={e => setF('low_stock_alert', e.target.value)} placeholder="10" />
                        </div>
                        <p className="text-[10px] text-gray-500">Type defaults to "restock". Use "return", "damage", "expired" for other sources.</p>
                    </section>
                    <section className="space-y-4">
                        <h4 className="text-[10px] font-extrabold text-primary-600 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1 h-3 bg-primary-600 rounded-full" />Additional Details
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <Input label="Expiry Date" type="date" value={form.expiry_date} onChange={e => setF('expiry_date', e.target.value)} />
                            <Input label="Batch Number" value={form.batch_number} onChange={e => setF('batch_number', e.target.value)} placeholder="BATCH-2026-001" />
                            <Input label="Aisle Location" value={form.aisle_location} onChange={e => setF('aisle_location', e.target.value)} placeholder="A3-Shelf2" />
                        </div>
                    </section>
                </div>
            </Modal>

            <RestockModal open={!!restockItem} onClose={() => setRestockItem(null)} item={restockItem} martId={martId} />
            <HistoryModal open={!!historyItem} onClose={() => setHistoryItem(null)} item={historyItem} />

            <BulkUploadModal
                open={bulkOpen} onClose={() => setBulkOpen(false)}
                title="Bulk Upload Inventory"
                schemaFields={SCHEMA_FIELDS} fieldValidators={FIELD_VALIDATORS}
                onUpload={async (_, file) => {
                    const action = await dispatch(bulkUploadInventory({ file, martId, staffId }))
                    return action.payload
                }}
                downloadCSVTemplate={downloadCSVTemplate}
                downloadXLSXTemplate={downloadXLSXTemplate}
                onDone={(e) => {
                    if (e) { e.preventDefault(); e.stopPropagation() }
                    dispatch(fetchInventory(martId))
                    dispatch(fetchInventorySummary(martId))
                    dispatch(fetchInventoryFiltered({ martId, ...committedFilters }))
                }}
            />
        </div>
    )
}