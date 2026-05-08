// src/pages/Orders.jsx
//
// Mart-side order management.
// Status flow handled here:
//   pending → confirmed → preparing → packed → assigned → picked_up → out_for_delivery → delivered
//                                       ↑
//                              Driver dropdown appears here
//   any state (before delivered) → cancelled (stock auto-returned by backend)

import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    fetchOrders,
    fetchOrderStats,
    fetchOrderDetail,
    confirmOrder,
    updateOrderStatus,
    cancelOrder,
    assignDriver,
    packOrderItem,
    selectAllOrders,
    selectOrderLoading,
    selectOrderStats,
    selectOrderDetail,
    selectOrderDetailLoading,
    clearOrderDetail,
} from '../store/slices/orderSlice'
import {
    fetchAvailableDrivers,
    selectAvailableDrivers,
    selectAvailableDriversLoading,
} from '../store/slices/driverSlice'
import { showToast } from '../store/slices/uiSlice'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Grid from '../components/Grid'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Input from '../components/Input'
import useAuth from '../hooks/useAuth'

// ── Status flow ──────────────────────────────────────────────────────────────
// What is the next "advance" action available from each status?
// When status === 'packed' we don't show "next" here — we show the driver dropdown.
const NEXT_ACTION = {
    pending: { next: 'confirmed', label: 'Confirm', color: 'primary' },
    confirmed: { next: 'preparing', label: 'Start Preparing', color: 'primary' },
    preparing: { next: 'packed', label: 'Mark Ready', color: 'warning' },
    // packed → custom (driver dropdown)
    assigned: { next: 'picked_up', label: 'Picked Up', color: 'primary' },
    picked_up: { next: 'out_for_delivery', label: 'Out for Delivery', color: 'primary' },
    out_for_delivery: { next: 'delivered', label: 'Delivered', color: 'primary' },
}

const STATUS_TABS = [
    '', 'pending', 'confirmed', 'preparing', 'packed',
    'assigned', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled',
]

const STATUS_BADGE_COLOR = {
    pending: 'yellow',
    confirmed: 'blue',
    preparing: 'blue',
    packed: 'purple',
    assigned: 'purple',
    picked_up: 'purple',
    out_for_delivery: 'purple',
    delivered: 'green',
    cancelled: 'red',
    refunded: 'gray',
}

const fmtDateTime = (iso) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-IN', {
        day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: true,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Driver Assignment Inline Picker
