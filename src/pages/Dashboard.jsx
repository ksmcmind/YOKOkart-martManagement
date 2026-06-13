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
    const { martId, user, role, can } = useAuth()
    
    // Mart staff state
    const [stock, setStock] = useState(null)
    const [incomingTransfers, setIncomingTransfers] = useState([])
    const [loadingTransfers, setLoadingTransfers] = useState(false)

    // Analytics state
    const [dateRange, setDateRange] = useState({
        from: getPastDateString(30),
        to: new Date().toISOString().split('T')[0]
    })
    const [salesSummary, setSalesSummary] = useState(null)
    const [categoriesShare, setCategoriesShare] = useState([])
    const [paymentSplits, setPaymentSplits] = useState([])
    const [salesTrends, setSalesTrends] = useState([])
    const [loadingAnalytics, setLoadingAnalytics] = useState(false)

    // Helper: get past date string (YYYY-MM-DD)
    function getPastDateString(daysAgo) {
        const d = new Date()
        d.setDate(d.getDate() - daysAgo)
        return d.toISOString().split('T')[0]
    }

    // Effect for active orders (fallback list)
    useEffect(() => {
        if (!martId) return
        dispatch(fetchOrders({ martId }))
        api.get(`/products/stock/dashboard?martId=${martId}`).then(r => setStock(r.data))
    }, [martId, dispatch])

    // Effect for Mart Analytics and Incoming dispatches
    useEffect(() => {
        if (!martId || !can.viewReports) return

        const fetchMartAnalytics = async () => {
            setLoadingAnalytics(true)
            try {
                const queryStr = `fromDate=${dateRange.from}&toDate=${dateRange.to}&martId=${martId}`
                
                const [summaryRes, categoriesRes, splitsRes, trendsRes] = await Promise.all([
                    api.get(`/reports/global/summary?${queryStr}`),
                    api.get(`/reports/global/categories-share?${queryStr}`),
                    api.get(`/reports/global/payment-splits?${queryStr}`),
                    api.get(`/reports/global/trends?${queryStr}&groupBy=day`)
                ])

                if (summaryRes.success) setSalesSummary(summaryRes.data.summary)
                if (categoriesRes.success) setCategoriesShare(categoriesRes.data.categories_share)
                if (splitsRes.success) setPaymentSplits(splitsRes.data.payment_splits)
                if (trendsRes.success) setSalesTrends(trendsRes.data.trends)
            } catch (err) {
                console.error('Failed to load mart analytics:', err)
            } finally {
                setLoadingAnalytics(false)
            }
        }

        const fetchIncomingTransfers = async () => {
            setLoadingTransfers(true)
            try {
                // Fetch dispatches sent to this mart
                const res = await api.get(`/warehouse-transfers/mart/${martId}`)
                if (res.success) {
                    setIncomingTransfers(res.data || [])
                }
            } catch (err) {
                console.error('Failed to load incoming transfers:', err)
            } finally {
                setLoadingTransfers(false)
            }
        }

        fetchMartAnalytics()
        fetchIncomingTransfers()
    }, [martId, dateRange, can.viewReports])

    const handlePresetChange = (days) => {
        setDateRange({
            from: getPastDateString(days),
            to: new Date().toISOString().split('T')[0]
        })
    }

    // --- RENDER MART ANALYTICS VIEW FOR MANAGERS/ADMINS ---
    if (can.viewReports) {
        const topCategoryValue = categoriesShare.length > 0 ? categoriesShare[0].total_revenue : 1
        const maxTrendRevenue = salesTrends.length > 0 ? Math.max(...salesTrends.map(t => t.total_revenue)) : 1

        // Payment values
        const cashPayment = paymentSplits.find(p => p.payment_method === 'cash')?.total_revenue || 0
        const onlinePayment = paymentSplits.find(p => p.payment_method === 'online')?.total_revenue || 0
        const totalPayment = cashPayment + onlinePayment || 1

        // Circumference values for circular progress / donut
        const radius = 45
        const stroke = 8
        const normalizedRadius = radius - stroke * 2
        const circumference = normalizedRadius * 2 * Math.PI
        const onlinePercent = Math.round((onlinePayment / totalPayment) * 100)
        const strokeDashoffset = circumference - (onlinePercent / 100) * circumference

        return (
            <div className="space-y-6">
                {/* Header with Date Range pickers */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all duration-300">
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-gray-900">Mart Performance Analytics</h1>
                        <p className="text-xs text-gray-500 mt-1">Sales trends, category contribution, and operational metrics for your store.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex bg-gray-100 p-1 rounded-xl">
                            <button onClick={() => handlePresetChange(7)} className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 rounded-lg focus:outline-none focus:bg-white focus:shadow-sm transition-all">7D</button>
                            <button onClick={() => handlePresetChange(30)} className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 rounded-lg focus:outline-none focus:bg-white focus:shadow-sm transition-all">30D</button>
                            <button onClick={() => handlePresetChange(90)} className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 rounded-lg focus:outline-none focus:bg-white focus:shadow-sm transition-all">90D</button>
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="date" 
                                className="input py-1.5 text-xs font-semibold focus:ring-primary-500" 
                                value={dateRange.from} 
                                onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                            />
                            <span className="text-gray-400 text-xs font-bold">to</span>
                            <input 
                                type="date" 
                                className="input py-1.5 text-xs font-semibold focus:ring-primary-500" 
                                value={dateRange.to} 
                                onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                            />
                        </div>
                    </div>
                </div>

                {loadingAnalytics && (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm animate-pulse">
                        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-xs text-gray-400 font-bold mt-4">Compiling store sales queries...</p>
                    </div>
                )}

                {!loadingAnalytics && (
                    <div className="space-y-6">
                        {/* Sales Stats Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard label="Store Revenue" value={`₹${(salesSummary?.total_revenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`} icon="💰" color="green" />
                            <StatCard label="Total Orders" value={salesSummary?.total_orders || 0} icon="📦" color="blue" />
                            <StatCard label="Avg Order Value" value={`₹${(salesSummary?.avg_order_value || 0).toFixed(2)}`} icon="📊" color="yellow" />
                            <StatCard label="Unique Customers" value={salesSummary?.unique_customers || 0} icon="👤" color="indigo" />
                        </div>

                        {/* Chart Trend & Payment Splits */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Trend Line Chart */}
                            <div className="lg:col-span-2 card p-6 flex flex-col justify-between min-h-[340px]">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="card-title">Sales Revenue Timeline</h3>
                                    <span className="text-[10px] bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Daily Trend</span>
                                </div>

                                {salesTrends.length > 0 ? (
                                    <div className="relative flex-1 flex flex-col justify-between">
                                        <svg className="w-full h-44 overflow-visible" viewBox="0 0 500 200" preserveAspectRatio="none">
                                            <line x1="0" y1="20" x2="500" y2="20" stroke="#f3f4f6" strokeWidth="1" />
                                            <line x1="0" y1="90" x2="500" y2="90" stroke="#f3f4f6" strokeWidth="1" />
                                            <line x1="0" y1="160" x2="500" y2="160" stroke="#f3f4f6" strokeWidth="1" />
                                            
                                            <defs>
                                                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2"/>
                                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0"/>
                                                </linearGradient>
                                            </defs>
                                            
                                            <path
                                                d={`
                                                    M 0,180
                                                    ${salesTrends.map((t, idx) => {
                                                        const x = (idx / (salesTrends.length - 1)) * 500
                                                        const y = 180 - (t.total_revenue / maxTrendRevenue) * 140
                                                        return `L ${x},${y}`
                                                    }).join(' ')}
                                                    L 500,180 Z
                                                `}
                                                fill="url(#chartGrad)"
                                            />

                                            <path
                                                d={salesTrends.map((t, idx) => {
                                                    const x = (idx / (salesTrends.length - 1)) * 500
                                                    const y = 180 - (t.total_revenue / maxTrendRevenue) * 140
                                                    return `${idx === 0 ? 'M' : 'L'} ${x},${y}`
                                                }).join(' ')}
                                                fill="none"
                                                stroke="#3b82f6"
                                                strokeWidth="3.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />

                                            {salesTrends.map((t, idx) => {
                                                const x = (idx / (salesTrends.length - 1)) * 500
                                                const y = 180 - (t.total_revenue / maxTrendRevenue) * 140
                                                return (
                                                    <circle
                                                        key={idx}
                                                        cx={x}
                                                        cy={y}
                                                        r="4"
                                                        fill="#ffffff"
                                                        stroke="#3b82f6"
                                                        strokeWidth="2.5"
                                                        className="cursor-pointer hover:r-6 hover:fill-blue-500 transition-all"
                                                        title={`Date: ${t.trend_date.split('T')[0]}\nRevenue: ₹${t.total_revenue}`}
                                                    />
                                                )
                                            })}
                                        </svg>
                                        
                                        <div className="flex justify-between text-[10px] text-gray-400 font-bold px-1 mt-2">
                                            <span>{salesTrends[0]?.trend_date.split('T')[0]}</span>
                                            <span>{salesTrends[Math.floor(salesTrends.length / 2)]?.trend_date.split('T')[0]}</span>
                                            <span>{salesTrends[salesTrends.length - 1]?.trend_date.split('T')[0]}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center text-xs text-gray-400 italic">No sales trend data available for this range.</div>
                                )}
                            </div>

                            {/* Payment Splits */}
                            <div className="card p-6 flex flex-col justify-between min-h-[340px]">
                                <h3 className="card-title mb-4">Payment Method Split</h3>
                                
                                {totalPayment > 1 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                                        <div className="relative w-28 h-28 flex items-center justify-center">
                                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                                <circle cx="50" cy="50" r={normalizedRadius} stroke="#f3f4f6" strokeWidth={stroke} fill="transparent" />
                                                <circle
                                                    cx="50"
                                                    cy="50"
                                                    r={normalizedRadius}
                                                    stroke="#6366f1"
                                                    strokeWidth={stroke}
                                                    fill="transparent"
                                                    strokeDasharray={circumference}
                                                    strokeDashoffset={strokeDashoffset}
                                                    strokeLinecap="round"
                                                />
                                            </svg>
                                            <div className="absolute text-center">
                                                <p className="text-xl font-extrabold text-gray-900 leading-none">{onlinePercent}%</p>
                                                <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-widest">Online</p>
                                            </div>
                                        </div>

                                        <div className="w-full grid grid-cols-2 gap-4 text-xs">
                                            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-2.5 text-center">
                                                <span className="inline-block w-2.5 h-2.5 bg-indigo-500 rounded-full mr-1"></span>
                                                <span className="font-bold text-indigo-800">Online</span>
                                                <p className="font-semibold text-gray-900 mt-1">₹{onlinePayment.toLocaleString('en-IN')}</p>
                                            </div>
                                            <div className="bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-center">
                                                <span className="inline-block w-2.5 h-2.5 bg-gray-400 rounded-full mr-1"></span>
                                                <span className="font-bold text-gray-600">Cash/COD</span>
                                                <p className="font-semibold text-gray-900 mt-1">₹{cashPayment.toLocaleString('en-IN')}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center text-xs text-gray-400 italic">No payments detected in date range.</div>
                                )}
                            </div>
                        </div>

                        {/* Category sharing & Incoming transfers */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Category Share progress bars */}
                            <div className="card p-6 flex flex-col justify-between lg:col-span-1">
                                <h3 className="card-title mb-4">🗂️ Category Sales Contribution</h3>
                                
                                {categoriesShare.length > 0 ? (
                                    <div className="space-y-4 flex-1">
                                        {categoriesShare.slice(0, 6).map(c => {
                                            const pct = (c.total_revenue / topCategoryValue) * 100
                                            return (
                                                <div key={c.category_id} className="space-y-1">
                                                    <div className="flex justify-between text-xs font-semibold text-gray-700">
                                                        <span>{c.category_name}</span>
                                                        <span className="font-bold text-gray-900">₹{c.total_revenue.toLocaleString('en-IN')}</span>
                                                    </div>
                                                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                                        <div 
                                                            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500" 
                                                            style={{ width: `${pct}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center text-xs text-gray-400 italic">No category sales data.</div>
                                )}
                            </div>

                            {/* Incoming transfers from Warehouses */}
                            <div className="card lg:col-span-2">
                                <div className="card-header">
                                    <h3 className="card-title">🚚 Incoming Stock Shipments</h3>
                                    <span className="text-xs text-gray-400">{incomingTransfers.length} transfers pending/received</span>
                                </div>
                                <div className="table-wrapper max-h-[280px] overflow-y-auto">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Code</th>
                                                <th>Product Name</th>
                                                <th>Qty</th>
                                                <th>Status</th>
                                                <th>Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {incomingTransfers.slice(0, 10).map(t => (
                                                <tr key={t.transfer_id}>
                                                    <td className="font-mono text-xs text-gray-600">#{t.transfer_code || t.transfer_id?.slice(-6)}</td>
                                                    <td className="font-semibold text-gray-700 truncate max-w-[150px]" title={t.productName}>{t.productName}</td>
                                                    <td>{t.qty_dispatched} pcs</td>
                                                    <td>
                                                        <Badge variant={t.status === 'received' ? 'green' : t.status === 'dispatched' ? 'blue' : t.status === 'cancelled' ? 'red' : 'yellow'}>
                                                            {t.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="text-xs text-gray-400">{t.dispatched_at ? new Date(t.dispatched_at).toLocaleDateString() : '—'}</td>
                                                </tr>
                                            ))}
                                            {incomingTransfers.length === 0 && (
                                                <tr>
                                                    <td colSpan="5" className="text-center py-6 text-gray-400 italic">No incoming stock dispatches.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // --- FALLBACK RENDER: OPERATIONAL STAFF VIEW (CASHIER/PACKER/ETC) ---
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

            {/* Stats */}
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

            {/* Recent orders list */}
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