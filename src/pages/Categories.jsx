import { useEffect, useState, useRef, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    fetchCategories, createCategory, updateCategory,
    addSubcategory, updateSubcategory,
    bulkUploadCategories,
    selectAllCategories, selectCategoryLoading,
} from '../store/slices/categorySlice'
import { showToast } from '../store/slices/uiSlice'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Modal from '../components/Modal'
import Input from '../components/Input'
import BulkUploadModal from '../components/BulkUploadModal'
import useAuth from '../hooks/useAuth'

const SCHEMA_FIELDS = [
    'category_code', 'category_name', 'category_slug', 'category_title',
    'category_icon', 'category_image_url', 'type', 'sort_order', 'is_active',
    'subcategory_code', 'subcategory_name', 'subcategory_slug', 'subcategory_title',
    'subcategory_icon', 'subcategory_image_url',
]
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const isBlank = v => v === undefined || v === null || String(v).trim() === ''
const FIELD_VALIDATORS = {
    category_code: v => isBlank(v) ? 'required' : (String(v).trim().length >= 3 && String(v).trim().length <= 20) || '3-20 chars',
    category_name: v => isBlank(v) ? 'required' : String(v).trim().length <= 100 || 'max 100 chars',
    category_slug: v => isBlank(v) ? 'required' : SLUG_RE.test(String(v).trim().toLowerCase()) || 'invalid slug',
    type: v => isBlank(v) ? 'required' : ['product', 'service'].includes(String(v).trim().toLowerCase()) || '"product" or "service"',
    is_active: v => isBlank(v) ? 'required' : ['true', 'false'].includes(String(v).toLowerCase().trim()) || '"true" or "false"',
}
const CAT_INIT = { category_code: '', name: '', slug: '', title: '', icon: '', image: '', sortOrder: '0', type: 'product', is_active: true }
const SUB_INIT = { subcategory_code: '', name: '', slug: '', title: '', icon: '', image: '', is_active: true }
const POLL_MS = 2000
const toSlug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const downloadCSVTemplate = () => {
    const blob = new Blob([
        [SCHEMA_FIELDS.join(','), 'C001,Dairy,dairy,Dairy Title,,http://img.com/d.jpg,product,1,true,S001,Milk,milk,Milk Title,,http://img.com/m.jpg'].join('\n')
    ], { type: 'text/csv' })
    Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'categories_template.csv' }).click()
}

// ── Sub modal ────────────────────────────────────────────────
function SubModal({ open, category, editingSub, onClose, onSave }) {
    const [form, setForm] = useState(SUB_INIT)
    const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

    useEffect(() => {
        setForm(editingSub ? {
            subcategory_code: editingSub.subcategory_code || '',
            name: editingSub.name || '',
            slug: editingSub.slug || '',
            title: editingSub.title || '',
            icon: editingSub.icon || '',
            image: editingSub.image_url || '',
            is_active: editingSub.is_active,
        } : SUB_INIT)
    }, [editingSub, open])

    return (
        <Modal open={open} onClose={onClose} title={`${editingSub ? 'Edit' : 'Add'} Subcategory — ${category?.name || ''}`} size="md">
            <div className="grid grid-cols-2 gap-3 py-2">
                <Input label="Code *" value={form.subcategory_code} onChange={set('subcategory_code')} placeholder="S001" />
                <Input label="Name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value, slug: toSlug(e.target.value) }))} placeholder="e.g. Milk" />
                <Input label="Slug *" value={form.slug} onChange={set('slug')} />
                <Input label="Title" value={form.title} onChange={set('title')} />
                <Input label="Image URL" value={form.image} onChange={set('image')} placeholder="https://..." className="col-span-2" />
                <div className="col-span-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</label>
                    <select className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        value={String(form.is_active)} onChange={e => setForm(p => ({ ...p, is_active: e.target.value === 'true' }))}>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                    </select>
                </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button variant="primary" onClick={() => onSave(form)}>Save</Button>
            </div>
        </Modal>
    )
}