// Shows a dropdown + Assign button. Used in the grid row when status='packed'
// and inside the detail modal.
// ─────────────────────────────────────────────────────────────────────────────
function DriverPicker({ orderId, martId, onAssigned }) {
    const dispatch = useDispatch()
    const drivers = useSelector(selectAvailableDrivers)
    const loading = useSelector(selectAvailableDriversLoading)
    const [driverId, setDriverId] = useState('')
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!drivers.length && !loading) {
            dispatch(fetchAvailableDrivers({ martId }))
        }
    }, [martId, drivers.length, loading, dispatch])

    const handleAssign = async (e) => {
        e?.stopPropagation()
        if (!driverId) {
            dispatch(showToast({ message: 'Pick a driver first', type: 'error' }))
            return
        }
        setBusy(true)
        const action = await dispatch(assignDriver({ orderId, driverId }))
        setBusy(false)
        if (assignDriver.fulfilled.match(action)) {
            dispatch(showToast({ message: 'Driver assigned', type: 'success' }))
            setDriverId('')
            onAssigned?.()
        } else {
            dispatch(showToast({
                message: action.payload || 'Assign failed',
                type: 'error',
            }))
        }
    }

    return (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            <select
                value={driverId}
                onChange={e => setDriverId(e.target.value)}
                disabled={loading || busy}
                className="text-xs border border-gray-200 rounded px-2 py-1 bg-white outline-none focus:border-primary-400 max-w-[140px]"
            >
                <option value="">{loading ? 'Loading…' : 'Pick driver'}</option>
                {drivers.map(d => (
                    <option key={d.id} value={d.id}>
                        {d.name}{d.vehicle_number ? ` · ${d.vehicle_number}` : ''}
                    </option>
                ))}
            </select>
            <Button
                variant="primary"
                size="sm"
                loading={busy}
                disabled={!driverId || busy}
                onClick={handleAssign}
            >
                Assign
            </Button>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancel modal — reason required
// ─────────────────────────────────────────────────────────────────────────────
function CancelModal({ open, onClose, orderId }) {
    const dispatch = useDispatch()
    const [reason, setReason] = useState('')
    const [busy, setBusy] = useState(false)

    useEffect(() => { if (open) setReason('') }, [open])

    const submit = async () => {
        if (!reason.trim()) {
            dispatch(showToast({ message: 'Reason is required', type: 'error' }))
            return
        }
        setBusy(true)
        const action = await dispatch(cancelOrder({ orderId, reason }))
        setBusy(false)
        if (cancelOrder.fulfilled.match(action)) {
            dispatch(showToast({ message: 'Order cancelled', type: 'success' }))
            onClose()
        } else {
            dispatch(showToast({ message: action.payload || 'Cancel failed', type: 'error' }))
        }
    }

    return (
        <Modal
            title="Cancel Order"
            open={open}
            onClose={onClose}
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Keep Order</Button>
                    <Button variant="danger" loading={busy} onClick={submit}>Cancel Order</Button>
                </>
            }
        >
            <div className="space-y-3">
                <p className="text-sm text-gray-600">
                    This will cancel the order and automatically return the stock to inventory.
                    A return transaction will be logged for each item.
                </p>
                <Input
                    label="Reason *"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Customer requested cancellation"
                />
            </div>
        </Modal>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Detail Modal — shows items, allows packing, status advance, cancel
// ─────────────────────────────────────────────────────────────────────────────
function OrderDetailModal({ open, onClose, orderId, martId }) {
    const dispatch = useDispatch()
    const order = useSelector(selectOrderDetail)
    const loading = useSelector(selectOrderDetailLoading)
    const [cancelOpen, setCancelOpen] = useState(false)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (open && orderId) dispatch(fetchOrderDetail(orderId))
        return () => { if (!open) dispatch(clearOrderDetail()) }
    }, [open, orderId, dispatch])

    if (!open) return null

    const advance = async (status) => {
        setBusy(true)
        const action = status === 'confirmed'
            ? await dispatch(confirmOrder({ orderId }))
            : await dispatch(updateOrderStatus({ orderId, status }))
        setBusy(false)
        if (!action.error) onClose()
    }

    const handlePack = async (itemId) => {
        await dispatch(packOrderItem({ orderId, itemId }))
    }

    const status = order?.status
    const next = NEXT_ACTION[status]
    const showDriverPicker = status === 'packed'
    const canCancel = order && !['delivered', 'cancelled', 'refunded'].includes(status)

    return (
        <>
            <Modal
                title={`Order #${order?.order_number || orderId?.slice(-8)}`}
                open={open}
                onClose={onClose}
                size="xl"
                footer={
                    <div className="flex items-center justify-between w-full">
                        <Button variant="secondary" onClick={onClose}>Close</Button>
                        <div className="flex items-center gap-2">
                            {canCancel && (
                                <Button variant="danger" onClick={() => setCancelOpen(true)}>
                                    Cancel Order
                                </Button>
                            )}
                            {showDriverPicker && (
                                <DriverPicker
                                    orderId={orderId}
                                    martId={martId}
                                    onAssigned={onClose}
                                />
                            )}
                            {next && (
                                <Button
                                    variant={next.color}
                                    loading={busy}
                                    onClick={() => advance(next.next)}
                                >
                                    {next.label}
                                </Button>
                            )}
                        </div>
                    </div>
                }
            >
                {loading || !order ? (
                    <p className="text-sm text-gray-500 py-8 text-center">Loading…</p>
                ) : (
                    <div className="space-y-5">
                        {/* Header strip */}
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <Badge variant={STATUS_BADGE_COLOR[status] || 'gray'}>
                                {status?.toUpperCase()}
                            </Badge>
                            <div className="text-xs text-gray-500">
                                Placed {fmtDateTime(order.created_at)}
                                {order.confirmed_at && ` · Confirmed ${fmtDateTime(order.confirmed_at)}`}
                                {order.delivered_at && ` · Delivered ${fmtDateTime(order.delivered_at)}`}
                            </div>
                        </div>

                        {/* Money + meta grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            {[
                                ['Total', `₹${order.total}`],
                                ['Subtotal', `₹${order.subtotal}`],
                                ['Delivery Fee', `₹${order.delivery_fee || 0}`],
                                ['Tax', `₹${order.tax || 0}`],
                                ['Discount', `₹${order.discount || 0}`],
                                ['Payment', order.payment_method?.toUpperCase()],
                                ['Pay Status', order.payment_status],
                                ['Type', order.order_type],
                            ].map(([label, value]) => (
                                <div key={label} className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{label}</p>
                                    <p className="font-bold text-gray-900 text-sm mt-0.5">{value || '—'}</p>
                                </div>
                            ))}
                        </div>

                        {/* Delivery address */}
                        {order.delivery_address && (
                            <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">
                                    Delivery Address
                                </p>
                                <p className="font-medium text-gray-900 text-sm">{order.delivery_address.name}</p>
                                <p className="text-xs text-gray-600">
                                    {order.delivery_address.line1}
                                    {order.delivery_address.line2 && `, ${order.delivery_address.line2}`}
                                </p>
                                <p className="text-xs text-gray-600">
                                    {order.delivery_address.city} {order.delivery_address.pincode}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">📞 {order.delivery_address.phone}</p>
                            </div>
                        )}

                        {/* Driver info if assigned */}
                        {order.driver_name && (
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                                <p className="text-[10px] uppercase tracking-widest text-blue-600 font-bold mb-1">
                                    Assigned Driver
                                </p>
                                <p className="font-bold text-gray-900 text-sm">{order.driver_name}</p>
                                <p className="text-xs text-gray-600">📞 {order.driver_phone}</p>
                            </div>
                        )}

                        {/* Items table */}
                        {Array.isArray(order.items) && order.items.length > 0 && (
                            <div>
                                <h4 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">
                                    Items ({order.items.length})
                                </h4>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-gray-200">
                                                <th className="text-left pb-2 pr-3 font-bold text-gray-500 uppercase tracking-widest text-[10px]">Product</th>
                                                <th className="text-right pb-2 pr-3 font-bold text-gray-500 uppercase tracking-widest text-[10px]">Qty</th>
                                                <th className="text-right pb-2 pr-3 font-bold text-gray-500 uppercase tracking-widest text-[10px]">Price</th>
                                                <th className="text-right pb-2 pr-3 font-bold text-gray-500 uppercase tracking-widest text-[10px]">Total</th>
                                                <th className="text-center pb-2 font-bold text-gray-500 uppercase tracking-widest text-[10px]">Pack</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {order.items.map(it => (
                                                <tr key={it.id}>
                                                    <td className="py-2 pr-3">
                                                        <p className="font-medium text-gray-900">{it.product_name}</p>
                                                        {it.brand && <p className="text-[10px] text-gray-500">{it.brand} · {it.unit}</p>}
                                                    </td>
                                                    <td className="py-2 pr-3 text-right tabular-nums">{it.quantity}</td>
                                                    <td className="py-2 pr-3 text-right tabular-nums">₹{it.unit_price}</td>
                                                    <td className="py-2 pr-3 text-right tabular-nums font-bold">₹{it.total_price}</td>
                                                    <td className="py-2 text-center">
                                                        {it.is_packed ? (
                                                            <Badge variant="green" size="xs">PACKED</Badge>
                                                        ) : (status === 'preparing' || status === 'confirmed') ? (
                                                            <button
                                                                onClick={() => handlePack(it.id)}
                                                                className="text-[10px] text-primary-600 font-bold hover:bg-primary-50 px-2 py-1 rounded"
                                                            >
                                                                MARK PACKED
                                                            </button>
                                                        ) : (
                                                            <span className="text-gray-300 text-[10px]">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Cancellation info */}
                        {order.cancelled_at && (
                            <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                                <p className="text-[10px] uppercase tracking-widest text-red-600 font-bold mb-1">
                                    Cancelled
                                </p>
                                <p className="text-xs text-gray-700">
                                    {fmtDateTime(order.cancelled_at)} by {order.cancelled_by}
                                </p>
                                {order.cancelled_reason && (
                                    <p className="text-xs text-gray-600 mt-1">"{order.cancelled_reason}"</p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            <CancelModal
                open={cancelOpen}
                onClose={() => setCancelOpen(false)}
                orderId={orderId}
            />
        </>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function Orders() {
    const dispatch = useDispatch()
    const orders = useSelector(selectAllOrders)
    const loading = useSelector(selectOrderLoading)
    const stats = useSelector(selectOrderStats)
    const { martId } = useAuth()

    const [statusFilter, setStatusFilter] = useState('')
    const [search, setSearch] = useState('')
    const [selectedId, setSelectedId] = useState(null)
    const [busyOrderId, setBusyOrderId] = useState(null)

    const load = () => {
        if (martId) {
            dispatch(fetchOrders({ martId, status: statusFilter }))
            dispatch(fetchOrderStats({ martId, range: '1 day' }))
        }
    }

    useEffect(() => { load() }, [martId, statusFilter])

    // Auto-refresh every 30s
    // useEffect(() => {
    //     const t = setInterval(load, 30000)
    //     return () => clearInterval(t)
    // }, [martId, statusFilter])

    // Client-side search filter (over already-fetched list)
    const filtered = useMemo(() => {
        if (!search.trim()) return orders
        const q = search.toLowerCase()
        return orders.filter(o =>
            o.id?.toLowerCase().includes(q) ||
            o.order_number?.toLowerCase().includes(q) ||
            o.customer_name?.toLowerCase().includes(q) ||
            o.customer_phone?.toLowerCase().includes(q) ||
            o.driver_name?.toLowerCase().includes(q)
        )
    }, [orders, search])

    // Counts per status for tab badges
    const counts = useMemo(() => {
        const c = {}
        for (const o of orders) c[o.status] = (c[o.status] || 0) + 1
        c[''] = orders.length
        return c
    }, [orders])

    // ── Inline action handlers ──────────────────────────────────────────────
    const handleAdvance = async (e, order) => {
        e.stopPropagation()
        const next = NEXT_ACTION[order.status]
        if (!next) return

        setBusyOrderId(order.id)
        if (next.next === 'confirmed') {
            await dispatch(confirmOrder({ orderId: order.id }))
        } else {
            await dispatch(updateOrderStatus({ orderId: order.id, status: next.next }))
        }
        setBusyOrderId(null)
    }

    // ── Grid columns ────────────────────────────────────────────────────────
    const columns = [
        {
            key: 'id',
            label: 'Order',
            render: r => (
                <div className="py-1">
                    <p className="font-mono text-[11px] font-bold text-gray-900">
                        #{r.order_number || r.id?.slice(-8)}
                    </p>
                    <p className="text-[10px] text-gray-400">{fmtDateTime(r.created_at)}</p>
                </div>
            ),
        },
        {
            key: 'customer',
            label: 'Customer',
            render: r => (
                <div className="py-1">
                    <p className="text-xs font-medium text-gray-900">{r.customer_name || '—'}</p>
                    <p className="text-[10px] text-gray-500">{r.customer_phone || '—'}</p>
                </div>
            ),
        },
        {
            key: 'total',
            label: 'Total',
            render: r => (
                <div className="text-xs">
                    <p className="font-bold text-gray-900 tabular-nums">₹{r.total}</p>
                    <p className="text-[10px] text-gray-400 uppercase">{r.payment_method}</p>
                </div>
            ),
        },
        {
            key: 'type',
            label: 'Type',
            render: r => (
                <Badge variant={r.order_type === 'pos' ? 'blue' : 'gray'} size="xs">
                    {r.order_type?.toUpperCase()}
                </Badge>
            ),
        },
        {
            key: 'driver',
            label: 'Driver',
            render: r => r.driver_name
                ? (
                    <div className="text-[10px]">
                        <p className="font-medium text-gray-700">{r.driver_name}</p>
                        <p className="text-gray-400">{r.driver_phone}</p>
                    </div>
                )
                : <span className="text-gray-300 text-[10px]">—</span>,
        },
        {
            key: 'eta',
            label: 'ETA',
            render: r => r.eta_minutes
                ? <span className="text-xs text-gray-700">{r.eta_minutes}m</span>
                : <span className="text-gray-300 text-[10px]">—</span>,
        },
        {
            key: 'status',
            label: 'Status',
            render: r => (
                <Badge variant={STATUS_BADGE_COLOR[r.status] || 'gray'} size="xs">
                    {r.status?.replace(/_/g, ' ')?.toUpperCase()}
                </Badge>
            ),
        },
        {
            key: 'actions',
            label: '',
            render: r => {
                const next = NEXT_ACTION[r.status]
                const showDriverPicker = r.status === 'packed'
                const isBusy = busyOrderId === r.id

                return (
                    <div className="flex items-center justify-end gap-1.5 pr-2" onClick={e => e.stopPropagation()}>
                        {showDriverPicker ? (
                            <DriverPicker
                                orderId={r.id}
                                martId={martId}
                                onAssigned={load}
                            />
                        ) : next ? (
                            <Button
                                variant={next.color}
                                size="sm"
                                loading={isBusy}
                                onClick={(e) => handleAdvance(e, r)}
                            >
                                {next.label}
                            </Button>
                        ) : null}
                        <button
                            onClick={(e) => { e.stopPropagation(); setSelectedId(r.id) }}
                            className="text-[10px] text-gray-600 font-black hover:bg-gray-100 px-2 py-1 rounded transition-colors uppercase tracking-tighter"
                        >
                            View
                        </button>
                    </div>
                )
            },
        },
    ]

    return (
        <div className="p-4 sm:p-6 space-y-4">
            <PageHeader
                title="Orders"
                subtitle="Manage incoming orders and assign drivers"
                action={<Button variant="secondary" onClick={load}>↻ Refresh</Button>}
            />

            {/* Stats cards */}
            {stats && (
                <div className="flex gap-3 flex-wrap">
                    {[
                        { label: 'Total Today', value: stats.total_orders || 0, color: 'text-gray-700' },
                        { label: 'Pending', value: stats.pending_orders || 0, color: 'text-yellow-600' },
                        { label: 'Delivered', value: stats.delivered_orders || 0, color: 'text-green-600' },
                        { label: 'Cancelled', value: stats.cancelled_orders || 0, color: 'text-red-600' },
                        { label: 'Revenue', value: `₹${Number(stats.total_revenue || 0).toFixed(0)}`, color: 'text-primary-600' },
                        { label: 'Avg Order', value: `₹${Number(stats.avg_order_value || 0).toFixed(0)}`, color: 'text-gray-700' },
                    ].map(s => (
                        <div key={s.label} className="bg-white border border-gray-100 rounded-lg px-4 py-2 shadow-sm">
                            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                            <p className="text-xs text-gray-400">{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Status tabs */}
            <div className="flex gap-1.5 flex-wrap">
                {STATUS_TABS.map(s => {
                    const count = counts[s] || 0
                    const isActive = statusFilter === s
                    return (
                        <button
                            key={s || 'all'}
                            onClick={() => setStatusFilter(s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${isActive
                                ? 'bg-primary-500 text-white'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            {(s || 'all').replace(/_/g, ' ')}
                            {count > 0 && (
                                <span className={`text-[10px] font-bold px-1.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-gray-100'
                                    }`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            <Grid
                columns={columns}
                data={filtered}
                loading={loading}
                emptyText="No orders match this filter."
                onSearchChange={setSearch}
                searchPlaceholder="Search by order #, customer, phone, driver..."
                pageSize={15}
            />

            {selectedId && (
                <OrderDetailModal
                    open={!!selectedId}
                    onClose={() => setSelectedId(null)}
                    orderId={selectedId}
                    martId={martId}
                />
            )}
        </div>
    )
}