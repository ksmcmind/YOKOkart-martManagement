// src/pages/Drivers.jsx
import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { showToast } from '../store/slices/uiSlice'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Table from '../components/Table'
import Badge from '../components/Badge'
import useAuth from '../hooks/useAuth'
import api from '../api/index'

export default function Drivers() {
    const dispatch = useDispatch()
    const { martId } = useAuth()

    const [drivers, setDrivers] = useState([])
    const [loading, setLoading] = useState(false)

    const load = () => {
        if (!martId) return
        setLoading(true)
        api.get(`/drivers?martId=${martId}`).then(r => { setDrivers(r.data || []); setLoading(false) })
    }

    useEffect(() => { load() }, [martId])

    // Auto refresh every 30 seconds for live status
    // useEffect(() => {
    //     const t = setInterval(load, 30000)
    //     return () => clearInterval(t)
    // }, [martId])

    const statusColor = { available: 'green', on_trip: 'yellow', offline: 'gray' }

    const columns = [
        {
            key: 'name', label: 'Driver', render: r => (
                <div className="flex items-center gap-2">
                    {r.profile_image ? (
                        <img src={r.profile_image} className="w-8 h-8 rounded-full object-cover" alt="" />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-xs font-bold">
                            {r.name?.charAt(0)?.toUpperCase()}
                        </div>
                    )}
                    <div>
                        <p className="font-medium text-gray-900">{r.name}</p>
                        <p className="text-xs text-gray-400">{r.phone}</p>
                    </div>
                </div>
            )
        },
        { key: 'vehicle', label: 'Vehicle', render: r => `${r.vehicleType} · ${r.vehicleNumber || '—'}` },
        { key: 'status', label: 'Status', render: r => <Badge variant={statusColor[r.status] || 'gray'}>{r.status || 'offline'}</Badge> },
        { key: 'total_deliveries', label: 'Deliveries', render: r => r.totalDeliveries || 0 },
        { key: 'total_earnings', label: 'Earnings', render: r => `₹${r.totalEarnings || 0}` },
        {
            key: 'documents', label: 'Docs', render: r => (
                <div className="flex gap-2">
                    {r.licenceImage && <a href={r.licenceImage} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline">Licence</a>}
                    {r.panImage && <a href={r.panImage} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline">PAN</a>}
                    {r.aadhaar_image && <a href={r.aadhaar_image} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline">Aadhaar</a>}
                </div>
            )
        },
    ]

    return (
        <div>
            <PageHeader
                title="Drivers"
                subtitle="Live driver status"
                action={<Button variant="secondary" onClick={load}>↻ Refresh</Button>}
            />
            <div className="flex gap-4 mb-4">
                <div className="card px-4 py-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-sm text-gray-600">Available: <strong>{drivers.filter(d => d.status === 'available').length}</strong></span>
                </div>
                <div className="card px-4 py-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                    <span className="text-sm text-gray-600">On Trip: <strong>{drivers.filter(d => d.status === 'on_trip').length}</strong></span>
                </div>
                <div className="card px-4 py-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                    <span className="text-sm text-gray-600">Offline: <strong>{drivers.filter(d => !d.status || d.status === 'offline').length}</strong></span>
                </div>
            </div>
            <div className="card">
                <Table columns={columns} data={drivers} loading={loading} emptyText="No drivers assigned to this mart" />
            </div>
        </div>
    )
}