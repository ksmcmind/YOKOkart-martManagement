import { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    fetchProducts,
    selectAllProducts,
    selectProductLoading,
    selectPagination,
    clearProducts,
} from '../store/slices/productSlice'
import PageHeader from '../components/PageHeader'
import Grid from '../components/Grid'
import Badge from '../components/Badge'
import api from '../api/index'

// ── Small reusable filter controls ───────────────────────────────────────────

const Select = ({ children, ...props }) => (
    <select
        {...props}
        className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white
               focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none
               text-gray-700 font-medium min-w-[130px]"
    >
        {children}
    </select>
)

const FilterChip = ({ label, onRemove }) => (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50
                   text-primary-700 text-[10px] font-bold border border-primary-200">
        {label}
        <button onClick={onRemove} className="hover:text-primary-900 leading-none">×</button>
    </span>
)

// ── Default filter state ──────────────────────────────────────────────────────

const DEFAULT_FILTERS = {
    categorySlug: '',
    subcategorySlug: '',
    search: '',
    brand: '',
    isActive: '',
    isVeg: '',
    page: 1,
    limit: 50,
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Products() {
    const dispatch = useDispatch()
    const products = useSelector(selectAllProducts)
    const loading = useSelector(selectProductLoading)
    const pagination = useSelector(selectPagination)

    const [categories, setCategories] = useState([])
    const [filters, setFilters] = useState(DEFAULT_FILTERS)

    // Fetch categories once on mount
    useEffect(() => {
        api.get('/categories').then(r => setCategories(r.data || []))
    }, [])

    // Fetch products whenever filters change
    useEffect(() => {
        dispatch(fetchProducts(filters))
    }, [filters, dispatch])

    // Cleanup on unmount
    useEffect(() => () => dispatch(clearProducts()), [dispatch])

    const setFilter = useCallback((key, value) => {
        setFilters(prev => ({
            ...prev,
            [key]: value,
            // Reset dependent filters
            ...(key === 'categorySlug' ? { subcategorySlug: '', page: 1 } : {}),
            ...(key !== 'page' ? { page: 1 } : {}),
        }))
    }, [])

    const resetFilters = () => setFilters(DEFAULT_FILTERS)

    // Active subcategories based on selected category
    const activeCategory = categories.find(c => c.slug === filters.categorySlug)
    const subcategories = activeCategory?.subcategories || []

    // Count active filters for badge
    const activeFilterCount = [
        filters.categorySlug, filters.subcategorySlug, filters.brand,
        filters.isActive, filters.isVeg, filters.search,
    ].filter(Boolean).length

    // ── Table columns ───────────────────────────────────────────────────────────

    const columns = [
        {
            key: 'name', label: 'Product',
            render: r => (
                <div className="py-1">
                    <p className="font-bold text-gray-900 leading-tight">{r.name}</p>
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{r.brand}</p>
                </div>
            ),
        },
        {
            key: 'product_id', label: 'Product ID',
            render: r => (
                <span className="text-[11px] font-mono font-bold bg-gray-50 px-2 py-1 rounded
                         border border-gray-100 text-gray-700">
                    {r.product_id || r.productId || '—'}
                </span>
            ),
        },
        {
            key: 'category', label: 'Category',
            render: r => (
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                    {r.category_slug || r.categorySlug} › {r.subcategory_slug || r.subcategorySlug || '—'}
                </span>
            ),
        },
        {
            key: 'variants', label: 'Variants',
            render: r => (
                <span className="text-xs font-bold text-gray-600">
                    {r.variants?.length || 0}
                </span>
            ),
        },
        {
            key: 'tax', label: 'Taxation',
            render: r => (
                <div className="text-[10px] leading-tight">
                    <p className="font-bold text-gray-700">HSN: {r.hsn_code || r.hsnCode || '—'}</p>
                    <p className="text-primary-600 font-bold">{r.gst_percentage ?? r.gstPercentage ?? 0}% GST</p>
                </div>
            ),
        },
        {
            key: 'flags', label: 'Type',
            render: r => (
                <div className="flex gap-1">
                    {(r.is_veg ?? r.isVeg) && <Badge variant="green" size="xs">Veg</Badge>}
                    {!(r.is_veg ?? r.isVeg) && <Badge variant="red" size="xs">Non-Veg</Badge>}
                </div>
            ),
        },
        {
            key: 'status', label: 'Status',
            render: r => (
                <Badge variant={(r.is_active ?? r.isActive) ? 'green' : 'red'} size="sm">
                    {(r.is_active ?? r.isActive) ? 'Active' : 'Inactive'}
                </Badge>
            ),
        },
    ]

    // ── Expanded variant row ────────────────────────────────────────────────────

    const renderExpanded = (r) => (
        <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
            {r.variants?.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                        <tr>
                            {['Variant ID', 'Variant Name', 'Size', 'SKU', 'Barcode', 'PLU', 'Status'].map(h => (
                                <th key={h} className="px-4 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {r.variants.map(v => (
                            <tr key={v.variant_id || v.variantId} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-4 py-2 text-[9px] font-mono font-bold text-gray-600 bg-gray-50/50">
                                    {v.variant_id || v.variantId}
                                </td>
                                <td className="px-4 py-2 text-[11px] font-bold text-gray-700">
                                    {v.variant_name || v.variantName}
                                </td>
                                <td className="px-4 py-2 text-[10px] text-gray-500">
                                    {v.display_size || v.displaySize || '—'}
                                </td>
                                <td className="px-4 py-2 text-[10px] font-mono text-gray-500">{v.sku || '—'}</td>
                                <td className="px-4 py-2 text-[10px] font-mono text-gray-500">{v.barcode || '—'}</td>
                                <td className="px-4 py-2 text-[10px] font-mono text-gray-500">
                                    {v.plu_code || v.pluCode || '—'}
                                </td>
                                <td className="px-4 py-2">
                                    <Badge variant={(v.is_active ?? v.isActive) ? 'green' : 'red'} size="xs">
                                        {(v.is_active ?? v.isActive) ? 'Active' : 'Inactive'}
                                    </Badge>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <div className="p-4 text-center text-xs text-gray-400">No variants available</div>
            )}
        </div>
    )

    // ── Render ──────────────────────────────────────────────────────────────────

    return (
        <div className="p-4 sm:p-6 space-y-4">
            <PageHeader
                title="Products"
                subtitle="View product catalog"
            />

            {/* ── Filter bar ─────────────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
                <div className="flex flex-wrap gap-2 items-center">

                    {/* Category */}
                    <Select
                        value={filters.categorySlug}
                        onChange={e => setFilter('categorySlug', e.target.value)}
                    >
                        <option value="">All Categories</option>
                        {categories.map(c => (
                            <option key={c.slug} value={c.slug}>{c.icon || ''} {c.name}</option>
                        ))}
                    </Select>

                    {/* Subcategory — only shown when a category is selected */}
                    {filters.categorySlug && subcategories.length > 0 && (
                        <Select
                            value={filters.subcategorySlug}
                            onChange={e => setFilter('subcategorySlug', e.target.value)}
                        >
                            <option value="">All Subcategories</option>
                            {subcategories.map(s => (
                                <option key={s.slug} value={s.slug}>{s.name}</option>
                            ))}
                        </Select>
                    )}

                    {/* Status */}
                    <Select
                        value={filters.isActive}
                        onChange={e => setFilter('isActive', e.target.value)}
                    >
                        <option value="">All Status</option>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                    </Select>

                    {/* Veg/Non-Veg */}
                    <Select
                        value={filters.isVeg}
                        onChange={e => setFilter('isVeg', e.target.value)}
                    >
                        <option value="">Veg & Non-Veg</option>
                        <option value="true">Veg Only</option>
                        <option value="false">Non-Veg Only</option>
                    </Select>

                    {/* Brand search */}
                    <input
                        type="text"
                        placeholder="Search brand..."
                        value={filters.brand}
                        onChange={e => setFilter('brand', e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white
                       focus:ring-2 focus:ring-primary-500 outline-none text-gray-700
                       font-medium w-32"
                    />

                    {/* Reset */}
                    {activeFilterCount > 0 && (
                        <button
                            onClick={resetFilters}
                            className="text-xs text-gray-400 hover:text-red-500 font-medium px-2 py-1.5
                         rounded-lg hover:bg-red-50 transition-colors ml-auto"
                        >
                            Clear all ({activeFilterCount})
                        </button>
                    )}
                </div>

                {/* Active filter chips */}
                {activeFilterCount > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {filters.categorySlug && <FilterChip label={`Cat: ${filters.categorySlug}`} onRemove={() => setFilter('categorySlug', '')} />}
                        {filters.subcategorySlug && <FilterChip label={`Sub: ${filters.subcategorySlug}`} onRemove={() => setFilter('subcategorySlug', '')} />}
                        {filters.brand && <FilterChip label={`Brand: ${filters.brand}`} onRemove={() => setFilter('brand', '')} />}
                        {filters.isActive && <FilterChip label={filters.isActive === 'true' ? 'Active' : 'Inactive'} onRemove={() => setFilter('isActive', '')} />}
                        {filters.isVeg && <FilterChip label={filters.isVeg === 'true' ? 'Veg' : 'Non-Veg'} onRemove={() => setFilter('isVeg', '')} />}
                        {filters.search && <FilterChip label={`Search: ${filters.search}`} onRemove={() => setFilter('search', '')} />}
                    </div>
                )}
            </div>

            {/* ── Results ────────────────────────────────────────────────────────── */}
            <Grid
                columns={columns}
                data={products}
                loading={loading}
                externalSearchValue={filters.search}
                onSearchChange={v => setFilter('search', v)}
                renderExpanded={renderExpanded}
            />

            {/* ── Pagination ─────────────────────────────────────────────────────── */}
            {pagination && pagination.total_pages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-gray-400">
                        Showing {((filters.page - 1) * filters.limit) + 1}–{Math.min(filters.page * filters.limit, pagination.total)} of {pagination.total} products
                    </p>
                    <div className="flex gap-1">
                        <button
                            disabled={filters.page <= 1}
                            onClick={() => setFilter('page', filters.page - 1)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200
                         disabled:opacity-40 hover:bg-gray-50 transition-colors"
                        >
                            ← Prev
                        </button>
                        {/* Page numbers — show max 5 around current */}
                        {Array.from({ length: pagination.total_pages }, (_, i) => i + 1)
                            .filter(p => Math.abs(p - filters.page) <= 2)
                            .map(p => (
                                <button
                                    key={p}
                                    onClick={() => setFilter('page', p)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors
                    ${p === filters.page
                                            ? 'bg-primary-500 text-white border-primary-500'
                                            : 'border-gray-200 hover:bg-gray-50'
                                        }`}
                                >
                                    {p}
                                </button>
                            ))
                        }
                        <button
                            disabled={filters.page >= pagination.total_pages}
                            onClick={() => setFilter('page', filters.page + 1)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200
                         disabled:opacity-40 hover:bg-gray-50 transition-colors"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}