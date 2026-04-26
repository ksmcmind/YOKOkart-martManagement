// src/pages/Orders.jsx
import { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    fetchOrders,
    fetchOrderStats,
    updateOrderStatus,
    assignDriver,
    selectAllOrders,
    selectOrderLoading,
    selectOrderStats,
    selectOrdersByStatus,
} from '../store/slices/orderSlice'
import { showToast } from '../store/slices/uiSlice'
import useAuth from '../hooks/useAuth'

// ── Status config ─────────────────────────────────────────────
const STATUS_CONFIG = {
    pending: {
        color: '#F59E0B', bg: '#FEF3C7', icon: '🕐',
        next: (order) => order.order_type === 'pos' ? 'delivered' : 'packed',
        action: (order) => order.order_type === 'pos' ? 'Complete Sale' : 'Mark Packed',
    },
    packed: {
        color: '#06B6D4', bg: '#CFFAFE', icon: '📦',
        next: null,
        action: null,
        isDriverAssign: true, // ← show assign driver button
    },
    assigned: {
        color: '#8B5CF6', bg: '#EDE9FE', icon: '🚗',
        next: 'out_for_delivery',
        action: 'Out for Delivery',
    },
    out_for_delivery: {
        color: '#F97316', bg: '#FFEDD5', icon: '🛵',
        next: 'delivered',
        action: 'Mark Delivered',
    },
    delivered: { color: '#10B981', bg: '#D1FAE5', icon: '✅', next: null, action: null },
    cancelled: { color: '#EF4444', bg: '#FEE2E2', icon: '❌', next: null, action: null },
    refunded: { color: '#6B7280', bg: '#F3F4F6', icon: '↩️', next: null, action: null },
}

// Orders.jsx
const STATUS_TABS = [
    { key: '', label: 'All', icon: '📋' },
    { key: 'pending', label: 'Pending', icon: '🕐' },
    { key: 'packed', label: 'Packed', icon: '📦' },
    { key: 'assigned', label: 'Assigned', icon: '🚗' },
    { key: 'out_for_delivery', label: 'On the Way', icon: '🛵' },
    { key: 'delivered', label: 'Delivered', icon: '✅' },
    { key: 'cancelled', label: 'Cancelled', icon: '❌' },
]

// ── Helpers ───────────────────────────────────────────────────
const fmt = (n) => `₹${parseFloat(n || 0).toFixed(2)}`
const timeAgo = (dateStr) => {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return new Date(dateStr).toLocaleDateString()
}
const parseAddress = (raw) => {
    if (!raw) return {}
    if (typeof raw === 'object') return raw
    try { return JSON.parse(raw) } catch { return { line1: raw } } // ← plain string fallback
}
// ── Status Badge ─────────────────────────────────────────────
function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || { color: '#6B7280', bg: '#F3F4F6', icon: '?' }
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            color: cfg.color, background: cfg.bg, textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
            {cfg.icon} {status?.replace(/_/g, ' ')}
        </span>
    )
}

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({ label, value, color, icon }) {
    return (
        <div style={{
            background: '#fff', borderRadius: 16, padding: '20px 24px',
            border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            display: 'flex', alignItems: 'center', gap: 16,
        }}>
            <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: color + '15', display: 'grid', placeItems: 'center', fontSize: 22,
            }}>{icon}</div>
            <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4, fontWeight: 500 }}>{label}</div>
            </div>
        </div>
    )
}

