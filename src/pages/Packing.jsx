// src/pages/Packing.jsx
// Packing staff sees orders to pack and marks them ready
import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchOrders, updateOrderStatus, selectAllOrders, selectOrderLoading } from '../store/slices/orderSlice'
import { showToast } from '../store/slices/uiSlice'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Badge from '../components/Badge'
import useAuth from '../hooks/useAuth'

export default function Packing() {
    const dispatch = useDispatch()
    const orders = useSelector(selectAllOrders)
    const loading = useSelector(selectOrderLoading)
    const { martId } = useAuth()

    const load = () => {
        if (martId) dispatch(fetchOrders({ martId, status: 'confirmed' }))
    }

    useEffect(() => { load() }, [martId])

    // Auto refresh every 15 seconds
    useEffect(() => {
        const t = setInterval(load, 15000)
        return () => clearInterval(t)
    }, [martId])

    const markPreparing = async (orderId) => {
        const res = await dispatch(updateOrderStatus({ orderId, status: 'preparing' }))
        if (!res.error) {
            dispatch(showToast({ message: 'Order marked as preparing', type: 'success' }))
            load()
        }
    }

    const markReady = async (orderId) => {
        const res = await dispatch(updateOrderStatus({ orderId, status: 'assigned' }))
        if (!res.error) {
            dispatch(showToast({ message: 'Order marked as ready for pickup', type: 'success' }))
            load()
        }
    }

    // Show confirmed (to start packing) and preparing (in progress)
    const toStart = orders.filter(o => o.status === 'confirmed')
    const inProgress = orders.filter(o => o.status === 'preparing')

    return (
        <div>
            <PageHeader
                title="Packing Queue"
                subtitle="Pack orders and mark ready for pickup"
                action={<Button variant="secondary" onClick={load}>↻ Refresh</Button>}
            />

            {loading ? (
                <div className="py-12 text-center text-gray-400">Loading...</div>
            ) : (
                <div className="grid grid-cols-2 gap-6">
                    {/* To Pack */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-lg">📬</span>
                            <h2 className="font-semibold text-gray-900">To Pack</h2>
                            <span className="ml-auto bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-medium">
                                {toStart.length}
                            </span>
                        </div>
                        <div className="space-y-3">
                            {toStart.length === 0 ? (
                                <div className="card py-8 text-center text-gray-400 text-sm">No orders to pack</div>
                            ) : toStart.map(order => (
                                <div key={order.id} className="card p-4 border-l-4 border-yellow-400">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-mono text-xs font-bold text-gray-700">#{order.id?.slice(-8)}</span>
                                        <span className="font-bold text-gray-900">₹{order.total}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mb-3">
                                        {order.payment_method?.toUpperCase()} · {order.items?.length || '?'} items
                                    </div>
                                    <Button variant="primary" size="sm" className="w-full" onClick={() => markPreparing(order.id)}>
                                        Start Packing
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* In Progress */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-lg">📦</span>
                            <h2 className="font-semibold text-gray-900">Packing In Progress</h2>
                            <span className="ml-auto bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium">
                                {inProgress.length}
                            </span>
                        </div>
                        <div className="space-y-3">
                            {inProgress.length === 0 ? (
                                <div className="card py-8 text-center text-gray-400 text-sm">Nothing in progress</div>
                            ) : inProgress.map(order => (
                                <div key={order.id} className="card p-4 border-l-4 border-purple-400">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-mono text-xs font-bold text-gray-700">#{order.id?.slice(-8)}</span>
                                        <span className="font-bold text-gray-900">₹{order.total}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mb-3">
                                        {order.items?.length || '?'} items · being packed
                                    </div>
                                    <Button variant="warning" size="sm" className="w-full" onClick={() => markReady(order.id)}>
                                        ✅ Mark Ready for Pickup
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}