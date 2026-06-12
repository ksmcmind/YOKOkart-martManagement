// src/pages/Products.jsx
import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import * as XLSX from 'xlsx'
import {
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    bulkUploadProducts,
    selectAllProducts,
    selectProductLoading,
    selectProductSaving,
    selectProductError,
    selectFilteredProducts,
    clearProductError,
} from '../store/slices/productSlice'
import { fetchCategories, selectAllCategories } from '../store/slices/categorySlice'
import { showToast } from '../store/slices/uiSlice'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Grid from '../components/Grid'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Input, { Select } from '../components/Input'
import BulkUploadModal from '../components/BulkUploadModal'
import useAuth from '../hooks/useAuth'
import api from '../api/index'

// ── Constants ────────────────────────────────────────────────────────────────

const RETURN_POLICIES = [
    'No return',
    'Return within 24 hours',
    'Return within 48 hours',
    'Return within 7 days',
]

const SCHEMA_FIELDS = [
    'name', 'brand', 'description', 'category_slug', 'subcategory_slug',
    'search_keywords', 'tags', 'is_active', 'is_veg', 'return_policy',
    'hsn_code', 'gst_percentage', 'variant_id', 'variant_name',
    'display_size', 'sku', 'barcode', 'plu_code', 'details', 'images',
    'variant_is_active',
]

const FIELD_VALIDATORS = {
    name: v => v?.trim() ? true : 'Required',
    brand: v => v?.trim() ? true : 'Required',
    category_slug: v => v?.trim() ? true : 'Required',
}

const EMPTY_FORM = {
    name: '', brand: '', description: '', category_slug: '', subcategory_slug: '',
    search_keywords: '', tags: '', is_active: true, is_veg: true, return_policy: 'No return',
    hsn_code: '', gst_percentage: 0,
    variants: [
        { variant_id: '', variant_name: '', display_size: '', sku: '', barcode: '', plu_code: '', details: [], images: [], is_active: true }
    ]
}

const EMPTY_FILTERS = {
    categorySlug: '',
    subcategorySlug: '',
    brand: '',
    isActive: '',
    isVeg: '',
    search: '',
    page: 1,
}

const STATUS_OPTIONS = [
    { label: 'All Status', value: '' },
    { label: 'Active', value: 'true' },
    { label: 'Inactive', value: 'false' },
]

const VEG_OPTIONS = [
    { label: 'All Dietary', value: '' },
    { label: 'Veg', value: 'true' },
    { label: 'Non-Veg', value: 'false' },
]

function getActiveChips(f, categories) {
    const chips = []
    if (f.categorySlug) {
        const cat = categories.find(c => c.slug === f.categorySlug)
        chips.push({ key: 'categorySlug', label: `Category: ${cat?.name || f.categorySlug}` })
    }
    if (f.subcategorySlug) chips.push({ key: 'subcategorySlug', label: `Sub: ${f.subcategorySlug}` })
    if (f.brand) chips.push({ key: 'brand', label: `Brand: ${f.brand}` })
    if (f.isActive) chips.push({ key: 'isActive', label: f.isActive === 'true' ? 'Active' : 'Inactive' })
    if (f.isVeg) chips.push({ key: 'isVeg', label: f.isVeg === 'true' ? 'Veg' : 'Non-Veg' })
    return chips
}

