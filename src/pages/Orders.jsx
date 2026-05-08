// src/pages/Orders.jsx
import { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    fetchOrders, fetchOrderById, updateOrderStatus,
    selectAllOrders, selectOrderLoading, selectOrderPagination
} from '../store/slices/orderSlice'
import { fetchMarts } from '../store/slices/martSlice'
import { showToast } from '../store/slices/uiSlice'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Table from '../components/Table'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import MartSelector from '../pages/MartSelector'
import useMart from '../hooks/useMart'
import api from '../api/index'
import {
    fetchAvailableDrivers,
    assignDriverToOrder,
    selectAvailableDrivers,
} from '../store/slices/driverSlice'
// ── Status flow — matches backend VALID_STATUSES ──────────────
const STATUS_FLOW = {
    pending: { next: 'confirmed', label: '✓ Confirm', color: 'blue' },
    confirmed: { next: 'packed', label: '📦 Mark Packed', color: 'purple' },
    packed: { next: null, label: '🚗 Assign Driver', color: 'orange', special: 'assign' },
    assigned: { next: 'out_for_delivery', label: '▶ Start Trip', color: 'yellow' },
    out_for_delivery: { next: 'delivered', label: '✅ Delivered', color: 'green' },
}

const STATUS_BADGE = {
    pending: 'yellow',
    confirmed: 'blue',
    packed: 'purple',
    assigned: 'orange',
    out_for_delivery: 'blue',
    delivered: 'green',
    cancelled: 'red',
    refunded: 'red',
    preparing: 'purple',
}

const STATUSES = [
    '', 'pending', 'confirmed', 'packed', 'assigned',
    'out_for_delivery', 'delivered', 'cancelled', 'refunded'
]

const fmtDate = (iso) => !iso ? '—' : new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true
})

// ── FilterBar ─────────────────────────────────────────────────
function FilterBar({ committedFilters, onSearch, onReset, loading }) {
    const [draft, setDraft] = useState(committedFilters)
    useEffect(() => { setDraft(committedFilters) }, [committedFilters])

    const set = (k, v) => setDraft(f => ({ ...f, [k]: v }))
    const commit = () => onSearch({ ...draft, page: 1 })
    const reset = () => { setDraft({ status: '', search: '', orderType: '', startDate: '', endDate: '' }); onReset() }
    const onEnter = e => { if (e.key === 'Enter') commit() }

    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex gap-2 p-3 flex-wrap">
                {/* Search */}
                <div className="relative flex-1 min-w-[180px]">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        value={draft.search || ''}
                        onChange={e => set('search', e.target.value)}
                        onKeyDown={onEnter}
                        placeholder="Search Order ID…"
                        className="w-full text-xs pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-4 focus:ring-green-500/10 focus:border-green-500 focus:outline-none transition-all bg-gray-50 focus:bg-white placeholder-gray-400"
                    />
                </div>

                {/* Status */}
                <select
                    value={draft.status || ''}
                    onChange={e => set('status', e.target.value)}
                    className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 outline-none focus:border-green-500 min-w-[130px]"
                >
                    <option value="">All Statuses</option>
                    {STATUSES.filter(Boolean).map(s => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                    ))}
                </select>

                {/* Type */}
                <select
                    value={draft.orderType || ''}
                    onChange={e => set('orderType', e.target.value)}
                    className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 outline-none focus:border-green-500 min-w-[110px]"
                >
                    <option value="">All Types</option>
                    <option value="delivery">Delivery</option>
                    <option value="pos">POS</option>
                </select>

                {/* Date range */}
                <div className="flex items-center gap-1.5 px-3 border border-gray-200 rounded-xl bg-gray-50 shrink-0">
                    <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <input type="date" value={draft.startDate || ''} onChange={e => set('startDate', e.target.value)}
                        className="text-xs bg-transparent outline-none py-2 text-gray-700 cursor-pointer" />
                    <span className="text-gray-400 text-xs">→</span>
                    <input type="date" value={draft.endDate || ''} onChange={e => set('endDate', e.target.value)}
                        className="text-xs bg-transparent outline-none py-2 text-gray-700 cursor-pointer" />
                </div>

                <Button variant="primary" size="sm" onClick={commit} loading={loading}>Search</Button>
                <Button variant="secondary" size="sm" onClick={reset} disabled={loading}>Reset</Button>
            </div>
        </div>
    )
}

