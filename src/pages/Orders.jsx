// src/pages/Orders.jsx
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchOrders, updateOrderStatus, selectAllOrders, selectOrderLoading } from '../store/slices/orderSlice'
import { showToast } from '../store/slices/uiSlice'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Table from '../components/Table'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import useAuth from '../hooks/useAuth'

const STATUS_FLOW = {
    pending: { next: 'confirmed', label: 'Confirm Order', color: 'primary' },
    confirmed: { next: 'preparing', label: 'Start Preparing', color: 'primary' },
    preparing: { next: 'assigned', label: 'Mark Ready', color: 'warning' },
}

const STATUSES = ['', 'pending', 'confirmed', 'preparing', 'assigned', 'picked_up', 'delivered', 'cancelled']

export default function Orders() {
    const dispatch = useDispatch()
    const orders = useSelector(selectAllOrders)
    const loading = useSelector(selectOrderLoading)
    const { martId } = useAuth()

    const [status, setStatus] = useState('')
    const [selected, setSelected] = useState(null)

    const load = () => { if (martId) dispatch(fetchOrders({ martId, status })) }

    useEffect(() => { load() }, [martId, status])

    // Auto refresh every 30 seconds
    useEffect(() => {
        const t = setInterval(load, 30000)
        return () => clearInterval(t)
    }, [martId, status])

    const handleStatus = async (orderId, newStatus) => {
        const res = await dispatch(updateOrderStatus({ orderId, status: newStatus }))
        if (!res.error) {
            dispatch(showToast({ message: `Order ${newStatus}`, type: 'success' }))
            setSelected(null)
            load()
        } else {
            dispatch(showToast({ message: res.payload || 'Failed', type: 'error' }))
        }
    }

    const columns = [
        { key: 'id', label: 'Order ID', render: r => <span className="font-mono text-xs">#{r.id?.slice(-8)}</span> },
        { key: 'total', label: 'Total', render: r => <span className="font-semibold">₹{r.total}</span> },
        { key: 'payment_method', label: 'Payment', render: r => r.payment_method?.toUpperCase() },
        { key: 'order_type', label: 'Type' },
        { key: 'eta_minutes', label: 'ETA', render: r => r.eta_minutes ? `${r.eta_minutes} min` : '—' },
        { key: 'status', label: 'Status', render: r => <Badge>{r.status}</Badge> },
        {
            key: 'actions', label: 'Actions', render: r => (
                <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setSelected(r)}>View</Button>
                    {STATUS_FLOW[r.status] && (
                        <Button variant={STATUS_FLOW[r.status].color} size="sm" onClick={() => handleStatus(r.id, STATUS_FLOW[r.status].next)}>
                            {STATUS_FLOW[r.status].label}
                        </Button>
                    )}
                </div>
            )
        },
    ]

    return (
        <div>
            <PageHeader
                title="Orders"
                subtitle="Manage incoming orders"
                action={<Button variant="secondary" onClick={load}>↻ Refresh</Button>}
            />

            {/* Status filters */}
            <div className="flex gap-1.5 flex-wrap mb-4">
                {STATUSES.map(s => (
                    <button
                        key={s}
                        onClick={() => setStatus(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${status === s ? 'bg-primary-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                        {s || 'All'}
                    </button>
                ))}
            </div>

            <div className="card">
                <Table columns={columns} data={orders} loading={loading} emptyText="No orders found" />
            </div>

            {/* Order detail modal */}
            {selected && (
                <Modal
                    title={`Order #${selected.id?.slice(-8)}`}
                    open={!!selected}
                    onClose={() => setSelected(null)}
                    footer={
                        <>
                            <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
                            {STATUS_FLOW[selected.status] && (
                                <Button variant="primary" onClick={() => handleStatus(selected.id, STATUS_FLOW[selected.status].next)}>
                                    {STATUS_FLOW[selected.status].label}
                                </Button>
                            )}
                        </>
                    }
                >
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        {[
                            ['Status', <Badge key="s">{selected.status}</Badge>],
                            ['Total', `₹${selected.total}`],
                            ['Subtotal', `₹${selected.subtotal}`],
                            ['Del. Fee', `₹${selected.delivery_fee || 0}`],
                            ['Payment', selected.payment_method?.toUpperCase()],
                            ['Type', selected.order_type],
                            ['ETA', selected.eta_minutes ? `${selected.eta_minutes} min` : '—'],
                            ['Distance', selected.delivery_distance_km ? `${selected.delivery_distance_km} km` : '—'],
                        ].map(([label, value]) => (
                            <div key={label} className="bg-gray-50 rounded-lg p-3">
                                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                                <div className="font-medium text-gray-900">{value}</div>
                            </div>
                        ))}
                    </div>
                    {selected.delivery_address && (
                        <div className="bg-gray-50 rounded-lg p-3 mt-3">
                            <p className="text-xs text-gray-400 mb-1">Delivery Address</p>
                            <p className="font-medium text-gray-900">{selected.delivery_address.name}</p>
                            <p className="text-xs text-gray-600">{selected.delivery_address.line1}, {selected.delivery_address.city} {selected.delivery_address.pincode}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{selected.delivery_address.phone}</p>
                        </div>
                    )}
                </Modal>
            )}
        </div>
    )
}