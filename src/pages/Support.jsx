// src/pages/Support.jsx
import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchOrders, selectAllOrders, selectOrderLoading } from '../store/slices/orderSlice'
import { showToast } from '../store/slices/uiSlice'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Table from '../components/Table'
import Badge from '../components/Badge'
import useAuth from '../hooks/useAuth'

export default function Support() {
    const dispatch = useDispatch()
    const orders = useSelector(selectAllOrders)
    const loading = useSelector(selectOrderLoading)
    const { martId } = useAuth()

    useEffect(() => {
        if (martId) dispatch(fetchOrders({ martId, status: 'cancelled' }))
    }, [martId, dispatch])

    const columns = [
        { key: 'id', label: 'Order ID', render: r => <span className="font-mono text-xs">#{r.id?.slice(-8)}</span> },
        { key: 'total', label: 'Total', render: r => `₹${r.total}` },
        { key: 'payment_method', label: 'Payment', render: r => r.payment_method?.toUpperCase() },
        { key: 'status', label: 'Status', render: r => <Badge>{r.status}</Badge> },
        { key: 'cancel_reason', label: 'Reason', render: r => r.cancel_reason || '—' },
        {
            key: 'actions', label: 'Actions', render: r => (
                <div className="flex gap-2">
                    {r.payment_method !== 'cod' && r.status === 'cancelled' && (
                        <Button variant="warning" size="sm" onClick={() =>
                            dispatch(showToast({ message: 'Contact super admin to process refund', type: 'info' }))
                        }>
                            Refund
                        </Button>
                    )}
                </div>
            )
        },
    ]

    return (
        <div>
            <PageHeader
                title="Support"
                subtitle="Handle customer complaints and cancellations"
                action={<Button variant="secondary" onClick={() => dispatch(fetchOrders({ martId, status: 'cancelled' }))}>↻ Refresh</Button>}
            />

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Cancelled Orders</h2>
                    <span className="text-xs text-gray-400">{orders.length} cancelled</span>
                </div>
                <Table columns={columns} data={orders} loading={loading} emptyText="No cancelled orders" />
            </div>

            <div className="card mt-4 p-5">
                <h2 className="card-title mb-3">Support Actions</h2>
                <div className="space-y-3 text-sm text-gray-600">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-2xl">💰</span>
                        <div>
                            <p className="font-medium text-gray-900">Process Refund</p>
                            <p className="text-xs text-gray-400">Contact super admin for online payment refunds</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-2xl">📞</span>
                        <div>
                            <p className="font-medium text-gray-900">Customer Contact</p>
                            <p className="text-xs text-gray-400">Call customer directly from order details</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-2xl">🔄</span>
                        <div>
                            <p className="font-medium text-gray-900">Re-order</p>
                            <p className="text-xs text-gray-400">Help customer place order again</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}