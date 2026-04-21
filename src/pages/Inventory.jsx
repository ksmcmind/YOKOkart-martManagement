// src/pages/Inventory.jsx
import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { updateProductStock } from '../store/slices/productSlice'
import { showToast } from '../store/slices/uiSlice'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import StatCard from '../components/StatCard'
import Modal from '../components/Modal'
import Input, { Select } from '../components/Input'
import useAuth from '../hooks/useAuth'
import api from '../api/index'

export default function Inventory() {
    const dispatch = useDispatch()
    const { martId } = useAuth()

    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [stockModal, setStockModal] = useState(null)
    const [stockForm, setStockForm] = useState({ action: 'add', quantity: '', note: '' })
    const [saving, setSaving] = useState(false)

    const load = () => {
        if (!martId) return
        setLoading(true)
        api.get(`/products/stock/dashboard?martId=${martId}`)
            .then(r => { setData(r.data || null); setLoading(false) })
    }

    useEffect(() => { load() }, [martId])

    const handleUpdateStock = async () => {
        if (!stockForm.quantity) return dispatch(showToast({ message: 'Enter quantity', type: 'error' }))
        setSaving(true)
        const res = await dispatch(updateProductStock({
            productId: stockModal.mongo_product_id,
            data: {
                action: stockForm.action,
                quantity: parseFloat(stockForm.quantity),
                martId,
                note: stockForm.note || `Manual ${stockForm.action}`,
            }
        }))
        setSaving(false)
        if (!res.error) {
            dispatch(showToast({ message: 'Stock updated!', type: 'success' }))
            setStockModal(null)
            setStockForm({ action: 'add', quantity: '', note: '' })
            load()
        } else {
            dispatch(showToast({ message: res.payload || 'Failed', type: 'error' }))
        }
    }

    return (
        <div>
            <PageHeader
                title="Inventory"
                subtitle="Monitor and update stock levels"
                action={<Button variant="secondary" onClick={load}>↻ Refresh</Button>}
            />

            {loading ? (
                <div className="py-12 text-center text-gray-400">Loading...</div>
            ) : data && (
                <>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <StatCard label="Out of Stock" value={data.outOfStockCount || 0} icon="❌" color="red" />
                        <StatCard label="Low Stock" value={data.lowStockCount || 0} icon="⚠️" color="yellow" />
                    </div>

                    {/* Low stock table */}
                    {data.lowStockItems?.length > 0 && (
                        <div className="card mb-4">
                            <div className="card-header">
                                <h2 className="card-title text-accent-600">⚠️ Low Stock ({data.lowStockItems.length})</h2>
                            </div>
                            <div className="table-wrapper">
                                <table className="table">
                                    <thead><tr><th>Product ID</th><th>Stock</th><th>Unit</th><th>Alert At</th><th>Action</th></tr></thead>
                                    <tbody>
                                        {data.lowStockItems.map(item => (
                                            <tr key={item.mongo_product_id}>
                                                <td className="font-mono text-xs">{item.mongo_product_id.slice(-14)}</td>
                                                <td className="font-semibold text-accent-600">{item.stock_qty}</td>
                                                <td>{item.unit}</td>
                                                <td className="text-gray-400">{item.low_stock_alert}</td>
                                                <td><Button variant="primary" size="sm" onClick={() => setStockModal(item)}>Update</Button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Out of stock table */}
                    {data.outOfStockItems?.length > 0 && (
                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title text-red-600">❌ Out of Stock ({data.outOfStockItems.length})</h2>
                            </div>
                            <div className="table-wrapper">
                                <table className="table">
                                    <thead><tr><th>Product ID</th><th>Unit</th><th>Action</th></tr></thead>
                                    <tbody>
                                        {data.outOfStockItems.map(item => (
                                            <tr key={item.mongo_product_id}>
                                                <td className="font-mono text-xs">{item.mongo_product_id.slice(-14)}</td>
                                                <td>{item.unit}</td>
                                                <td><Button variant="primary" size="sm" onClick={() => setStockModal(item)}>Add Stock</Button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {!data.lowStockItems?.length && !data.outOfStockItems?.length && (
                        <div className="card py-12 text-center">
                            <div className="text-4xl mb-2">✅</div>
                            <p className="text-gray-600 font-medium">All products well stocked!</p>
                        </div>
                    )}
                </>
            )}

            <Modal title="Update Stock" open={!!stockModal} onClose={() => setStockModal(null)}
                footer={<><Button variant="secondary" onClick={() => setStockModal(null)}>Cancel</Button><Button variant="primary" loading={saving} onClick={handleUpdateStock}>Update</Button></>}
            >
                <div className="space-y-3">
                    <div className="bg-gray-50 rounded-lg p-3 text-sm">
                        <p className="text-xs text-gray-400 mb-1">Product</p>
                        <p className="font-mono text-gray-700">{stockModal?.mongo_product_id?.slice(-16)}</p>
                        <p className="text-xs text-gray-400 mt-1">Current: <strong>{stockModal?.stock_qty} {stockModal?.unit}</strong></p>
                    </div>
                    <Select label="Action" value={stockForm.action} onChange={e => setStockForm(f => ({ ...f, action: e.target.value }))}>
                        <option value="add">Add stock</option>
                        <option value="set">Set exact amount</option>
                    </Select>
                    <Input label="Quantity" type="number" value={stockForm.quantity} onChange={e => setStockForm(f => ({ ...f, quantity: e.target.value }))} placeholder="Enter quantity" />
                    <Input label="Note (optional)" value={stockForm.note} onChange={e => setStockForm(f => ({ ...f, note: e.target.value }))} />
                </div>
            </Modal>
        </div>
    )
}