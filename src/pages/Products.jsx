// src/pages/Products.jsx
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchProducts, updateProductStock, selectAllProducts, selectProductLoading } from '../store/slices/productSlice'
import { showToast } from '../store/slices/uiSlice'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Table from '../components/Table'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Input, { Select } from '../components/Input'
import useAuth from '../hooks/useAuth'
import api from '../api/index'

export default function Products() {
    const dispatch = useDispatch()
    const products = useSelector(selectAllProducts)
    const loading = useSelector(selectProductLoading)
    const { martId } = useAuth()

    const [categories, setCategories] = useState([])
    const [catId, setCatId] = useState('')
    const [stockModal, setStockModal] = useState(null)
    const [stockForm, setStockForm] = useState({ action: 'add', quantity: '', note: '' })
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!martId) return
        api.get('/categories').then(r => setCategories(r.data || []))
    }, [martId])

    useEffect(() => {
        if (martId && catId) dispatch(fetchProducts({ martId, categoryId: catId }))
    }, [martId, catId, dispatch])

    const handleUpdateStock = async () => {
        if (!stockForm.quantity) return dispatch(showToast({ message: 'Enter quantity', type: 'error' }))
        setSaving(true)
        const res = await dispatch(updateProductStock({
            productId: stockModal.id || stockModal._id,
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
            if (catId) dispatch(fetchProducts({ martId, categoryId: catId }))
        } else {
            dispatch(showToast({ message: res.payload || 'Failed', type: 'error' }))
        }
    }

    const columns = [
        {
            key: 'name', label: 'Product', render: r => (
                <div className="flex items-center gap-2">
                    {r.images?.[0] || r.image ? (
                        <img src={r.images?.[0] || r.image} className="w-8 h-8 rounded object-cover" alt="" />
                    ) : (
                        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs">📦</div>
                    )}
                    <div>
                        <p className="font-medium text-gray-900">{r.name}</p>
                        <p className="text-xs text-gray-400">{r.brand} · {r.displayUnit}</p>
                    </div>
                </div>
            )
        },
        { key: 'price', label: 'Price', render: r => `₹${r.price}` },
        {
            key: 'stockQty', label: 'Stock', render: r => (
                <span className={`font-medium ${(r.stockQty ?? r.stock_qty) <= 10 ? 'text-red-600' : 'text-gray-900'}`}>
                    {r.stockQty ?? r.stock_qty ?? 0}
                </span>
            )
        },
        { key: 'inStock', label: 'Status', render: r => <Badge>{(r.inStock ?? r.in_stock) ? 'active' : 'inactive'}</Badge> },
        { key: 'barcode', label: 'Barcode/PLU', render: r => <span className="text-xs font-mono">{r.barcode || r.pluCode || '—'}</span> },
        {
            key: 'actions', label: 'Stock', render: r => (
                <Button variant="primary" size="sm" onClick={() => setStockModal(r)}>Update Stock</Button>
            )
        },
    ]

    return (
        <div>
            <PageHeader title="Products" subtitle="View and update product stock" />

            {/* Category filter */}
            <div className="flex gap-2 mb-4 flex-wrap">
                {categories.map(c => (
                    <button
                        key={c._id || c.id}
                        onClick={() => setCatId(c._id || c.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${catId === (c._id || c.id) ? 'bg-primary-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                        {c.icon} {c.name}
                    </button>
                ))}
            </div>

            <div className="card">
                {!catId ? (
                    <div className="py-12 text-center">
                        <div className="text-4xl mb-2">🗂️</div>
                        <p className="text-gray-400 text-sm">Select a category to view products</p>
                    </div>
                ) : (
                    <Table columns={columns} data={products} loading={loading} emptyText="No products" />
                )}
            </div>

            <Modal
                title="Update Stock"
                open={!!stockModal}
                onClose={() => setStockModal(null)}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setStockModal(null)}>Cancel</Button>
                        <Button variant="primary" loading={saving} onClick={handleUpdateStock}>Update</Button>
                    </>
                }
            >
                <div className="space-y-3">
                    <div className="bg-gray-50 rounded-lg p-3 text-sm">
                        <p className="font-medium text-gray-900">{stockModal?.name}</p>
                        <p className="text-xs text-gray-400 mt-1">
                            Current stock: <strong>{stockModal?.stockQty ?? stockModal?.stock_qty ?? 0}</strong>
                        </p>
                    </div>
                    <Select label="Action" value={stockForm.action} onChange={e => setStockForm(f => ({ ...f, action: e.target.value }))}>
                        <option value="add">Add stock (received from supplier)</option>
                        <option value="set">Set exact amount (physical count)</option>
                    </Select>
                    <Input label="Quantity" type="number" value={stockForm.quantity} onChange={e => setStockForm(f => ({ ...f, quantity: e.target.value }))} placeholder="Enter quantity" />
                    <Input label="Note (optional)" value={stockForm.note} onChange={e => setStockForm(f => ({ ...f, note: e.target.value }))} placeholder="Stock received from supplier" />
                </div>
            </Modal>
        </div>
    )
}