// ── Order Card ────────────────────────────────────────────────
function OrderCard({ order, onView, onStatusUpdate, updating }) {
    const cfg = STATUS_CONFIG[order.status] || {}


    const addr = parseAddress(order.delivery_address)


    return (
        <div style={{
            background: '#fff', borderRadius: 16, border: '1px solid #F1F5F9',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden',
            transition: 'box-shadow 0.2s', cursor: 'pointer',
        }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'}
        >
            {/* Top bar */}
            <div style={{
                height: 4, background: cfg.color || '#E2E8F0',
            }} />

            <div style={{ padding: '16px 20px' }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 14, color: '#1E40AF' }}>
                                #{order.order_number || order.id?.slice(-8).toUpperCase()}
                            </span>
                            <StatusBadge status={order.status} />
                        </div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                            {timeAgo(order.created_at)} · {order.order_type?.toUpperCase()} · {order.payment_method?.toUpperCase()}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A' }}>{fmt(order.total)}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>incl. ₹{order.delivery_fee || 0} delivery</div>
                    </div>
                </div>

                {/* Address */}
                {addr.line1 && (
                    <div style={{
                        background: '#F8FAFC', borderRadius: 10, padding: '8px 12px',
                        fontSize: 12, color: '#475569', marginBottom: 12,
                        display: 'flex', alignItems: 'flex-start', gap: 6,
                    }}>
                        <span>📍</span>
                        <div>
                            <div style={{ fontWeight: 600, color: '#1E293B' }}>{addr.name}</div>
                            <div>{addr.line1}, {addr.city} {addr.pincode}</div>
                            {addr.phone && <div style={{ color: '#94A3B8' }}>{addr.phone}</div>}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                        onClick={() => onView(order)}
                        style={{
                            flex: 1, padding: '8px 0', borderRadius: 10, border: '1px solid #E2E8F0',
                            background: '#F8FAFC', color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                        }}
                    >
                        View Details
                    </button>
                    {cfg.next && (
                        <button
                            onClick={() => onStatusUpdate(order.id, cfg.next)}
                            disabled={updating === order.id}
                            style={{
                                flex: 2, padding: '8px 0', borderRadius: 10, border: 'none',
                                background: cfg.color, color: '#fff', fontWeight: 700, fontSize: 13,
                                cursor: updating === order.id ? 'not-allowed' : 'pointer',
                                opacity: updating === order.id ? 0.7 : 1,
                            }}
                        >
                            {updating === order.id ? '...' : `${cfg.action} →`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

// ── Order Detail Modal ────────────────────────────────────────
function OrderModal({ order, onClose, onStatusUpdate, updating }) {
    if (!order) return null
    const cfg = STATUS_CONFIG[order.status] || {}
    const addr = parseAddress(order.delivery_address)

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 20,
        }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{
                background: '#fff', borderRadius: 20, width: '100%', maxWidth: 560,
                maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}>
                {/* Modal header */}
                <div style={{
                    padding: '20px 24px', borderBottom: '1px solid #F1F5F9',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    position: 'sticky', top: 0, background: '#fff', zIndex: 1,
                }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 18, color: '#0F172A' }}>
                            #{order.order_number || order.id?.slice(-8).toUpperCase()}
                        </div>
                        <StatusBadge status={order.status} />
                    </div>
                    <button onClick={onClose} style={{
                        width: 36, height: 36, borderRadius: 10, border: 'none',
                        background: '#F1F5F9', cursor: 'pointer', fontSize: 18,
                    }}>×</button>
                </div>

                <div style={{ padding: 24 }}>
                    {/* Order summary */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20,
                    }}>
                        {[
                            ['💰 Total', fmt(order.total)],
                            ['🧾 Subtotal', fmt(order.subtotal)],
                            ['🚚 Delivery', fmt(order.delivery_fee)],
                            ['💳 Payment', order.payment_method?.toUpperCase()],
                            ['📦 Type', order.order_type?.toUpperCase()],
                            ['⏱ ETA', order.eta_minutes ? `${order.eta_minutes} min` : '—'],
                        ].map(([label, value]) => (
                            <div key={label} style={{
                                background: '#F8FAFC', borderRadius: 12, padding: '12px 16px',
                            }}>
                                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>{label}</div>
                                <div style={{ fontWeight: 700, color: '#0F172A' }}>{value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Delivery address */}
                    {addr.line1 && (
                        <div style={{
                            background: '#F0FDF4', border: '1px solid #BBF7D0',
                            borderRadius: 12, padding: 16, marginBottom: 20,
                        }}>
                            <div style={{ fontWeight: 700, color: '#166534', marginBottom: 8, fontSize: 13 }}>📍 Delivery Address</div>
                            <div style={{ fontWeight: 600, color: '#15803D' }}>{addr.name}</div>
                            <div style={{ color: '#166534', fontSize: 13 }}>{addr.line1}, {addr.city} - {addr.pincode}</div>
                            {addr.phone && <div style={{ color: '#4ADE80', fontSize: 12, marginTop: 4 }}>{addr.phone}</div>}
                            {order.delivery_notes && (
                                <div style={{ marginTop: 8, color: '#166534', fontSize: 12, fontStyle: 'italic' }}>
                                    Note: {order.delivery_notes}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Order items */}
                    {order.items?.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: 12, fontSize: 14 }}>
                                🛍 Items ({order.items.length})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {order.items.map((item, i) => (
                                    <div key={i} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        background: '#F8FAFC', borderRadius: 10, padding: '10px 14px',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: 8, background: '#E2E8F0',
                                                display: 'grid', placeItems: 'center', fontSize: 16,
                                            }}>
                                                {item.product_image
                                                    ? <img src={item.product_image} alt="" style={{ width: '100%', borderRadius: 8, objectFit: 'cover' }} />
                                                    : '📦'}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 13, color: '#1E293B' }}>{item.product_name}</div>
                                                <div style={{ fontSize: 11, color: '#94A3B8' }}>{item.brand} · {item.unit} · ×{parseFloat(item.quantity)}</div>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 700, color: '#0F172A' }}>{fmt(item.total_price)}</div>
                                            <div style={{ fontSize: 11, color: '#94A3B8' }}>{fmt(item.unit_price)} each</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Status timeline */}
                    <div style={{
                        background: '#F8FAFC', borderRadius: 12, padding: 16, marginBottom: 20,
                    }}>
                        <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: 12, fontSize: 13 }}>📅 Timeline</div>
                        {[
                            ['Created', order.created_at],
                            ['Confirmed', order.confirmed_at],
                            ['Delivered', order.delivered_at],
                            ['Cancelled', order.cancelled_at],
                        ].filter(([, v]) => v).map(([label, value]) => (
                            <div key={label} style={{
                                display: 'flex', justifyContent: 'space-between',
                                fontSize: 12, color: '#475569', padding: '4px 0',
                                borderBottom: '1px solid #E2E8F0',
                            }}>
                                <span style={{ fontWeight: 600 }}>{label}</span>
                                <span>{new Date(value).toLocaleString()}</span>
                            </div>
                        ))}
                        {order.cancelled_reason && (
                            <div style={{ marginTop: 8, fontSize: 12, color: '#EF4444' }}>
                                Reason: {order.cancelled_reason}
                            </div>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={onClose} style={{
                            flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid #E2E8F0',
                            background: '#F8FAFC', color: '#475569', fontWeight: 600, cursor: 'pointer',
                        }}>
                            Close
                        </button>
                        {cfg.next && (
                            <button
                                onClick={() => { onStatusUpdate(order.id, cfg.next); onClose() }}
                                disabled={updating === order.id}
                                style={{
                                    flex: 2, padding: '12px 0', borderRadius: 12, border: 'none',
                                    background: cfg.color, color: '#fff', fontWeight: 700, fontSize: 14,
                                    cursor: 'pointer',
                                }}
                            >
                                {cfg.action} →
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Main Orders Page ──────────────────────────────────────────
export default function Orders() {
    const dispatch = useDispatch()
    const orders = useSelector(selectAllOrders)
    const loading = useSelector(selectOrderLoading)
    const stats = useSelector(selectOrderStats)
    const { martId } = useAuth()

    const [activeTab, setActiveTab] = useState('')
    const [selected, setSelected] = useState(null)
    const [updating, setUpdating] = useState(null)
    const [lastFetched, setLastFetched] = useState(null)

    // Filter orders from Redux — no API call on tab switch
    const filteredOrders = useSelector(state => selectOrdersByStatus(state, activeTab))

    const load = useCallback(() => {
        if (!martId) return
        dispatch(fetchOrders({ martId, status: '' })) // always fetch ALL, filter client-side
        dispatch(fetchOrderStats({ martId }))
        setLastFetched(new Date())
    }, [martId, dispatch])

    // Initial load
    useEffect(() => { load() }, [load])

    // Auto refresh every 30 seconds
    useEffect(() => {
        const t = setInterval(load, 30000)
        return () => clearInterval(t)
    }, [load])

    const handleStatusUpdate = async (orderId, newStatus) => {
        setUpdating(orderId)
        const res = await dispatch(updateOrderStatus({ orderId, status: newStatus }))
        setUpdating(null)
        if (!res.error) {
            dispatch(showToast({ message: `Order marked as ${newStatus.replace(/_/g, ' ')}`, type: 'success' }))
            setSelected(null)
        } else {
            dispatch(showToast({ message: res.payload || 'Failed to update', type: 'error' }))
        }
    }

    return (
        <div style={{ padding: '24px 28px', background: '#F8FAFC', minHeight: '100vh' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 900, color: '#0F172A', margin: 0 }}>Orders</h1>
                    <p style={{ color: '#94A3B8', margin: '4px 0 0', fontSize: 13 }}>
                        {lastFetched ? `Last updated ${timeAgo(lastFetched)}` : 'Loading...'}
                    </p>
                </div>
                <button
                    onClick={load}
                    style={{
                        padding: '10px 20px', borderRadius: 12, border: '1px solid #E2E8F0',
                        background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                    }}
                >
                    ↻ Refresh
                </button>
            </div>

            {/* Stats */}
            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
                    <StatCard label="Total Orders" value={stats.total_orders || 0} color="#3B82F6" icon="📋" />
                    <StatCard label="Pending" value={stats.pending_orders || 0} color="#F59E0B" icon="🕐" />
                    <StatCard label="Delivered" value={stats.delivered_orders || 0} color="#10B981" icon="✅" />
                    <StatCard label="Revenue Today" value={fmt(stats.total_revenue)} color="#8B5CF6" icon="💰" />
                </div>
            )}

            {/* Status tabs */}
            <div style={{
                display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4,
            }}>
                {STATUS_TABS.map(tab => {
                    const count = tab.key
                        ? orders.filter(o => o.status === tab.key).length
                        : orders.length
                    const active = activeTab === tab.key

                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)} // No API call — filters Redux store
                            style={{
                                padding: '8px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
                                background: active ? '#1E40AF' : '#fff',
                                color: active ? '#fff' : '#475569',
                                fontWeight: active ? 700 : 500,
                                fontSize: 13, whiteSpace: 'nowrap',
                                boxShadow: active ? '0 2px 8px rgba(30,64,175,0.3)' : '0 1px 4px rgba(0,0,0,0.06)',
                                display: 'flex', alignItems: 'center', gap: 6,
                                transition: 'all 0.15s',
                            }}
                        >
                            {tab.icon} {tab.label}
                            {count > 0 && (
                                <span style={{
                                    background: active ? 'rgba(255,255,255,0.25)' : '#F1F5F9',
                                    color: active ? '#fff' : '#64748B',
                                    borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                                }}>
                                    {count}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Orders grid */}
            {loading && orders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
                    <div style={{ fontWeight: 600 }}>Loading orders...</div>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#475569' }}>No orders found</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                        {activeTab ? `No ${activeTab.replace(/_/g, ' ')} orders` : 'No orders yet today'}
                    </div>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                    gap: 16,
                }}>
                    {filteredOrders.map(order => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            onView={setSelected}
                            onStatusUpdate={handleStatusUpdate}
                            updating={updating}
                        />
                    ))}
                </div>
            )}

            {/* Order detail modal */}
            <OrderModal
                order={selected}
                onClose={() => setSelected(null)}
                onStatusUpdate={handleStatusUpdate}
                updating={updating}
            />
        </div>
    )
}