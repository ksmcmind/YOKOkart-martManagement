// src/pages/Inventory.jsx
//
// Mart admin inventory management — same pattern as super-admin Products.jsx.
// Uses reusable Grid + BulkUploadModal components.
//
// Bulk upload sends CSV/XLSX file + martId as FormData to /inventory/bulk.
// Backend stamps mongo_mart_id on every row before inserting.
//
// CSV schema matches the PG `inventory` table (user-fillable columns only).
// DB-generated columns (id, created_at, updated_at, last_restocked_at) are NOT in CSV.

import { useEffect, useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import * as XLSX from 'xlsx'
import {
    fetchInventory,
    addInventoryItem,
    updateInventoryItem,
    toggleInventoryActive,
    deleteInventoryItem,
    bulkUploadInventory,
    selectInventoryItems,
    selectInventoryLoading,
    selectInventorySaving,
    selectInventoryStats,
    selectFilteredInventory,
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

// ── Constants ────────────────────────────────────────────────────────────────

const UNITS = ['kg', 'g', 'l', 'ml', 'pcs', 'dozen']

const SCHEMA_FIELDS = [
    'product_id',
    'variant_id',
    'sale_price',
    'mrp',
    'stock_qty',
    'stock_unit',
    'low_stock_alert',
    'expiry_date',
    'batch_number',
    'aisle_location',
    'is_active',
]

// Client-side validators for BulkUploadModal
const FIELD_VALIDATORS = {
    product_id: v => /^[a-f0-9]{24}$/i.test((v || '').trim()) || 'must be 24-char hex ObjectId',
    variant_id: v => (v || '').trim().length > 0 && v.length <= 50 || 'required, max 50 chars',
    sale_price: v => { const n = parseFloat(v); if (isNaN(n)) return 'must be a number'; if (n < 0) return 'must be >= 0'; return true },
    mrp: v => { const n = parseFloat(v); if (isNaN(n)) return 'must be a number'; if (n < 0) return 'must be >= 0'; return true },
    stock_qty: v => { const n = parseFloat(v); if (isNaN(n)) return 'must be a number'; if (n < 0) return 'must be >= 0'; return true },
    stock_unit: v => UNITS.includes((v || '').toLowerCase().trim()) || `must be one of: ${UNITS.join(', ')}`,
    low_stock_alert: v => { const n = parseFloat(v); if (isNaN(n)) return 'must be a number'; if (n < 0) return 'must be >= 0'; return true },
    expiry_date: v => { if (!v || !v.trim()) return true; const d = new Date(v); if (isNaN(d.getTime())) return 'must be YYYY-MM-DD'; return true },
    batch_number: v => { if (!v || !v.trim()) return true; return v.length <= 50 || 'max 50 chars' },
    aisle_location: v => { if (!v || !v.trim()) return true; return v.length <= 50 || 'max 50 chars' },
    is_active: v => ['true', 'false'].includes((v || '').toLowerCase().trim()) || 'must be "true" or "false"',
}

// ── Template generators ──────────────────────────────────────────────────────

const SAMPLE_ROW = [
    '64f1a2b3c4d5e6f7a8b9c0d1', 'VID-AMUL-500', '49.00', '55.00',
    '100', 'pcs', '10', '2026-12-31', 'BATCH-001', 'A3-Shelf2', 'true',
]
const SAMPLE_ROW_2 = [
    '64f1a2b3c4d5e6f7a8b9c0d2', 'VID-TATA-1KG', '22.00', '24.00',
    '50', 'kg', '5', '', '', 'B1-Shelf1', 'true',
]

const downloadCSVTemplate = () => {
    const comments = [
        '# Inventory Bulk Upload — CSV Template',
        '# mongo_mart_id is NOT in this CSV — backend fills it from your session.',
        '# stock_unit: kg | g | l | ml | pcs | dozen',
        '# Dates: YYYY-MM-DD format. Leave empty for: expiry_date, batch_number, aisle_location.',
        '',
    ]
    const header = SCHEMA_FIELDS.join(',')
    const rows = [SAMPLE_ROW, SAMPLE_ROW_2].map(r => r.join(',')).join('\n')
    const blob = new Blob([[...comments, header, rows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'inventory_template.csv'
    a.click()
    URL.revokeObjectURL(a.href)
}

const downloadXLSXTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([SCHEMA_FIELDS, SAMPLE_ROW, SAMPLE_ROW_2])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory')
    XLSX.writeFile(wb, 'inventory_template.xlsx')
}

// ── Empty form ───────────────────────────────────────────────────────────────

const EMPTY_FORM = {
    product_id: '', variant_id: '', sale_price: '', mrp: '',
    stock_qty: '', stock_unit: 'pcs', low_stock_alert: '10',
    expiry_date: '', batch_number: '', aisle_location: '', is_active: true,
}

// ── Inline editable cell ─────────────────────────────────────────────────────

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
                onChange={e => setVal(e.target.value)}
                onBlur={commit}
                onKeyDown={e => {
                    if (e.key === 'Enter') commit()
                    if (e.key === 'Escape') { setVal(value); setEditing(false) }
                }}
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

// ── Stock badge ──────────────────────────────────────────────────────────────

function StockBadge({ qty, alert }) {
    const q = parseFloat(qty)
    const a = parseFloat(alert)
    if (q <= 0) return <Badge variant="red">Out of Stock</Badge>
    if (q <= a) return <Badge variant="yellow">Low Stock</Badge>
    return <Badge variant="green">In Stock</Badge>
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function Inventory() {
    const dispatch = useDispatch()
    const { martId, staffId, isLoggedIn, isInitialized, user } = useAuth()

    // ── LOG 1: What does useAuth actually give us?
    console.log('🅰️ [Inventory] useAuth returns:', {
        martId,
        martIdType: typeof martId,
        staffId,
        isLoggedIn,
        isInitialized,
        user,
    })
    const resolvedMartId = martId

    const items = useSelector(selectInventoryItems)
    const loading = useSelector(selectInventoryLoading)
    const saving = useSelector(selectInventorySaving)
    const stats = useSelector(selectInventoryStats)

    const [search, setSearch] = useState('')
    const [addOpen, setAddOpen] = useState(false)
    const [bulkOpen, setBulkOpen] = useState(false)
    const [form, setForm] = useState(EMPTY_FORM)

    const filtered = useSelector(s => selectFilteredInventory(s, search))

    useEffect(() => {
        if (martId) {
            dispatch(fetchInventory(martId))
        }
    }, [martId, dispatch])

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    // ── Single add ──────────────────────────────────────────────────────────
    const handleAdd = async () => {
        const required = [
            'product_id', 'variant_id', 'sale_price', 'mrp',
            'stock_qty', 'stock_unit', 'low_stock_alert',
        ]
        const missing = required.find(k => form[k] === '' || form[k] === null || form[k] === undefined)
        if (missing) {
            dispatch(showToast({ message: `${missing.replace(/_/g, ' ')} is required`, type: 'error' }))
            return
        }
        if (!/^[a-f0-9]{24}$/i.test(form.product_id)) {
            dispatch(showToast({ message: 'Product ID must be 24-char hex ObjectId', type: 'error' }))
            return
        }
        if (parseFloat(form.sale_price) > parseFloat(form.mrp)) {
            dispatch(showToast({ message: 'Sale price cannot exceed MRP', type: 'error' }))
            return
        }

        const action = await dispatch(addInventoryItem({
            ...form,
            mongo_mart_id: resolvedMartId,
            mongo_staff_id: staffId,
            sale_price: parseFloat(form.sale_price),
            mrp: parseFloat(form.mrp),
            stock_qty: parseFloat(form.stock_qty),
            low_stock_alert: parseFloat(form.low_stock_alert),
            expiry_date: form.expiry_date || null,
            batch_number: form.batch_number || null,
            aisle_location: form.aisle_location || null,
        }))
        if (addInventoryItem.fulfilled.match(action)) {
            setAddOpen(false); setForm(EMPTY_FORM)
        }
    }

    // ── Inline update ───────────────────────────────────────────────────────
    const handleInlineUpdate = (id, field, value) => {
        const isNumeric = ['sale_price', 'mrp', 'stock_qty', 'low_stock_alert'].includes(field)
        dispatch(updateInventoryItem({
            id,
            patch: { [field]: isNumeric ? parseFloat(value) : value },
        }))
    }

    // ── Grid columns ────────────────────────────────────────────────────────
    const columns = [
        {
            key: 'product',
            label: 'Product ID',
            render: r => (
                <div className="flex items-center gap-2 py-1">
                    <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold border border-gray-200">
                        #{r.mongo_product_id}
                    </span>

                </div>
            ),
        },
        {
            key: 'variant',
            label: 'Variant',
            render: r => (
                <div className="py-1">
                    <Badge variant="blue" size="xs" className="font-bold tracking-wide">
                        {r.variant_id}
                    </Badge>
                </div>
            ),
        },
        {
            key: 'pricing',
            label: 'Pricing',
            render: r => (
                <div className="flex items-center gap-3 text-[11px]">
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400 font-bold text-[9px] uppercase">Sale:</span>
                        <span className="font-bold text-primary-600 flex items-center">
                            ₹<EditableCell value={r.sale_price} type="number" onSave={v => handleInlineUpdate(r.id, 'sale_price', v)} />
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400 font-bold text-[9px] uppercase">MRP:</span>
                        <span className="text-gray-400 line-through">
                            <EditableCell value={r.mrp} type="number" onSave={v => handleInlineUpdate(r.id, 'mrp', v)} />
                        </span>
                    </div>
                </div>
            ),
        },
        {
            key: 'stock',
            label: 'Inventory',
            render: r => {
                const isLow = parseFloat(r.stock_qty) <= parseFloat(r.low_stock_alert);
                return (
                    <div className="flex items-center gap-3 text-[11px]">
                        <div className="flex items-center gap-1">
                            <span className="text-gray-400 font-bold text-[9px] uppercase">Qty:</span>
                            <div className={`flex items-center font-bold ${isLow ? 'text-red-600' : 'text-gray-800'}`}>
                                <EditableCell value={r.stock_qty} type="number" onSave={v => handleInlineUpdate(r.id, 'stock_qty', v)} />
                                <span className="ml-0.5 text-[9px] uppercase">{r.stock_unit}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-gray-400 font-bold text-[9px] uppercase">Alert:</span>
                            <EditableCell className="text-gray-500" value={r.low_stock_alert} type="number" onSave={v => handleInlineUpdate(r.id, 'low_stock_alert', v)} />
                        </div>
                    </div>
                );
            },
        },
        {
            key: 'location',
            label: 'Logistics',
            render: r => (
                <div className="flex items-center gap-3 text-[10px]">
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400 font-bold text-[9px] uppercase">Batch:</span>
                        <EditableCell className="font-mono text-gray-700" value={r.batch_number || '—'} onSave={v => handleInlineUpdate(r.id, 'batch_number', v)} />
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400 font-bold text-[9px] uppercase">Aisle:</span>
                        <EditableCell className="text-gray-700" value={r.aisle_location || '—'} onSave={v => handleInlineUpdate(r.id, 'aisle_location', v)} />
                    </div>
                </div>
            )
        },
        {
            key: 'expiry_restock',
            label: 'Dates',
            render: r => (
                <div className="flex items-center gap-3 text-[10px]">
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400 font-bold text-[9px] uppercase">Exp:</span>
                        <EditableCell
                            className={`font-bold px-1 py-0.5 rounded ${!r.expiry_date ? 'text-gray-300 underline decoration-dotted' : 'text-red-600 bg-red-50'}`}
                            value={r.expiry_date?.slice(0, 10) || 'SET'}
                            type="date"
                            onSave={v => handleInlineUpdate(r.id, 'expiry_date', v)}
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400 font-bold text-[9px] uppercase">In:</span>
                        <span className="text-gray-600 font-medium">
                            {r.last_restocked_at ? new Date(r.last_restocked_at).toLocaleDateString('en-GB') : '—'}
                        </span>
                    </div>
                </div>
            )
        },
        {
            key: 'status',
            label: 'Active',
            render: r => (
                <div className="flex items-center justify-center">
                    <button
                        onClick={(e) => { e.stopPropagation(); dispatch(toggleInventoryActive(r)) }}
                        className={`w-7 h-4 rounded-full transition-all duration-200 relative ${r.is_active ? 'bg-green-500 shadow-sm' : 'bg-gray-300'}`}
                    >
                        <span className={`absolute top-0.5 left-0.5 block w-3 h-3 rounded-full bg-white transition-transform duration-200 ${r.is_active ? 'translate-x-3' : 'translate-x-0'}`} />
                    </button>
                </div>
            ),
        },
        {
            key: 'actions',
            label: '',
            render: r => (
                <div className="flex justify-end pr-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(r) }}
                        className="text-[10px] text-primary-600 font-black hover:bg-primary-50 px-2 py-1 rounded transition-colors uppercase tracking-tighter"
                    >
                        Edit
                    </button>
                </div>
            )
        }
    ];
    // ── Expanded row detail ──────────────────────────────────────────────────
    const renderExpanded = (r) => (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Full Product ID</p>
                <p className="font-mono text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-100 text-[11px]">{r.product_id}</p>
            </div>
            <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Variant ID</p>
                <p className="font-mono text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-100 text-[11px]">{r.variant_id}</p>
            </div>
            <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Mart ID</p>
                <p className="font-mono text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-100 text-[11px]">{r.mongo_mart_id}</p>
            </div>
            <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Last Restocked</p>
                <p className="text-gray-700 text-[11px]">{r.last_restocked_at ? new Date(r.last_restocked_at).toLocaleDateString() : '—'}</p>
            </div>
            <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Created</p>
                <p className="text-gray-700 text-[11px]">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</p>
            </div>
            <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Updated</p>
                <p className="text-gray-700 text-[11px]">{r.updated_at ? new Date(r.updated_at).toLocaleDateString() : '—'}</p>
            </div>
        </div>
    )

    return (
        <div className="p-4 sm:p-6 space-y-4">
            <PageHeader
                title="Inventory"
                subtitle="Manage stock, prices, and availability for your mart"
                action={
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setBulkOpen(true)}>📤 Bulk Upload</Button>
                        <Button variant="secondary" onClick={() => dispatch(fetchInventory(resolvedMartId))}>↻ Refresh</Button>
                        <Button variant="primary" onClick={() => { setForm(EMPTY_FORM); setAddOpen(true) }}>+ Add Item</Button>
                    </div>
                }
            />

            {/* Stats Cards */}
            {items.length > 0 && (
                <div className="flex gap-3 flex-wrap">
                    {[
                        { label: 'Total Items', value: stats.total, color: 'text-gray-700' },
                        { label: 'Out of Stock', value: stats.outOfStock, color: 'text-red-600' },
                        { label: 'Low Stock', value: stats.lowStock, color: 'text-yellow-600' },
                        { label: 'Active', value: stats.active, color: 'text-green-600' },
                    ].map(s => (
                        <div key={s.label} className="bg-white border border-gray-100 rounded-lg px-4 py-2 shadow-sm">
                            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                            <p className="text-xs text-gray-400">{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Grid — same pattern as super-admin Products.jsx */}
            <Grid
                columns={columns}
                data={filtered}
                loading={loading}
                emptyText="No inventory items yet. Add one or bulk upload CSV."
                // externalSearchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search by product ID, variant, aisle..."
                // renderExpanded={renderExpanded}
                pageSize={15}
            />

            {/* Add Item Modal */}
            <Modal
                title="Add Inventory Item"
                open={addOpen}
                onClose={() => { setAddOpen(false) }}
                size="lg"
                footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={handleAdd}>Add Item</Button></>}
            >
                <div className="space-y-8">
                    <section className="space-y-4">
                        <h4 className="text-[10px] font-extrabold text-primary-600 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1 h-3 bg-primary-600 rounded-full"></span>
                            Product Reference
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <Input label="Product ID (Mongo) *" value={form.product_id}
                                onChange={e => set('product_id', e.target.value)} placeholder="64f1a2b3c4d5e6f7a8b9c0d1" />
                            <Input label="Variant ID *" value={form.variant_id}
                                onChange={e => set('variant_id', e.target.value)} placeholder="VID-AMUL-500" />
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h4 className="text-[10px] font-extrabold text-primary-600 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1 h-3 bg-primary-600 rounded-full"></span>
                            Pricing
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <Input label="Sale Price (₹) *" type="number" value={form.sale_price}
                                onChange={e => set('sale_price', e.target.value)} placeholder="49.00" />
                            <Input label="MRP (₹) *" type="number" value={form.mrp}
                                onChange={e => set('mrp', e.target.value)} placeholder="55.00" />
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h4 className="text-[10px] font-extrabold text-primary-600 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1 h-3 bg-primary-600 rounded-full"></span>
                            Stock Information
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <Input label="Stock Qty *" type="number" value={form.stock_qty}
                                onChange={e => set('stock_qty', e.target.value)} placeholder="100" />
                            <Select label="Stock Unit *" value={form.stock_unit}
                                onChange={e => set('stock_unit', e.target.value)}>
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </Select>
                            <Input label="Low Stock Alert *" type="number" value={form.low_stock_alert}
                                onChange={e => set('low_stock_alert', e.target.value)} placeholder="10" />
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h4 className="text-[10px] font-extrabold text-primary-600 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1 h-3 bg-primary-600 rounded-full"></span>
                            Additional Details
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <Input label="Expiry Date" type="date" value={form.expiry_date}
                                onChange={e => set('expiry_date', e.target.value)} />
                            <Input label="Batch Number" value={form.batch_number}
                                onChange={e => set('batch_number', e.target.value)} placeholder="BATCH-2026-001" />
                            <Input label="Aisle Location" value={form.aisle_location}
                                onChange={e => set('aisle_location', e.target.value)} placeholder="A3-Shelf2" />
                        </div>
                    </section>
                </div>
            </Modal>

            {/* Bulk Upload — reusable component, same as super-admin */}
            <BulkUploadModal
                open={bulkOpen}
                onClose={() => setBulkOpen(false)}
                title="Bulk Upload Inventory"
                schemaFields={SCHEMA_FIELDS}
                fieldValidators={FIELD_VALIDATORS}
                onUpload={async (items, file) => {
                    const action = await dispatch(bulkUploadInventory({
                        file,
                        martId: resolvedMartId,
                        staffId: staffId,
                    }))
                    return action.payload
                }}
                downloadCSVTemplate={downloadCSVTemplate}
                downloadXLSXTemplate={downloadXLSXTemplate}
                // In Inventory.jsx
                onDone={(e) => {
                    if (e) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    dispatch(fetchInventory(resolvedMartId));
                }}
            />
        </div>
    )
}