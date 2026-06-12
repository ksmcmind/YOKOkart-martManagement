import { useEffect, useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Grid from '../components/Grid'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Input from '../components/Input'
import { showToast } from '../store/slices/uiSlice'
import api from '../api/index'

export default function Variants() {
  const dispatch = useDispatch()
  const user = useSelector((state) => state.auth.user)
  const isSuperAdmin = user?.role === 'super_admin'

  const [variants, setVariants] = useState([])
  const [pagination, setPagination] = useState(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editingVariant, setEditingVariant] = useState(null)
  const [saving, setSaving] = useState(false)

  // Filters state
  const [inputValue, setInputValue] = useState('')
  const [search, setSearch] = useState('')
  const [brand, setBrand] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [showSuggest, setShowSuggest] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const suggestRef = useRef(null)

  // Edit variant form state
  const [form, setForm] = useState({
    variant_name: '',
    display_size: '',
    sku: '',
    barcode: '',
    plu_code: '',
    is_active: true,
    details: []
  })

  const loadVariants = async (targetPage = page, targetLimit = limit, targetSearch = search, targetProductId = selectedProductId) => {
    setLoading(true)
    try {
      const qParams = new URLSearchParams()
      if (targetSearch) qParams.set('search', targetSearch)
      if (brand) qParams.set('brand', brand)
      if (targetProductId) qParams.set('productId', targetProductId)
      qParams.set('page', String(targetPage))
      qParams.set('limit', String(targetLimit))

      const res = await api.get(`/products/variants?${qParams.toString()}`)
      if (res.success) {
        setVariants(res.data?.variants || [])
        setPagination(res.data?.pagination || null)
      }
    } catch (err) {
      console.error('Failed to load variants:', err)
      dispatch(showToast({ message: 'Failed to load variants data', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVariants(page, limit)
  }, [brand, page, limit])

  // Debounced search autocomplete
  useEffect(() => {
    const q = inputValue?.trim()
    if (!q || q.length < 2 || q === search.trim()) {
      setSuggestions([])
      if (q === search.trim()) {
        setShowSuggest(false)
      }
      return
    }

    const timer = setTimeout(async () => {
      setSuggestLoading(true)
      try {
        const res = await api.get(`/products/autocomplete?q=${encodeURIComponent(q)}`)
        if (res.success) {
          setSuggestions(res.data?.suggestions || [])
          setShowSuggest(true)
        }
      } catch (err) {
        console.error('[Autocomplete] Failed:', err)
      } finally {
        setSuggestLoading(false)
      }
    }, 450)

    return () => clearTimeout(timer)
  }, [inputValue, search])

  // Close suggestions on click outside
  useEffect(() => {
    const clickOut = (e) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target)) {
        setShowSuggest(false)
      }
    }
    document.addEventListener('mousedown', clickOut)
    return () => document.removeEventListener('mousedown', clickOut)
  }, [])

  const handleSearchSubmit = async (q = inputValue) => {
    let finalProductId = ''
    let term = q
    if (q && q.trim()) {
      // Option A: Resolve text query by calling autocomplete API to find the top suggestion's ID
      try {
        const res = await api.get(`/products/autocomplete?q=${encodeURIComponent(q.trim())}`)
        if (res.success && res.data?.suggestions?.length > 0) {
          const topSuggest = res.data.suggestions[0]
          if (topSuggest.is_brand) {
            setBrand(topSuggest.brand || topSuggest.name)
            setInputValue('')
            setSearch('')
            setSelectedProductId('')
            setPage(1)
            setTimeout(() => loadVariants(1, limit, '', ''), 50)
            setShowSuggest(false)
            return
          } else {
            finalProductId = topSuggest.product_id || ''
            setInputValue(topSuggest.name)
            term = topSuggest.name
          }
        }
      } catch (err) {
        console.error('[Resolve search ID] Failed:', err)
      }
    }
    setSelectedProductId(finalProductId)
    setSearch(term)
    setPage(1)
    setTimeout(() => loadVariants(1, limit, term, finalProductId), 50)
    setShowSuggest(false)
  }

  const handleSelectSuggest = (s) => {
    if (s.is_brand) {
      setBrand(s.brand || s.name)
      setInputValue('')
      setSearch('')
      setSelectedProductId('')
      setPage(1)
      setTimeout(() => loadVariants(1, limit, '', ''), 50)
    } else {
      const term = s.name
      setInputValue(term)
      setSearch(term)
      setSelectedProductId(s.product_id)
      setPage(1)
      setTimeout(() => loadVariants(1, limit, term, s.product_id), 50)
    }
    setShowSuggest(false)
  }

  const handleEdit = (v) => {
    setEditingVariant(v)
    setForm({
      variant_name: v.variantName || v.variant_name || '',
      display_size: v.displaySize || v.display_size || '',
      sku: v.sku || '',
      barcode: v.barcode || '',
      plu_code: v.pluCode || v.plu_code || '',
      is_active: v.isActive !== false,
      details: Object.entries(v.details || {}).map(([key, value]) => ({ key, value }))
    })
    setOpen(true)
  }

  const handleUpdate = async () => {
    if (!form.sku || !form.variant_name) {
      dispatch(showToast({ message: 'Variant Name and SKU are required', type: 'error' }))
      return
    }

    setSaving(true)
    try {
      const payload = {
        variantName: form.variant_name,
        displaySize: form.display_size,
        sku: form.sku,
        barcode: form.barcode || null,
        pluCode: form.plu_code || null,
        isActive: form.is_active,
        details: form.details.reduce((acc, d) => {
          if (d.key) acc[d.key] = d.value
          return acc
        }, {})
      }

      // We call the status update/edit API on backend
      const res = await api.patch(`/products/${editingVariant.product_id || editingVariant.productId}/variants/${editingVariant.variant_id || editingVariant.variantId}/status`, payload)
      
      if (res.success) {
        dispatch(showToast({ message: 'Variant updated successfully!', type: 'success' }))
        setOpen(false)
        loadVariants()
      } else {
        dispatch(showToast({ message: res.message || 'Failed to update variant', type: 'error' }))
      }
    } catch (err) {
      dispatch(showToast({ message: err.message || 'Operation failed', type: 'error' }))
    } finally {
      setSaving(false)
    }
  }

  const addDetailField = () => {
    setForm(prev => ({ ...prev, details: [...prev.details, { key: '', value: '' }] }))
  }

  const updateDetailField = (idx, field, val) => {
    setForm(prev => {
      const nextDetails = [...prev.details]
      nextDetails[idx] = { ...nextDetails[idx], [field]: val }
      return { ...prev, details: nextDetails }
    })
  }

  const removeDetailField = (idx) => {
    setForm(prev => ({ ...prev, details: prev.details.filter((_, i) => i !== idx) }))
  }

  const columns = [
    {
      key: 'variant',
      label: 'Variant Name',
      render: r => (
        <div className="py-1">
          <p className="font-bold text-gray-900 leading-tight">{r.variantName || r.variant_name}</p>
          {r.displaySize && <span className="text-[10px] bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full font-semibold">{r.displaySize}</span>}
        </div>
      )
    },
    {
      key: 'parent',
      label: 'Parent Product',
      render: r => (
        <div>
          <p className="font-bold text-gray-800 leading-tight">{r.productName || r.product_name}</p>
        </div>
      )
    },
    {
      key: 'brand',
      label: 'Brand',
      render: r => <span className="font-bold text-gray-700 bg-gray-50 border border-gray-100 rounded px-2.5 py-0.5 text-[10px] uppercase tracking-wider">{r.brand || '—'}</span>
    },
    {
      key: 'sku',
      label: 'SKU & Code',
      render: r => (
        <div className="text-[10px] font-mono leading-tight">
          <p className="font-bold text-gray-700">SKU: {r.sku}</p>
          {r.variant_code && <p className="text-gray-400">Code: {r.variant_code}</p>}
        </div>
      )
    },
    {
      key: 'barcode',
      label: 'Barcode / PLU',
      render: r => (
        <div className="text-[10px] font-mono leading-tight">
          <p className="font-semibold text-gray-600">UPC: {r.barcode || '—'}</p>
          {r.pluCode && <p className="text-primary-600 font-bold">PLU: {r.pluCode}</p>}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: r => <Badge variant={r.isActive || r.is_active ? 'green' : 'red'} size="sm">{r.isActive || r.is_active ? 'Active' : 'Inactive'}</Badge>
    }
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Variants"
        subtitle="Manage product packaging details, barcodes, and specs"
      />

      {/* Brand-only and Suggestions Search FilterBar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]" ref={suggestRef}>
          <input
            type="text"
            placeholder="Search variants by name, SKU, barcode..."
            className="w-full pl-9 pr-8 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-0 focus:outline-none transition-all"
            value={inputValue}
            onChange={e => { setInputValue(e.target.value); setShowSuggest(true) }}
            onKeyDown={async e => {
              if (e.key === 'Enter') {
                await handleSearchSubmit(inputValue)
              }
            }}
            onFocus={() => suggestions.length > 0 && setShowSuggest(true)}
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {suggestLoading && (
            <div className="absolute right-8 top-1/2 -translate-y-1/2">
              <div className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          {inputValue && (
            <button
              onClick={() => {
                setInputValue('')
                setSearch('')
                setSelectedProductId('')
                setPage(1)
                loadVariants(1, limit, '', '')
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-rose-500 font-bold"
            >
              ✕
            </button>
          )}

          {/* Autocomplete Dropdown */}
          {showSuggest && inputValue.length >= 2 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto">
              {suggestions.length > 0 ? (
                suggestions.map((s, i) => (
                  <button
                    key={i}
                    onMouseDown={e => {
                      e.preventDefault()
                      handleSelectSuggest(s)
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50 border-b border-gray-50 last:border-none flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{s.is_brand ? '🏷️' : '🔍'}</span>
                      <span className="font-semibold truncate max-w-[150px] sm:max-w-[200px]">{s.name}</span>
                    </div>
                    {s.is_brand ? (
                      <span className="text-[9px] font-extrabold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Brand</span>
                    ) : s.brand && (
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{s.brand}</span>
                    )}
                  </button>
                ))
              ) : !suggestLoading ? (
                <div className="px-4 py-3 text-xs text-gray-400 italic">No variants matched search</div>
              ) : null}
            </div>
          )}
        </div>

        <div className="w-48">
          <input
            type="text"
            placeholder="Filter by brand..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:ring-0 transition-all bg-white"
            value={brand}
            onChange={e => { setBrand(e.target.value); setPage(1); }}
          />
        </div>

        <Button variant="primary" onClick={() => handleSearchSubmit(inputValue)} loading={loading}>Search</Button>
      </div>

      <Grid
        columns={columns}
        data={variants}
        loading={loading}
        showSearch={false}
        totalItems={pagination?.total || 0}
        page={page}
        pageSize={limit}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(sz) => { setPage(1); setLimit(sz); }}
        emptyText="No variants found matching criteria."
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Edit Variant: ${editingVariant?.variantName || editingVariant?.variant_name}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={handleUpdate}>Update Variant</Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Variant Name *" value={form.variant_name} onChange={e => setForm({ ...form, variant_name: e.target.value })} />
            <Input label="Display Size (e.g. 500g)" value={form.display_size} onChange={e => setForm({ ...form, display_size: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="SKU *" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
            <Input label="Barcode" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} />
            <Input label="PLU Code" value={form.plu_code} onChange={e => setForm({ ...form, plu_code: e.target.value })} />
          </div>
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-primary-600" />
            <div>
              <p className="text-xs font-bold text-gray-900 leading-none">Active Status</p>
              <p className="text-[10px] text-gray-400 mt-1">Check to enable variant in the active catalog</p>
            </div>
          </div>

          {/* Details Specifications Editor */}
          <div className="space-y-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Variant Specs</label>
              <button onClick={addDetailField} className="text-[10px] text-primary-600 font-bold hover:underline">+ ADD FIELD</button>
            </div>
            <div className="space-y-2">
              {form.details.map((d, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input placeholder="Specification Name" className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:border-primary-500 focus:ring-0" value={d.key} onChange={e => updateDetailField(i, 'key', e.target.value)} />
                  <input placeholder="Specification Value" className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:border-primary-500 focus:ring-0" value={d.value} onChange={e => updateDetailField(i, 'value', e.target.value)} />
                  <button onClick={() => removeDetailField(i)} className="text-gray-300 hover:text-red-500 p-1">✕</button>
                </div>
              ))}
              {form.details.length === 0 && <p className="text-[10px] text-gray-400 italic">No custom variant specifications added.</p>}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
