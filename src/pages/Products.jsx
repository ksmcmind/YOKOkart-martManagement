import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchProducts, selectAllProducts, selectProductLoading } from '../store/slices/productSlice'
import PageHeader from '../components/PageHeader'
import Grid from '../components/Grid'
import Badge from '../components/Badge'
import useAuth from '../hooks/useAuth'
import api from '../api/index'

// --- FIX 1: Create a simple Select component or import your UI library's select ---
const Select = ({ children, ...props }) => (
    <select {...props} className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-primary-500 outline-none">
        {children}
    </select>
)

export default function Products() {
    const dispatch = useDispatch()
    const products = useSelector(selectAllProducts)
    const loading = useSelector(selectProductLoading)
    const { martId } = useAuth()

    const [categories, setCategories] = useState([])
    const [catId, setCatId] = useState('')
    const [search, setSearch] = useState('')

    // --- FIX 2: Define the missing state variables used in the bottom filters ---
    const [categorySlug, setCategorySlug] = useState('')
    const [subcategorySlug, setSubcategorySlug] = useState('')

    useEffect(() => {
        if (!martId) return
        api.get('/categories').then(r => setCategories(r.data || []))
    }, [martId])

    useEffect(() => {
        if (martId && catId) dispatch(fetchProducts({ martId, categoryId: catId }))
    }, [martId, catId, dispatch])

    // --- FIX 3: Define handleEdit (even if it just logs for now) ---
    const handleEdit = (product) => {
        console.log("Edit clicked for:", product)
    }

    const columns = [
        {
            key: 'name', label: 'Product', render: r => (
                <div className="py-1">
                    <p className="font-bold text-gray-900 leading-tight">{r.name}</p>
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{r.brand}</p>
                </div>
            ),
        },
        { key: 'productId', label: 'Product ID', render: r => <span className="text-[11px] font-mono font-bold bg-gray-50 px-2 py-1 rounded border border-gray-100 text-gray-700">{r.productId || '—'}</span> },
        { key: 'category', label: 'Category', render: r => <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{r.categorySlug} › {r.subcategorySlug || '—'}</span> },
        {
            key: 'tax', label: 'Taxation', render: r => (
                <div className="text-[10px] leading-tight">
                    <p className="font-bold text-gray-700">HSN: {r.hsnCode || '—'}</p>
                    <p className="text-primary-600 font-bold">{r.gstPercentage}% GST</p>
                </div>
            )
        },
        { key: 'status', label: 'Status', render: r => <Badge variant={r.isActive ? 'green' : 'red'} size="sm">{r.isActive ? 'Active' : 'Inactive'}</Badge> },
        {
            key: 'actions', label: '', render: r => (
                <div className="flex gap-3 justify-end pr-4">
                    <button onClick={(e) => { e.stopPropagation(); handleEdit(r) }} className="text-[10px] text-primary-600 font-bold hover:underline">EDIT</button>
                </div>
            )
        },
    ]

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

            <div className="flex gap-2 flex-wrap">
                {categories.map(c => (
                    <button
                        key={c._id || c.id}
                        onClick={() => {
                            setCatId(c._id || c.id);
                            setCategorySlug(c.slug); // Sync slug for the dropdowns
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${catId === (c._id || c.id)
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
                    data={filteredProducts} // --- FIX 4: Uncommented and used filteredProducts ---
                    loading={loading}
                    externalSearchValue={search}
                    onSearchChange={setSearch}
                    renderExpanded={renderExpanded}
                    actions={
                        <div className="flex gap-2">
                            <Select value={categorySlug} onChange={e => {
                                const selected = categories.find(c => c.slug === e.target.value);
                                setCategorySlug(e.target.value);
                                setCatId(selected?._id || selected?.id || '');
                                setSubcategorySlug('');
                            }}>
                                <option value="">All Categories</option>
                                {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                            </Select>
                            {categorySlug && (
                                <Select value={subcategorySlug} onChange={e => setSubcategorySlug(e.target.value)}>
                                    <option value="">All Subcategories</option>
                                    {categories.find(c => c.slug === categorySlug)?.subcategories?.map(s => (
                                        <option key={s.slug} value={s.slug}>{s.name}</option>
                                    ))}
                                </Select>
                            )}
                        </div>
                    }
                />
            )}
        </div>
    )
}