function FilterBar({ draft, setDraft, onSearch, onReset, categories, loading }) {
    const [expanded, setExpanded] = useState(false)
    const [suggestions, setSuggestions] = useState([])
    const [suggestLoading, setSuggestLoading] = useState(false)
    const [showSuggest, setShowSuggest] = useState(false)
    const suggestRef = useRef(null)

    const set = (k, v) => setDraft(p => ({ ...p, [k]: v }))

    // Debounced autocomplete
    useEffect(() => {
        const q = draft.search?.trim()
        if (!q || q.length < 2) {
            setSuggestions([])
            return
        }

        const timer = setTimeout(async () => {
            setSuggestLoading(true)
            try {
                const res = await api.get(`/products/autocomplete?q=${encodeURIComponent(q)}`)
                console.log('[Autocomplete] Response:', res)
                if (res.success) {
                    setSuggestions(res.data?.suggestions || [])
                    setShowSuggest(true)
                }
            } catch (err) {
                console.error('[Autocomplete] Failed:', err)
            } finally {
                setSuggestLoading(false)
            }
        }, 400)

        return () => clearTimeout(timer)
    }, [draft.search])

    // Close on click outside
    useEffect(() => {
        const clickOut = (e) => {
            if (suggestRef.current && !suggestRef.current.contains(e.target)) {
                setShowSuggest(false)
            }
        }
        document.addEventListener('mousedown', clickOut)
        return () => document.removeEventListener('mousedown', clickOut)
    }, [])

    const handleSelect = (val) => {
        set('search', val)
        setShowSuggest(false)
        // Delay slightly to let state update before committing
        setTimeout(onSearch, 50)
    }

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm transition-all">
            <div className="p-3 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]" ref={suggestRef}>
                    <input
                        type="text"
                        placeholder="Search products by name, code, brand..."
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-0 focus:outline-none transition-all"
                        value={draft.search}
                        onChange={e => { set('search', e.target.value); setShowSuggest(true) }}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                onSearch()
                                setShowSuggest(false)
                            }
                        }}
                        onFocus={() => suggestions.length > 0 && setShowSuggest(true)}
                    />
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {suggestLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}

                    {/* Suggestions Dropdown */}
                    {showSuggest && draft.search.length >= 2 && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 max-h-60 overflow-y-auto">
                            {suggestions.length > 0 ? (
                                suggestions.map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSelect(s.name)}
                                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50 border-b border-gray-50 last:border-none flex items-center justify-between transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                            <span className="font-medium truncate max-w-[150px] sm:max-w-[200px]">{s.name}</span>
                                        </div>
                                        {s.brand && (
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{s.brand}</span>
                                        )}
                                    </button>
                                ))
                            ) : !suggestLoading ? (
                                <div className="px-4 py-3 text-xs text-gray-400 italic bg-gray-50/50">
                                    No products found for "{draft.search}"
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>

                <div className="flex gap-2">

                    <Button variant="secondary" size="sm" onClick={() => setExpanded(!expanded)} className={expanded ? 'bg-gray-100' : ''}>
                        <svg className={`w-4 h-4 mr-1.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        Filters
                    </Button>
                    <Button variant="primary" size="sm" onClick={onSearch} loading={loading}>Search</Button>
                </div>
            </div>

            {expanded && (
                <div className="px-3 pb-4 pt-1 border-t border-gray-50 bg-gray-50/30 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Category</label>
                        <Select value={draft.categorySlug} onChange={e => { set('categorySlug', e.target.value); set('subcategorySlug', '') }} className="bg-white border-gray-200">
                            <option value="">All Categories</option>
                            {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Subcategory</label>
                        <Select value={draft.subcategorySlug} onChange={e => set('subcategorySlug', e.target.value)} disabled={!draft.categorySlug} className="bg-white border-gray-200">
                            <option value="">All Subcategories</option>
                            {categories.find(c => c.slug === draft.categorySlug)?.subcategories.map(s => (
                                <option key={s.slug} value={s.slug}>{s.name}</option>
                            ))}
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Brand</label>
                        <input
                            type="text"
                            placeholder="Filter by brand..."
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:ring-0 transition-all bg-white"
                            value={draft.brand}
                            onChange={e => set('brand', e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Status</label>
                            <Select value={draft.isActive} onChange={e => set('isActive', e.target.value)} className="bg-white border-gray-200">
                                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Dietary</label>
                            <Select value={draft.isVeg} onChange={e => set('isVeg', e.target.value)} className="bg-white border-gray-200">
                                {VEG_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </Select>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}


// ── Components ───────────────────────────────────────────────────────────────

function DetailsEditor({ details, onChange }) {
    const update = (i, f, v) => {
        const next = [...details]
        next[i] = { ...next[i], [f]: v }
        onChange(next)
    }
    const add = () => onChange([...details, { key: '', value: '' }])
    const remove = (i) => onChange(details.filter((_, idx) => idx !== i))

    return (
        <div className="space-y-3 bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Additional Specs</label>
                <button onClick={add} className="text-[10px] text-primary-600 font-bold hover:underline">+ ADD FIELD</button>
            </div>
            <div className="space-y-2">
                {details.map((d, i) => (
                    <div key={i} className="flex gap-2 items-center">
                        <input placeholder="Property (e.g. Origin)" className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:border-primary-500 focus:ring-0 transition-all" value={d.key} onChange={e => update(i, 'key', e.target.value)} />
                        <input placeholder="Value" className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:border-primary-500 focus:ring-0 transition-all" value={d.value} onChange={e => update(i, 'value', e.target.value)} />
                        <button onClick={() => remove(i)} className="text-gray-300 hover:text-red-500 p-1">✕</button>
                    </div>
                ))}
                {details.length === 0 && <p className="text-[10px] text-gray-400 italic">No custom specs added yet.</p>}
            </div>
        </div>
    )
}

function VariantEditor({ variants, onChange, isEdit }) {
    const update = (i, f, v) => {
        const next = [...variants]
        next[i] = { ...next[i], [f]: v }
        onChange(next)
    }
    const add = () => onChange([...variants, { variant_id: '', variant_name: '', display_size: '', sku: '', barcode: '', plu_code: '', details: [], images: [], is_active: true }])
    const remove = (i) => onChange(variants.filter((_, idx) => idx !== i))

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-extrabold text-gray-900 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1 h-4 bg-primary-600 rounded-full"></span>
                    Product Variants
                </h4>
                <button onClick={add} className="text-[10px] bg-primary-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-primary-700 transition-all shadow-sm">+ NEW VARIANT</button>
            </div>

            <div className="space-y-4">
                {variants.map((v, i) => (
                    <div key={i} className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-4 relative group hover:bg-white hover:border-primary-200 transition-all">
                        {variants.length > 1 && (
                            <button onClick={() => remove(i)} className="absolute top-4 right-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">✕</button>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input label="Variant ID *" value={v.variant_id} onChange={e => update(i, 'variant_id', e.target.value)} disabled={isEdit} />
                            <Input label="Variant Name *" placeholder="e.g. 500g Pack" value={v.variant_name} onChange={e => update(i, 'variant_name', e.target.value)} />
                            <Input label="Size Label" placeholder="500g" value={v.display_size} onChange={e => update(i, 'display_size', e.target.value)} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <Input label="SKU *" value={v.sku} onChange={e => update(i, 'sku', e.target.value)} />
                            <Input label="Barcode" value={v.barcode} onChange={e => update(i, 'barcode', e.target.value)} />
                            <Input label="PLU" value={v.plu_code} onChange={e => update(i, 'plu_code', e.target.value)} />
                            <div className="flex flex-col gap-1.5 h-[58px] justify-end">
                                <label className="text-xs font-semibold text-gray-500">Active</label>
                                <div className="flex items-center h-[38px]">
                                    <input type="checkbox" checked={v.is_active} onChange={e => update(i, 'is_active', e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-primary-600" />
                                </div>
                            </div>
                        </div>

                        <DetailsEditor details={v.details || []} onChange={d => update(i, 'details', d)} />
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function Products() {
    const dispatch = useDispatch()
    const { user, isSuperAdmin, martId } = useAuth()
    const categories = useSelector(selectAllCategories)
    const loading = useSelector(selectProductLoading)
    const saving = useSelector(selectProductSaving)

    const [categorySlug, setCategorySlug] = useState('')
    const [subcategorySlug, setSubcategorySlug] = useState('')
    const [search, setSearch] = useState('')
    const [addOpen, setAddOpen] = useState(false)
    const [bulkOpen, setBulkOpen] = useState(false)
    const [form, setForm] = useState(EMPTY_FORM)
    const [isEdit, setIsEdit] = useState(false)

    // Filter state
    const [committedFilters, setCommittedFilters] = useState(EMPTY_FILTERS)
    const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS)

    const products = useSelector(selectAllProducts)
    const pagination = useSelector(state => state.product.pagination)
    const productError = useSelector(selectProductError)


    // Fetch categories once
    useEffect(() => {
        if (categories.length === 0) dispatch(fetchCategories())
    }, [dispatch, categories.length])

    // Debounced fetch — prevents hammering the API on every keystroke or StrictMode double-invoke.
    // If the last request failed (e.g. rate limit), stop retrying automatically.
    // Error is cleared when the user actively changes a filter so they can try again.
    useEffect(() => {
        // If no martId and user is NOT a super admin, block the fetch
        if (!martId && !isSuperAdmin) return 
        dispatch(fetchProducts({ ...committedFilters, martId: martId || null }))
    }, [dispatch, committedFilters, martId, isSuperAdmin])

    const handleSearch = () => setCommittedFilters({ ...draftFilters, page: 1 })
    const handleReset = () => {
        setDraftFilters(EMPTY_FILTERS)
        setCommittedFilters(EMPTY_FILTERS)
    }

    const removeChip = (key) => {
        const next = { ...committedFilters, [key]: '', page: 1 }
        setCommittedFilters(next)
        setDraftFilters(p => ({ ...p, [key]: '' }))
    }


    const handleEdit = (product) => {
        setForm({
            ...product,
            category_slug: product.categorySlug,
            subcategory_slug: product.subcategorySlug,
            is_active: product.isActive,
            is_veg: product.isVeg,
            hsn_code: product.hsnCode,
            gst_percentage: product.gstPercentage,
            search_keywords: product.searchKeywords?.join(', ') || '',
            tags: product.tags?.join(', ') || '',
            variants: product.variants.map(v => ({
                ...v,
                variant_id: v.variantId,
                variant_name: v.variantName,
                display_size: v.displaySize,
                is_active: v.isActive,
                details: Object.entries(v.details || {}).map(([key, value]) => ({ key, value }))
            }))
        })
        setIsEdit(true)
        setAddOpen(true)
    }

    const handleSave = async () => {
        if (!form.name || !form.category_slug) {
            dispatch(showToast({ message: 'Name and Category are required', type: 'error' }))
            return
        }

        const payload = {
            ...form,
            search_keywords: typeof form.search_keywords === 'string' ? form.search_keywords.split(',').map(s => s.trim()).filter(Boolean) : form.search_keywords,
            tags: typeof form.tags === 'string' ? form.tags.split(',').map(s => s.trim()).filter(Boolean) : form.tags,
            variants: form.variants.map(v => ({
                ...v,
                details: Array.isArray(v.details) ? v.details.reduce((acc, d) => { if (d.key) acc[d.key] = d.value; return acc }, {}) : v.details,
            })),
        }

        let res
        if (isEdit) {
            res = await dispatch(updateProduct({ id: form.id || form._id, data: payload }))
        } else {
            res = await dispatch(createProduct(payload))
        }

        if (!res.error) {
            setAddOpen(false); setForm(EMPTY_FORM); setIsEdit(false)
        }
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
            <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">Variant ID</th>
                        <th className="px-4 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">Variant Name</th>
                        <th className="px-4 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">SKU</th>
                        <th className="px-4 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">Barcode</th>
                        <th className="px-4 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">PLU</th>
                        <th className="px-4 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {r.variants?.map(v => (
                        <tr key={v.variantId} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-2 text-[9px] font-mono font-bold text-gray-600 bg-gray-50/50">{v.variantId}</td>
                            <td className="px-4 py-2 text-[11px] font-bold text-gray-700">{v.variantName}</td>
                            <td className="px-4 py-2 text-[10px] font-mono text-gray-500">{v.sku}</td>
                            <td className="px-4 py-2 text-[10px] font-mono text-gray-500">{v.barcode || '—'}</td>
                            <td className="px-4 py-2 text-[10px] font-mono text-gray-500">{v.pluCode || '—'}</td>
                            <td className="px-4 py-2">
                                <Badge variant={v.isActive ? 'green' : 'red'} size="xs">{v.isActive ? 'Active' : 'Inactive'}</Badge>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )

    const groupRowsToProducts = (rows) => {
        const map = new Map()
        rows.forEach(r => {
            const key = `${r.name?.trim().toLowerCase()}::${r.brand?.trim().toLowerCase()}`
            if (!map.has(key)) {
                map.set(key, {
                    ...r,
                    is_active: r.is_active?.toLowerCase() === 'true',
                    is_veg: r.is_veg?.toLowerCase() === 'true',
                    gst_percentage: parseFloat(r.gst_percentage || 0),
                    search_keywords: r.search_keywords?.split('|').map(t => t.trim()).filter(Boolean) || [],
                    tags: r.tags?.split('|').map(t => t.trim()).filter(Boolean) || [],
                    variants: [],
                })
            }
            map.get(key).variants.push({
                variant_id: r.variant_id, variant_name: r.variant_name, display_size: r.display_size,
                sku: r.sku, barcode: r.barcode, plu_code: r.plu_code,
                details: r.details || '{}',
                images: r.images?.split('|').map(u => u.trim()).filter(Boolean) || [],
                is_active: r.variant_is_active?.toLowerCase() === 'true',
            })
        })
        return [...map.values()]
    }

    const activeChips = getActiveChips(committedFilters, categories)

    return (
        <div className="p-4 sm:p-6 space-y-4">
            <PageHeader
                title="Products"
                subtitle="Manage global product catalog"
                action={(isSuperAdmin || user?.role === 'admin') && (
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setBulkOpen(true)}>Bulk Upload</Button>
                        <Button variant="primary" onClick={() => { setForm(EMPTY_FORM); setIsEdit(false); setAddOpen(true) }}>+ Add Product</Button>
                    </div>
                )}
            />

            <FilterBar
                draft={draftFilters}
                setDraft={setDraftFilters}
                onSearch={handleSearch}
                onReset={handleReset}
                categories={categories}
                loading={loading}
            />

            {activeChips.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-1">Active Filters:</span>
                    {activeChips.map(c => (
                        <div key={c.key} className="flex items-center gap-1.5 px-2 py-1 bg-primary-50 border border-primary-100 rounded-lg text-[11px] font-bold text-primary-700">
                            {c.label}
                            <button onClick={() => removeChip(c.key)} className="hover:text-primary-900 transition-colors">✕</button>
                        </div>
                    ))}
                    <button onClick={handleReset} className="text-[10px] text-gray-400 font-bold hover:text-red-500 ml-1 transition-colors uppercase tracking-widest">CLEAR ALL</button>
                </div>
            )}

            <Grid
                columns={columns}
                data={products}
                loading={loading}
                showSearch={false}
                renderExpanded={renderExpanded}
                totalItems={pagination?.total || 0}
                page={committedFilters.page}
                pageSize={committedFilters.limit || 50}
                onPageChange={(p) => setCommittedFilters(prev => ({ ...prev, page: p }))}
                onPageSizeChange={(sz) => setCommittedFilters(prev => ({ ...prev, page: 1, limit: sz }))}
            />


            <Modal
                open={addOpen}
                onClose={() => { setAddOpen(false); setIsEdit(false) }}
                title={isEdit ? 'Edit Product' : 'Create New Product'}
                size="xl"
                footer={<><Button variant="secondary" onClick={() => { setAddOpen(false); setIsEdit(false) }}>Cancel</Button><Button variant="primary" loading={saving} onClick={handleSave}>{isEdit ? 'Update' : 'Create Product'}</Button></>}
            >
                <div className="space-y-10">
                    <section className="space-y-4">
                        <h4 className="text-[10px] font-extrabold text-primary-600 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1 h-3 bg-primary-600 rounded-full"></span>
                            Core Information
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <Input label="Product Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                            <Input label="Brand Name *" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} />
                        </div>
                        <Input label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                    </section>

                    <section className="space-y-4">
                        <h4 className="text-[10px] font-extrabold text-primary-600 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1 h-3 bg-primary-600 rounded-full"></span>
                            Classification & Tags
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <Select label="Category *" value={form.category_slug} onChange={e => setForm({ ...form, category_slug: e.target.value, subcategory_slug: '' })}>
                                <option value="">Select Category</option>
                                {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                            </Select>
                            <Select label="Subcategory" value={form.subcategory_slug} onChange={e => setForm({ ...form, subcategory_slug: e.target.value })} disabled={!form.category_slug}>
                                <option value="">Select Subcategory</option>
                                {categories.find(c => c.slug === form.category_slug)?.subcategories.map(s => (
                                    <option key={s.slug} value={s.slug}>{s.name}</option>
                                ))}
                            </Select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <Input label="Search Keywords" placeholder="e.g. milk, fresh, dairy" value={form.search_keywords} onChange={e => setForm({ ...form, search_keywords: e.target.value })} />
                            <Input label="Tags" placeholder="e.g. popular, organic" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} />
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h4 className="text-[10px] font-extrabold text-primary-600 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1 h-3 bg-primary-600 rounded-full"></span>
                            Policy & Taxation
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <Select label="Return Policy" value={form.return_policy} onChange={e => setForm({ ...form, return_policy: e.target.value })}>
                                {RETURN_POLICIES.map(p => <option key={p} value={p}>{p}</option>)}
                            </Select>
                            <Input label="HSN Code" value={form.hsn_code} onChange={e => setForm({ ...form, hsn_code: e.target.value })} />
                            <Input label="GST %" type="number" value={form.gst_percentage} onChange={e => setForm({ ...form, gst_percentage: e.target.value })} />
                        </div>
                        <div className="flex gap-8 p-5 bg-gray-50/80 rounded-2xl border border-gray-100 shadow-inner">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-primary-600 transition-all" />
                                <div className="text-left">
                                    <p className="text-[11px] font-bold text-gray-900 leading-none">Catalog Visible</p>
                                    <p className="text-[9px] text-gray-400 mt-1">Is this product available for sale?</p>
                                </div>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" checked={form.is_veg} onChange={e => setForm({ ...form, is_veg: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-green-600 transition-all" />
                                <div className="text-left">
                                    <p className="text-[11px] font-bold text-gray-900 leading-none">Vegetarian</p>
                                    <p className="text-[9px] text-gray-400 mt-1">Show green dot on product</p>
                                </div>
                            </label>
                        </div>
                    </section>

                    <VariantEditor variants={form.variants} onChange={v => setForm({ ...form, variants: v })} isEdit={isEdit} />
                </div>
            </Modal>

            <BulkUploadModal
                open={bulkOpen} onClose={() => setBulkOpen(false)} title="Bulk Upload Products"
                schemaFields={SCHEMA_FIELDS} fieldValidators={FIELD_VALIDATORS}
                onUpload={async (items, file) => {
                    const action = await dispatch(bulkUploadProducts(file));
                    return action.payload;
                }}
                groupRows={groupRowsToProducts}
                onDone={() => dispatch(fetchProducts({ categorySlug, subcategorySlug, search, martId: martId || null }))}
            />
        </div>
    )
}