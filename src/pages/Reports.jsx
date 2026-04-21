// src/pages/Reports.jsx
import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { fetchOrders, selectAllOrders } from '../store/slices/orderSlice'
import { useDispatch } from 'react-redux'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import Button from '../components/Button'
import useAuth from '../hooks/useAuth'

export default function Reports() {
    const dispatch = useDispatch()
    const orders = useSelector(selectAllOrders)
    const { martId } = useAuth()
    const [period, setPeriod] = useState('today')

    useEffect(() => {
        if (martId) dispatch(fetchOrders({ martId }))
    }, [martId, dispatch])

    const delivered = orders.filter(o => o.status === 'delivered')
    const cancelled = orders.filter(o => o.status === 'cancelled')
    const revenue = delivered.reduce((s, o) => s + parseFloat(o.total || 0), 0)
    const avgOrder = delivered.length ? revenue / delivered.length : 0

    const byPayment = {
        cod: delivered.filter(o => o.payment_method === 'cod').length,
        online: delivered.filter(o => o.payment_method !== 'cod').length,
    }

    return (
        <div>
            <PageHeader title="Reports" subtitle="Sales and performance analytics" />

            <div className="grid grid-cols-4 gap-4 mb-6">
                <StatCard label="Total Orders" value={orders.length} icon="📦" color="blue" />
                <StatCard label="Delivered" value={delivered.length} icon="✅" color="green" />
                <StatCard label="Cancelled" value={cancelled.length} icon="❌" color="red" />
                <StatCard label="Total Revenue" value={`₹${revenue.toFixed(0)}`} icon="💰" color="green" />
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
                <StatCard label="Avg Order Value" value={`₹${avgOrder.toFixed(0)}`} icon="📊" color="yellow" />
                <StatCard label="COD Orders" value={byPayment.cod} icon="💵" color="gray" />
                <StatCard label="Online Payments" value={byPayment.online} icon="💳" color="blue" />
            </div>

            {/* Order list */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">All Orders</h2>
                    <span className="text-xs text-gray-400">{orders.length} total</span>
                </div>
                <div className="table-wrapper">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>Total</th>
                                <th>Payment</th>
                                <th>Type</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.slice(0, 50).map(o => (
                                <tr key={o.id}>
                                    <td className="font-mono text-xs">#{o.id?.slice(-8)}</td>
                                    <td className="font-semibold">₹{o.total}</td>
                                    <td>{o.payment_method?.toUpperCase()}</td>
                                    <td>{o.order_type}</td>
                                    <td>
                                        <span className={`badge ${o.status === 'delivered' ? 'badge-green' : o.status === 'cancelled' ? 'badge-red' : 'badge-yellow'}`}>
                                            {o.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}