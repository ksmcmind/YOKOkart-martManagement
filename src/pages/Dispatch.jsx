// src/pages/Dispatch.jsx
// Dispatcher sees live orders + assigns drivers
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchOrders, updateOrderStatus, assignDriver, selectAllOrders, selectOrderLoading } from '../store/slices/orderSlice'
import { showToast } from '../store/slices/uiSlice'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import { Select } from '../components/Input'
import useAuth from '../hooks/useAuth'
import api from '../api/index'

const STATUS_COLORS = {
    pending: 'bg-yellow-50 border-yellow-200',
    confirmed: 'bg-blue-50 border-blue-200',
    preparing: 'bg-purple-50 border-purple-200',
    assigned: 'bg-green-50 border-green-200',
}

const KANBAN_COLS = [
    { status: 'pending', label: 'New Orders', icon: '🆕' },
    { status: 'confirmed', label: 'Confirmed', icon: '✅' },
    { status: 'preparing', label: 'Preparing', icon: '👨‍🍳' },
    { status: 'assigned', label: 'Out for Delivery', icon: '🛵' },
]

export default function Dispatch() {
    const dispatch = useDispatch()
    const orders = useSelector(selectAllOrders)
    const loading = useSelector(selectOrderLoading)
    const { martId } = useAuth()

    const [drivers, setDrivers] = useState([])
    const [assignModal, setAssignModal] = useState(null)
    const [selectedDriver, setSelectedDriver] = useState('')
    const [assigning, setAssigning] = useState(false)

    const load = () => { if (martId) dispatch(fetchOrders({ martId })) }

    useEffect(() => {
        load()
        if (martId) {
            api.get(`/drivers?martId=${martId}`).then(r => {
                setDrivers((r.data || []).filter(d => d.status === 'available'))
            })
        }
    }, [martId])

    // Auto refresh every 20 seconds
    useEffect(() => {
        const t = setInterval(load, 20000)
        return () => clearInterval(t)
    }, [martId])

    const handleConfirm = async (orderId) => {
        await dispatch(updateOrderStatus({ orderId, status: 'confirmed' }))
        dispatch(showToast({ message: 'Order confirmed', type: 'success' }))
        load()
    }

    const handleAssignDriver = async () => {
        if (!selectedDriver) return dispatch(showToast({ message: 'Select a driver', type: 'error' }))
        setAssigning(true)
        const res = await dispatch(assignDriver({ orderId: assignModal.id, driverId: selectedDriver }))
        setAssigning(false)
        if (!res.error) {
            dispatch(showToast({ message: 'Driver assigned!', type: 'success' }))
            setAssignModal(null); setSelectedDriver('')
            load()
        } else {
            dispatch(showToast({ message: res.payload || 'Failed', type: 'error' }))
        }
    }

    return (
        <div>
            <PageHeader
                title="Dispatch"
                subtitle="Live order management and driver assignment"
                action={
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">
                            🟢 {drivers.length} drivers available
                        </span>
                        <Button variant="secondary" onClick={load}>↻ Refresh</Button>
                    </div>
                }
            />

            {loading ? (
                <div className="py-12 text-center text-gray-400">Loading orders...</div>
            ) : (
                // Kanban board
                <div className="grid grid-cols-4 gap-4">
                    {KANBAN_COLS.map(col => {
                        const colOrders = orders.filter(o => o.status === col.status)
                        return (
                            <div key={col.status}>
                                <div className="flex items-center gap-2 mb-3">
                                    <span>{col.icon}</span>
                                    <h3 className="text-sm font-semibold text-gray-700">{col.label}</h3>
                                    <span className="ml-auto bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full font-medium">
                                        {colOrders.length}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {colOrders.length === 0 ? (
                                        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-4 text-center text-xs text-gray-400">
                                            No orders
                                        </div>
                                    ) : colOrders.map(order => (
                                        <div
                                            key={order.id}
                                            className={`border rounded-xl p-3 space-y-2 ${STATUS_COLORS[order.status] || 'bg-white border-gray-200'}`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-mono text-xs font-semibold text-gray-700">#{order.id?.slice(-8)}</span>
                                                <span className="text-xs font-bold text-gray-900">₹{order.total}</span>
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {order.payment_method?.toUpperCase()} · {order.eta_minutes ? `${order.eta_minutes} min ETA` : '—'}
                                            </div>
                                            {order.delivery_address && (
                                                <div className="text-xs text-gray-600 truncate">
                                                    📍 {order.delivery_address.line1}
                                                </div>
                                            )}

                                            {/* Action buttons per status */}
                                            {order.status === 'pending' && (
                                                <Button variant="primary" size="sm" className="w-full" onClick={() => handleConfirm(order.id)}>
                                                    Confirm
                                                </Button>
                                            )}
                                            {order.status === 'preparing' && (
                                                <Button variant="warning" size="sm" className="w-full" onClick={() => { setAssignModal(order); setSelectedDriver('') }}>
                                                    Assign Driver
                                                </Button>
                                            )}
                                            {order.status === 'assigned' && order.driver_name && (
                                                <div className="text-xs text-green-700 font-medium">
                                                    🚴 {order.driver_name}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Assign Driver Modal */}
            <Modal
                title={`Assign Driver — #${assignModal?.id?.slice(-8)}`}
                open={!!assignModal}
                onClose={() => setAssignModal(null)}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setAssignModal(null)}>Cancel</Button>
                        <Button variant="primary" loading={assigning} onClick={handleAssignDriver}>Assign</Button>
                    </>
                }
            >
                <div className="space-y-3">
                    <div className="bg-gray-50 rounded-lg p-3 text-sm">
                        <p className="text-xs text-gray-400 mb-1">Order Total</p>
                        <p className="font-bold text-gray-900">₹{assignModal?.total}</p>
                        {assignModal?.delivery_address && (
                            <>
                                <p className="text-xs text-gray-400 mt-2 mb-1">Deliver to</p>
                                <p className="text-gray-700">{assignModal.delivery_address.line1}, {assignModal.delivery_address.city}</p>
                            </>
                        )}
                    </div>
                    <Select
                        label="Select Available Driver"
                        value={selectedDriver}
                        onChange={e => setSelectedDriver(e.target.value)}
                    >
                        <option value="">Choose driver...</option>
                        {drivers.map(d => (
                            <option key={d.id} value={d.id}>
                                {d.name} · {d.vehicle_type} {d.vehicle_number ? `(${d.vehicle_number})` : ''}
                            </option>
                        ))}
                    </Select>
                    {drivers.length === 0 && (
                        <p className="text-xs text-orange-600 bg-orange-50 rounded-lg p-3">
                            ⚠️ No drivers available right now. Ask a driver to go online.
                        </p>
                    )}
                </div>
            </Modal>
        </div>
    )
}