// src/pages/Products.jsx
// View-only product catalog — mart staff can browse products from the global catalog.
// Editing/creating products is done in the super-admin panel.
// Uses the same Grid + Badge components as Inventory.

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchProducts, selectAllProducts, selectProductLoading } from '../store/slices/productSlice'
import PageHeader from '../components/PageHeader'
import Grid from '../components/Grid'
import Badge from '../components/Badge'
import useAuth from '../hooks/useAuth'
import api from '../api/index'

export default function Products() {
    const dispatch = useDispatch()
    const products = useSelector(selectAllProducts)
    const loading = useSelector(selectProductLoading)
    const { martId } = useAuth()

    const [categories, setCategories] = useState([])
    const [catId, setCatId] = useState('')
    const [search, setSearch] = useState('')

    useEffect(() => {
        if (!martId) return
        api.get('/categories').then(r => setCategories(r.data || []))
    }, [martId])

    useEffect(() => {
        if (martId && catId) dispatch(fetchProducts({ martId, categoryId: catId }))
    }, [martId, catId, dispatch])

    // ── Grid columns (view-only — no edit/add) ──────────────────────────────
    const columns = [
        {
            key: 'name', label: 'Product', render: r => (
                <div className="flex items-center gap-3 py-1">
                    {r.images?.[0] || r.image ? (
                        <img src={r.images?.[0] || r.image} className="w-10 h-10 rounded-lg object-cover border border-gray-100" alt="" />
                    ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-lg">📦</div>
                    )}
                    <div>
                        <p className="font-bold text-gray-900 leading-tight">{r.name}</p>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{r.brand} · {r.displayUnit || r.display_unit || ''}</p>
                    </div>
                </div>
            ),
        },
        {
            key: 'price', label: 'Price', render: r => (
                <span className="text-[11px] font-bold text-gray-700">₹{r.price ?? r.sale_price ?? '—'}</span>
            ),
        },
        {
            key: 'stock', label: 'Stock', render: r => {
                const qty = r.stockQty ?? r.stock_qty ?? 0
                return (
                    <span className={`text-[11px] font-bold ${qty <= 10 ? 'text-red-600' : 'text-gray-900'}`}>
                        {qty}
                    </span>
                )
            },
        },
        {
            key: 'status', label: 'Status', render: r => (
                <Badge variant={(r.inStock ?? r.in_stock) ? 'green' : 'red'}>
                    {(r.inStock ?? r.in_stock) ? 'Active' : 'Inactive'}
                </Badge>
            ),
        },
        {
            key: 'barcode', label: 'Barcode / PLU', render: r => (
                <span className="text-[10px] font-mono text-gray-500">{r.barcode || r.pluCode || r.plu_code || '—'}</span>
            ),
        },
    ]

    // ── Expanded row — show variant details ─────────────────────────────────
    const renderExpanded = (r) => (
        <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
            {r.variants?.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">Variant ID</th>
                            <th className="px-4 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">Variant Name</th>
                            <th className="px-4 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">Size</th>
                            <th className="px-4 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">SKU</th>
                            <th className="px-4 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">Barcode</th>
                            <th className="px-4 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">PLU</th>
                            <th className="px-4 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {r.variants.map(v => (
                            <tr key={v.variantId || v.variant_id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-4 py-2 text-[9px] font-mono font-bold text-gray-600 bg-gray-50/50">{v.variantId || v.variant_id}</td>
                                <td className="px-4 py-2 text-[11px] font-bold text-gray-700">{v.variantName || v.variant_name}</td>
                                <td className="px-4 py-2 text-[10px] text-gray-500">{v.displaySize || v.display_size || '—'}</td>
                                <td className="px-4 py-2 text-[10px] font-mono text-gray-500">{v.sku || '—'}</td>
                                <td className="px-4 py-2 text-[10px] font-mono text-gray-500">{v.barcode || '—'}</td>
                                <td className="px-4 py-2 text-[10px] font-mono text-gray-500">{v.pluCode || v.plu_code || '—'}</td>
                                <td className="px-4 py-2">
                                    <Badge variant={(v.isActive ?? v.is_active) ? 'green' : 'red'} size="xs">
                                        {(v.isActive ?? v.is_active) ? 'Active' : 'Inactive'}
                                    </Badge>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <div className="p-4 text-center text-xs text-gray-400">No variant details available</div>
            )}
        </div>
    )

    // Filter products by search locally
    const filteredProducts = search
        ? products.filter(p =>
            p.name?.toLowerCase().includes(search.toLowerCase()) ||
            p.brand?.toLowerCase().includes(search.toLowerCase()) ||
            p.barcode?.toLowerCase().includes(search.toLowerCase())
        )
        : products

    return (
        <div className="p-4 sm:p-6 space-y-4">
            <PageHeader
                title="Products"
                subtitle="View product catalog (managed by super admin)"
            />

            {/* Category filter chips */}
            <div className="flex gap-2 flex-wrap">
                {categories.map(c => (
                    <button
                        key={c._id || c.id}
                        onClick={() => setCatId(c._id || c.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            catId === (c._id || c.id)
                                ? 'bg-primary-500 text-white shadow-sm'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        {c.icon || c.emoji || ''} {c.name}
                    </button>
                ))}
            </div>

            {!catId ? (
                <div className="card py-16 text-center">
                    <div className="text-4xl mb-3">🗂️</div>
                    <p className="text-gray-400 text-sm">Select a category to view products</p>
                </div>
            ) : (
                <Grid
                    columns={columns}
                    data={filteredProducts}
                    loading={loading}
                    emptyText="No products in this category"
                    externalSearchValue={search}
                    onSearchChange={setSearch}
                    searchPlaceholder="Search by name, brand, barcode..."
                    renderExpanded={renderExpanded}
                    pageSize={15}
                />
            )}
        </div>
    )
}