// src/pages/Dashboard.jsx
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchOrders, selectAllOrders } from '../store/slices/orderSlice'
import StatCard from '../components/StatCard'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'
import useAuth from '../hooks/useAuth'
import api from '../api/index'

export default function Dashboard() {
    const dispatch = useDispatch()
    const orders = useSelector(selectAllOrders)
    const { martId, user, role } = useAuth()
    const [stock, setStock] = useState(null)

    useEffect(() => {
        if (!martId) return
        dispatch(fetchOrders({ martId }))
        api.get(`/products/stock/dashboard?martId=${martId}`).then(r => setStock(r.data))
    }, [martId, dispatch])

    const pending = orders.filter(o => o.status === 'pending').length
    const preparing = orders.filter(o => o.status === 'preparing').length
    const delivered = orders.filter(o => o.status === 'delivered').length
    const revenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + parseFloat(o.total || 0), 0)

    return (
        <div>
            <PageHeader
                title={`Welcome, ${user?.name || 'Staff'}`}
                subtitle={`${role?.replace(/_/g, ' ')} · Your mart dashboard`}
            />

            {/* Stats — shown based on role */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <StatCard label="Pending Orders" value={pending} icon="⏳" color="yellow" />
                <StatCard label="Preparing" value={preparing} icon="👨‍🍳" color="blue" />
                <StatCard label="Delivered Today" value={delivered} icon="✅" color="green" />
                <StatCard label="Low Stock Items" value={stock?.lowStockCount || 0} icon="⚠️" color="red" />
            </div>

            {role !== 'packing_staff' && role !== 'support' && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <StatCard label="Today Revenue" value={`₹${revenue.toFixed(0)}`} icon="💰" color="green" />
                    <StatCard label="Out of Stock" value={stock?.outOfStockCount || 0} icon="❌" color="red" />
                    <StatCard label="Total Orders" value={orders.length} icon="📦" color="gray" />
                </div>
            )}

            {/* Recent orders */}
            {orders.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">Recent Orders</h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {orders.slice(0, 8).map(o => (
                            <div key={o.id} className="px-5 py-3 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-mono text-gray-700">#{o.id?.slice(-8)}</p>
                                    <p className="text-xs text-gray-400">{o.payment_method?.toUpperCase()} · {o.order_type}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold">₹{o.total}</span>
                                    <Badge>{o.status}</Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {orders.length === 0 && (
                <div className="card py-12 text-center">
                    <div className="text-4xl mb-2">📦</div>
                    <p className="text-gray-400 text-sm">No orders yet today</p>
                </div>
            )}
        </div>
    )
}