// ── PaginationBar ─────────────────────────────────────────────
function PaginationBar({ pagination, onPageChange }) {
    if (!pagination || pagination.totalPages <= 1) return null
    const { page, totalPages, total, limit } = pagination
    const from = (page - 1) * (limit || 20) + 1
    const to = Math.min(page * (limit || 20), total)

    const getPages = () => {
        if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
        const pages = [1]
        if (page > 3) pages.push('...')
        for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
        if (page < totalPages - 2) pages.push('...')
        pages.push(totalPages)
        return pages
    }

    return (
        <div className="flex items-center justify-between py-3 px-1 border-t border-gray-100 mt-1">
            <span className="text-xs text-gray-500">
                Showing <span className="font-semibold text-gray-700">{from}–{to}</span> of{' '}
                <span className="font-semibold text-gray-700">{total}</span> orders
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
                                }`}>{p}</button>
                )}
                <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
                    className="px-2.5 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:border-primary-300 hover:text-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    Next →
                </button>
            </div>
        </div>
    )
}

// ── AssignDriverModal ─────────────────────────────────────────
function AssignDriverModal({ open, order, martId, onClose, onAssigned }) {
    const dispatch = useDispatch()
    const allDrivers = useSelector(selectAvailableDrivers)  // from driverSlice
    const [driverId, setDriverId] = useState('')
    const [loading, setLoading] = useState(false)

    // Fetch available drivers for this mart when modal opens
    useEffect(() => {
        if (!open || !order || !martId) return
        setDriverId('')
        dispatch(fetchAvailableDrivers({ martId }))
    }, [open, order?.id, martId, dispatch])

    const handleAssign = async () => {
        if (!driverId) {
            dispatch(showToast({ message: 'Please select a driver', type: 'error' }))
            return
        }
        setLoading(true)
        try {
            const res = await dispatch(assignDriverToOrder({ orderId: order.id, driverId }))
            if (assignDriverToOrder.fulfilled.match(res)) {
                dispatch(showToast({ message: `Driver assigned`, type: 'success' }))
                onAssigned()
                onClose()
            } else {
                dispatch(showToast({ message: res.payload || 'Failed to assign', type: 'error' }))
            }
        } finally {
            setLoading(false)
        }
    }

    if (!order) return null
    const addr = order.delivery_address || {}

    return (
        <Modal
            title={`Assign Driver — Order #${order.id?.slice(-8)}`}
            open={open}
            onClose={onClose}
            size="sm"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" loading={loading} onClick={handleAssign}>Assign Driver</Button>
                </>
            }
        >
            <div className="space-y-4">
                {/* Delivery address */}
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1.5">Delivery Address</p>
                    <p className="text-xs font-bold text-gray-800">{addr.name || 'Customer'}</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                        {addr.line1}{addr.city ? `, ${addr.city}` : ''}{addr.pincode ? ` — ${addr.pincode}` : ''}
                    </p>
                    {addr.phone && <p className="text-xs text-gray-500 mt-0.5">📞 {addr.phone}</p>}
                </div>

                {/* Driver dropdown */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        Available Drivers ({allDrivers.length})
                    </label>

                    {allDrivers.length === 0 ? (
                        <div className="text-xs text-gray-400 py-4 text-center bg-gray-50 rounded-xl border border-gray-100">
                            No available drivers right now
                        </div>
                    ) : (
                        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                            {allDrivers.map(d => (
                                <button
                                    key={d.id}
                                    onClick={() => setDriverId(d.id)}
                                    className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${driverId === d.id
                                        ? 'bg-primary-600 border-primary-600 text-white'
                                        : 'bg-white border-gray-200 hover:border-primary-200 hover:bg-primary-50/50'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className={`text-xs font-bold ${driverId === d.id ? 'text-white' : 'text-gray-800'}`}>
                                                {d.name}
                                            </p>
                                            <p className={`text-[10px] mt-0.5 ${driverId === d.id ? 'text-white/70' : 'text-gray-400'}`}>
                                                {d.vehicleType} · {d.vehicleNumber}
                                            </p>
                                        </div>
                                        <p className={`text-[10px] font-bold ${driverId === d.id ? 'text-white/80' : 'text-gray-400'}`}>
                                            📞 {d.phone}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    )
}

// ── OrderDetailModal ──────────────────────────────────────────
function OrderDetailModal({ selected, onClose, onStatus, onAssign }) {
    if (!selected) return null
    const flow = STATUS_FLOW[selected.status]
    const addr = selected.delivery_address || {}

    return (
        <Modal
            title={`Order #${selected.id?.slice(-8)}`}
            open={!!selected}
            onClose={onClose}
            size="lg"
            footer={
                <div className="flex gap-2 justify-end">
                    <Button variant="secondary" onClick={onClose}>Close</Button>
                    {flow && (
                        flow.special === 'assign'
                            ? <Button variant="primary" onClick={() => { onClose(); onAssign(selected) }}>🚗 Assign Driver</Button>
                            : <Button variant="primary" onClick={() => onStatus(selected.id, flow.next)}>{flow.label}</Button>
                    )}
                </div>
            }
        >
            <div className="space-y-5">

                {/* KPI row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        ['Status', <Badge key="s" variant={STATUS_BADGE[selected.status] || 'gray'} size="sm">{selected.status.replace(/_/g, ' ').toUpperCase()}</Badge>],
                        ['Total', <span key="t" className="font-bold text-gray-900">₹{selected.total}</span>],
                        ['Payment', <Badge key="p" variant="gray" size="sm">{selected.payment_method?.toUpperCase()}</Badge>],
                        ['Type', <Badge key="ty" variant={selected.order_type === 'pos' ? 'purple' : 'blue'} size="sm">{selected.order_type?.toUpperCase()}</Badge>],
                    ].map(([label, value]) => (
                        <div key={label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                            <div className="text-sm font-medium text-gray-900">{value}</div>
                        </div>
                    ))}
                </div>

                {/* Driver info — shown when assigned */}
                {selected.driver_id && selected.driver && (
                    <div className="bg-orange-50 rounded-xl p-3 border border-orange-100 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-1">Driver</p>
                            <p className="text-xs font-bold text-gray-800">{selected.driver.name}</p>
                            <p className="text-[10px] text-gray-500">{selected.driver.vehicle_type} · {selected.driver.vehicle_number}</p>
                        </div>
                        {['out_for_delivery', 'delivered'].includes(selected.status) && selected.driver.phone && (
                            <a href={`tel:${selected.driver.phone}`}
                                className="flex items-center gap-1.5 text-xs font-bold text-orange-700 bg-orange-100 px-3 py-2 rounded-lg hover:bg-orange-200 transition-colors">
                                📞 {selected.driver.phone}
                            </a>
                        )}
                    </div>
                )}

                {/* Items */}
                <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="text-left py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Item</th>
                                <th className="text-center py-3 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Price</th>
                                <th className="text-center py-3 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Qty</th>
                                <th className="text-right py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {selected.items?.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="py-3 px-4">
                                        <p className="font-bold text-gray-800">{item.product_name}</p>
                                        <p className="text-[10px] text-gray-400">{item.brand}{item.variant_id ? ` · ${item.variant_id}` : ''}</p>
                                    </td>
                                    <td className="py-3 px-2 text-center">
                                        <p className="font-medium text-gray-900">₹{item.unit_price}</p>
                                        {parseFloat(item.mrp) > parseFloat(item.unit_price) && (
                                            <p className="text-[9px] text-gray-400 line-through">₹{item.mrp}</p>
                                        )}
                                    </td>
                                    <td className="py-3 px-2 text-center font-bold text-gray-700">{item.quantity}</td>
                                    <td className="py-3 px-4 text-right font-bold text-primary-600">₹{item.total_price}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Price summary */}
                <div className="flex justify-end">
                    <div className="w-full md:w-64 space-y-2 p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>Subtotal</span><span className="font-medium">₹{selected.subtotal}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>Delivery Fee</span><span className="font-medium">₹{selected.delivery_fee}</span>
                        </div>
                        {parseFloat(selected.discount) > 0 && (
                            <div className="flex justify-between text-xs text-red-500">
                                <span>Discount</span><span className="font-medium">-₹{selected.discount}</span>
                            </div>
                        )}
                        <div className="pt-2 border-t border-gray-200 flex justify-between text-sm">
                            <span className="font-bold text-gray-900">Grand Total</span>
                            <span className="font-black text-primary-600">₹{selected.total}</span>
                        </div>
                    </div>
                </div>

                {/* Delivery address */}
                {selected.delivery_address && (
                    <div className="bg-primary-50/30 rounded-2xl p-4 border border-primary-100">
                        <h4 className="text-[10px] font-bold text-primary-600 uppercase tracking-widest mb-2">Delivery Details</h4>
                        <p className="text-sm font-bold text-gray-900">{addr.name}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{addr.line1}{addr.city ? `, ${addr.city}` : ''}{addr.pincode ? ` — ${addr.pincode}` : ''}</p>
                        {addr.phone && <p className="text-xs text-gray-500 mt-0.5">📞 {addr.phone}</p>}
                        {selected.delivery_notes && (
                            <div className="mt-2 flex items-start gap-2 bg-white/60 p-2 rounded-lg border border-primary-100">
                                <span className="text-[10px] font-bold text-primary-600 shrink-0">NOTE:</span>
                                <span className="text-[11px] text-gray-600 italic">{selected.delivery_notes}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Timestamps */}
                <div className="flex gap-4 text-[10px] text-gray-400">
                    <span>Placed: <span className="font-medium text-gray-600">{fmtDate(selected.created_at)}</span></span>
                    {selected.updated_at && selected.updated_at !== selected.created_at && (
                        <span>Updated: <span className="font-medium text-gray-600">{fmtDate(selected.updated_at)}</span></span>
                    )}
                </div>
            </div>
        </Modal>
    )
}

// ── Main Page ─────────────────────────────────────────────────
export default function Orders() {
    const dispatch = useDispatch()
    const orders = useSelector(selectAllOrders)
    const loading = useSelector(selectOrderLoading)
    const pagination = useSelector(selectOrderPagination)
    const { activeMartId: martId, selectorProps } = useMart()

    const [committedFilters, setCommittedFilters] = useState({
        status: '', search: '', orderType: '', startDate: '', endDate: '', page: 1
    })
    const [selected, setSelected] = useState(null)
    const [assignOrder, setAssignOrder] = useState(null)

    useEffect(() => { dispatch(fetchMarts()) }, [dispatch])

    useEffect(() => {
        if (martId) dispatch(fetchOrders({ martId, ...committedFilters }))
    }, [martId, committedFilters, dispatch])

    const refresh = useCallback(() => {
        if (martId) dispatch(fetchOrders({ martId, ...committedFilters }))
    }, [martId, committedFilters, dispatch])

    const handleSearch = (f) => setCommittedFilters({ ...f, page: 1 })
    const handleReset = () => setCommittedFilters({ status: '', search: '', orderType: '', startDate: '', endDate: '', page: 1 })
    const handlePageChange = (p) => setCommittedFilters(f => ({ ...f, page: p }))

    const handleStatus = async (orderId, newStatus) => {
        const res = await dispatch(updateOrderStatus({ orderId, status: newStatus }))
        if (!res.error) {
            dispatch(showToast({ message: `Status updated to ${newStatus.replace(/_/g, ' ')}`, type: 'success' }))
            setSelected(null)
            refresh()
        } else {
            dispatch(showToast({ message: res.payload || 'Failed to update status', type: 'error' }))
        }
    }

    const handleView = async (order) => {
        setSelected(order)
        const action = await dispatch(fetchOrderById(order.id))
        if (fetchOrderById.fulfilled.match(action)) setSelected(action.payload)
    }

    const columns = [
        {
            key: 'id', label: 'Order ID',
            render: r => (
                <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold border border-gray-200">
                    #{r.id?.slice(-8)}
                </span>
            )
        },
        {
            key: 'created_at', label: 'Placed',
            render: r => <span className="text-xs text-gray-500">{fmtDate(r.created_at)}</span>
        },
        {
            key: 'total', label: 'Total',
            render: r => <span className="font-bold text-gray-900">₹{r.total}</span>
        },
        {
            key: 'payment_method', label: 'Payment',
            render: r => <Badge variant="gray" size="xs">{r.payment_method?.toUpperCase()}</Badge>
        },
        {
            key: 'order_type', label: 'Type',
            render: r => <Badge variant={r.order_type === 'pos' ? 'purple' : 'blue'} size="xs">{r.order_type?.toUpperCase()}</Badge>
        },
        {
            key: 'status', label: 'Status',
            render: r => (
                <Badge variant={STATUS_BADGE[r.status] || 'gray'} size="xs">
                    {r.status?.replace(/_/g, ' ').toUpperCase()}
                </Badge>
            )
        },
        {
            key: 'actions', label: '',
            render: r => {
                const flow = STATUS_FLOW[r.status]
                return (
                    <div className="flex justify-end gap-1">
                        <button
                            onClick={() => handleView(r)}
                            className="text-[10px] text-gray-600 font-black hover:bg-gray-100 px-2 py-1 rounded transition-colors uppercase tracking-tighter">
                            View
                        </button>
                        {flow && (
                            flow.special === 'assign'
                                ? <button
                                    onClick={e => { e.stopPropagation(); setAssignOrder(r) }}
                                    className="text-[10px] text-blue-700 font-black hover:bg-blue-50 px-2 py-1 rounded transition-colors uppercase tracking-tighter">
                                    🚗 Assign
                                </button>
                                : <button
                                    onClick={e => { e.stopPropagation(); handleStatus(r.id, flow.next) }}
                                    className="text-[10px] text-green-700 font-black hover:bg-green-50 px-2 py-1 rounded transition-colors uppercase tracking-tighter">
                                    {flow.label}
                                </button>
                        )}
                    </div>
                )
            }
        },
    ]

    return (
        <div className="p-4 sm:p-6 space-y-4">
            <PageHeader
                title="Orders"
                subtitle="View and manage all orders for your mart"
                action={
                    <div className="flex items-center gap-4">
                        <MartSelector {...selectorProps} />
                        <Button variant="secondary" onClick={refresh}>↻ Refresh</Button>
                    </div>
                }
            />

            {martId && (
                <FilterBar
                    committedFilters={committedFilters}
                    onSearch={handleSearch}
                    onReset={handleReset}
                    loading={loading}
                />
            )}

            {!martId ? (
                <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-500 font-medium shadow-sm">
                    Please select a mart from the dropdown to view its orders.
                </div>
            ) : (
                <>
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                        <Table
                            columns={columns}
                            data={orders}
                            loading={loading}
                            emptyText="No orders found for the selected filters"
                        />
                    </div>
                    <PaginationBar pagination={pagination} onPageChange={handlePageChange} />
                </>
            )}

            {/* Order detail modal */}
            <OrderDetailModal
                selected={selected}
                onClose={() => setSelected(null)}
                onStatus={handleStatus}
                onAssign={(order) => setAssignOrder(order)}
            />

            {/* Assign driver modal */}
            <AssignDriverModal
                open={!!assignOrder}
                order={assignOrder}
                martId={martId}
                onClose={() => setAssignOrder(null)}
                onAssigned={refresh}
            />
        </div>
    )
}