// ── Polling banner ───────────────────────────────────────────
function PollBanner({ status, onDismiss }) {
    if (!status) return null
    const { percent, inserted, updated, failed, done, error } = status
    const color = error ? 'red' : done ? 'green' : 'blue'
    const label = error ? 'Upload failed' : done ? 'Upload complete' : 'Processing upload...'

    return (
        <div className={`rounded-xl border px-4 py-3 bg-${color}-50 border-${color}-200`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    {!done && (
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    )}
                    <span className="text-sm font-semibold text-gray-700">{label}</span>
                    {!done && <span className="text-xs text-gray-400">polling every 2s...</span>}
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-xs font-medium text-green-600">{inserted} inserted</span>
                    <span className="text-xs font-medium text-blue-600">{updated} updated</span>
                    <span className="text-xs font-medium text-red-500">{failed} failed</span>
                    {done && (
                        <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 text-base leading-none ml-1">x</button>
                    )}
                </div>
            </div>
            <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-gray-200">
                <div
                    className={`h-full rounded-full transition-all duration-700 ${error ? 'bg-red-400' : done ? 'bg-green-400' : 'bg-blue-400'}`}
                    style={{ width: `${done ? 100 : percent}%` }}
                />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">{done ? `Finished — ${inserted + updated} rows processed` : `${percent}% complete`}</p>
        </div>
    )
}

// ── Expandable category row ──────────────────────────────────
function CategoryRow({ cat, onEdit, onAddSub, onEditSub }) {
    const [expanded, setExpanded] = useState(false)
    const subs = Array.isArray(cat.subcategories) ? cat.subcategories : []

    return (
        <>
            <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                    <button onClick={() => setExpanded(p => !p)} className="text-gray-400 hover:text-gray-700 text-xs font-mono w-5">
                        {expanded ? '▼' : '▶'}
                    </button>
                </td>
                <td className="px-4 py-3">
                    <span className="text-xs font-mono text-gray-500">{cat.category_code}</span>
                </td>
                <td className="px-4 py-3">
                    <span className="text-sm font-medium text-gray-900">{cat.name}</span>
                </td>
                <td className="px-4 py-3">
                    <span className="text-xs text-gray-500">{cat.slug}</span>
                </td>
                <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${cat.type === 'product' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                        {cat.type || 'product'}
                    </span>
                </td>
                <td className="px-4 py-3 text-center">
                    <span className="text-xs text-gray-500">{subs.length}</span>
                </td>
                <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium ${cat.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                        {cat.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td className="px-4 py-3 text-center">
                    <span className="text-xs text-gray-400">{cat.sort_order ?? 0}</span>
                </td>
                <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                        <Button variant="secondary" size="xs" onClick={() => onEdit(cat)}>Edit</Button>
                        <Button variant="secondary" size="xs" onClick={() => onAddSub(cat)}>+ Sub</Button>
                    </div>
                </td>
            </tr>

            {expanded && (
                <tr className="bg-gray-50">
                    <td colSpan={9} className="px-6 py-3">
                        {subs.length === 0 ? (
                            <p className="text-xs text-gray-400 italic py-1">No subcategories.</p>
                        ) : (
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-[10px] text-gray-400 uppercase tracking-wider">
                                        <th className="text-left pb-2 font-semibold">Code</th>
                                        <th className="text-left pb-2 font-semibold">Name</th>
                                        <th className="text-left pb-2 font-semibold">Slug</th>
                                        <th className="text-left pb-2 font-semibold">Status</th>
                                        <th className="text-left pb-2 font-semibold">Sort</th>
                                        <th className="pb-2" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {subs.map(sub => (
                                        <tr key={sub._id} className="border-t border-gray-100">
                                            <td className="py-1.5 font-mono text-gray-500">{sub.subcategory_code}</td>
                                            <td className="py-1.5 font-medium text-gray-800">{sub.name}</td>
                                            <td className="py-1.5 text-gray-400">{sub.slug}</td>
                                            <td className="py-1.5">
                                                <span className={sub.is_active ? 'text-green-600' : 'text-gray-400'}>
                                                    {sub.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="py-1.5 text-gray-400">{sub.sort_order}</td>
                                            <td className="py-1.5 text-right">
                                                <Button variant="secondary" size="xs" onClick={() => onEditSub(cat, sub)}>Edit</Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </td>
                </tr>
            )}
        </>
    )
}

// ── Main page ────────────────────────────────────────────────
export default function Categories() {
    const dispatch = useDispatch()
    const categories = useSelector(selectAllCategories)
    const loading = useSelector(selectCategoryLoading)
    const { staffId } = useAuth()

    const [bulkOpen, setBulkOpen] = useState(false)
    const [catModal, setCatModal] = useState(false)
    const [subModal, setSubModal] = useState(null)
    const [catForm, setCatForm] = useState(CAT_INIT)
    const [editingCat, setEditingCat] = useState(null)
    const [saving, setSaving] = useState(false)
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('all')
    const [pollStatus, setPollStatus] = useState(null)
    const pollRef = useRef(null)

    useEffect(() => { dispatch(fetchCategories()) }, [dispatch])
    useEffect(() => () => clearInterval(pollRef.current), [])

    const filtered = useMemo(() => (Array.isArray(categories) ? categories : []).filter(c => {
        const q = search.toLowerCase()
        const subMatch = c.subcategories?.some(s =>
            s.name?.toLowerCase().includes(q) ||
            s.subcategory_code?.toLowerCase().includes(q)
        )
        return (!q || c.name?.toLowerCase().includes(q) || c.category_code?.toLowerCase().includes(q) || subMatch)
            && (typeFilter === 'all' || c.type === typeFilter)
    }), [categories, search, typeFilter])

    // ── polling ──────────────────────────────────────────────
    const startPolling = jobId => {
        clearInterval(pollRef.current)
        setPollStatus({ percent: 0, inserted: 0, updated: 0, failed: 0, done: false, error: false })
        pollRef.current = setInterval(async () => {
            try {
                const { data } = await fetch(`/api/admin/bulk/status/${jobId}`).then(r => r.json())
                const { percent = 0, inserted = 0, updated = 0, failed = 0 } = data.progressSnapshot || {}
                setPollStatus({ percent, inserted, updated, failed, done: !data.isRunning, error: false })
                if (!data.isRunning) {
                    clearInterval(pollRef.current)
                    dispatch(fetchCategories())
                }
            } catch {
                clearInterval(pollRef.current)
                setPollStatus(p => ({ ...p, done: true, error: true }))
            }
        }, POLL_MS)
    }

    const handleBulkUpload = async (payload, file) => {
        const action = await dispatch(bulkUploadCategories({ file, staffId }))
        const res = action.payload
        if (res?.jobId) startPolling(res.jobId)
        return res
    }

    const openAddCat = () => { setEditingCat(null); setCatForm(CAT_INIT); setCatModal(true) }
    const openEditCat = cat => {
        setEditingCat(cat)
        setCatForm({
            category_code: cat.category_code || '',
            name: cat.name || '',
            slug: cat.slug || '',
            title: cat.title || '',
            icon: cat.icon || '',
            image: cat.image_url || '',
            sortOrder: String(cat.sort_order ?? 0),
            type: cat.type || 'product',
            is_active: cat.is_active,
        })
        setCatModal(true)
    }

    const handleSaveCat = async () => {
        setSaving(true)
        const res = editingCat
            ? await dispatch(updateCategory({ id: editingCat._id, data: catForm }))
            : await dispatch(createCategory(catForm))
        setSaving(false)
        if (!res.error) setCatModal(false)
    }

    const handleSaveSub = async form => {
        const { category, editingSub } = subModal
        const res = editingSub
            ? await dispatch(updateSubcategory({ categoryId: category._id, subId: editingSub._id, data: form }))
            : await dispatch(addSubcategory({ categoryId: category._id, data: form }))
        if (!res.error) setSubModal(null)
    }

    const setCF = k => e => setCatForm(p => ({ ...p, [k]: e.target.value }))

    // ── Local Autocomplete Logic ───────────────────────────────────────────
    const [showSuggest, setShowSuggest] = useState(false)
    const suggestRef = useRef(null)

    const suggestions = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (q.length < 2) return []
        return (categories || [])
            .filter(c => {
                const subMatch = c.subcategories?.some(s =>
                    s.name?.toLowerCase().includes(q) ||
                    s.subcategory_code?.toLowerCase().includes(q)
                )
                return c.name?.toLowerCase().includes(q) || c.category_code?.toLowerCase().includes(q) || subMatch
            })
            .slice(0, 8)
    }, [categories, search])

    useEffect(() => {
        const clickOut = (e) => {
            if (suggestRef.current && !suggestRef.current.contains(e.target)) setShowSuggest(false)
        }
        document.addEventListener('mousedown', clickOut)
        return () => document.removeEventListener('mousedown', clickOut)
    }, [])

    const handleSelect = (name) => {
        setSearch(name)
        setShowSuggest(false)
    }

    return (
        <div className="p-4 sm:p-6 space-y-4">
            <PageHeader
                title="Categories"
                subtitle="Manage product & service hierarchies"
                action={
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setBulkOpen(true)}>Bulk Upload</Button>
                        <Button variant="primary" onClick={openAddCat}>+ Add Category</Button>
                    </div>
                }
            />

            {/* Polling banner — always visible when active */}
            <PollBanner status={pollStatus} onDismiss={() => setPollStatus(null)} />

            {/* Filter Bar */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm transition-all">
                <div className="p-3 flex flex-wrap gap-3 items-center">
                    <div className="relative flex-1 min-w-[240px]" ref={suggestRef}>
                        <input
                            type="text"
                            placeholder="Search by category name or code..."
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-0 focus:outline-none transition-all"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setShowSuggest(true) }}
                            onFocus={() => setShowSuggest(true)}
                        />
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                        </svg>

                        {/* Suggestions Dropdown */}
                        {showSuggest && search.length >= 2 && (
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
                                                <span className="font-medium truncate">{s.name}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{s.category_code}</span>
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-4 py-3 text-xs text-gray-400 italic bg-gray-50/50">
                                        No categories found for "{search}"
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <select
                            className="bg-gray-50 border-none rounded-lg px-3 py-2 text-sm focus:ring-0 focus:outline-none cursor-pointer font-medium text-gray-700"
                            value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                        >
                            <option value="all">All Types</option>
                            <option value="product">Products Only</option>
                            <option value="service">Services Only</option>
                        </select>
                        <div className="h-4 w-[1px] bg-gray-200 mx-1" />
                        <p className="text-sm font-medium text-gray-500 whitespace-nowrap">
                            <span className="text-primary-600">{filtered.length}</span> results
                        </p>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="w-8 px-4 py-3" />
                            <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Code</th>
                            <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Name</th>
                            <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Slug</th>
                            <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Type</th>
                            <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">Subs</th>
                            <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sort</th>
                            <th className="px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={9} className="text-center py-16 text-sm text-gray-400 animate-pulse">Loading...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={9} className="text-center py-16 text-sm text-gray-400">No categories found.</td></tr>
                        ) : (
                            filtered.map(cat => (
                                <CategoryRow
                                    key={cat._id}
                                    cat={cat}
                                    onEdit={openEditCat}
                                    onAddSub={c => setSubModal({ category: c })}
                                    onEditSub={(c, sub) => setSubModal({ category: c, editingSub: sub })}
                                />
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <BulkUploadModal
                open={bulkOpen}
                onClose={() => setBulkOpen(false)}
                title="Bulk Upload Categories"
                schemaFields={SCHEMA_FIELDS}
                fieldValidators={FIELD_VALIDATORS}
                onUpload={handleBulkUpload}
                downloadCSVTemplate={downloadCSVTemplate}
                onDone={() => dispatch(fetchCategories())}
            />

            <Modal open={catModal} onClose={() => setCatModal(false)} title={editingCat ? 'Edit Category' : 'Add Category'} size="md">
                <div className="grid grid-cols-2 gap-3 py-2">
                    <Input label="Code *" value={catForm.category_code} onChange={setCF('category_code')} placeholder="C001" />
                    <Input label="Name *" value={catForm.name} onChange={e => setCatForm(p => ({ ...p, name: e.target.value, slug: toSlug(e.target.value) }))} placeholder="e.g. Dairy" />
                    <Input label="Slug *" value={catForm.slug} onChange={setCF('slug')} />
                    <Input label="Title" value={catForm.title} onChange={setCF('title')} />
                    <Input label="Sort Order" type="number" value={catForm.sortOrder} onChange={setCF('sortOrder')} />
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Type *</label>
                        <select className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={catForm.type} onChange={setCF('type')}>
                            <option value="product">Product</option>
                            <option value="service">Service</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</label>
                        <select className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={String(catForm.is_active)} onChange={e => setCatForm(p => ({ ...p, is_active: e.target.value === 'true' }))}>
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                        </select>
                    </div>
                    <div className="col-span-2">
                        <Input label="Image URL" value={catForm.image} onChange={setCF('image')} placeholder="https://..." />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                    <Button variant="secondary" onClick={() => setCatModal(false)}>Cancel</Button>
                    <Button variant="primary" onClick={handleSaveCat} loading={saving}>Save</Button>
                </div>
            </Modal>

            {subModal && (
                <SubModal
                    open
                    category={subModal.category}
                    editingSub={subModal.editingSub}
                    onClose={() => setSubModal(null)}
                    onSave={handleSaveSub}
                />
            )}
        </div>
    )
}