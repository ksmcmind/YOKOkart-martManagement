// src/pages/Categories.jsx
// Categories with create + edit + bulk upload (CSV + XLSX)
//
// Mandatory fields:
//   CATEGORY:    category_code, name, slug, title, type
//   SUBCATEGORY: subcategory_code, name, slug, title
// Optional:
//   image, icon (emoji)

import { useEffect, useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    fetchCategories, createCategory, updateCategory, deleteCategory,
    addSubcategory, updateSubcategory, deleteSubcategory,
    bulkUploadCategories,
    selectAllCategories, selectCategoryLoading,
} from '../store/slices/categorySlice'
import { showToast } from '../store/slices/uiSlice'
import * as XLSX from 'xlsx'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Modal from '../components/Modal'
import Input from '../components/Input'
import ImageInput from '../components/ImageInput'

const CAT_INIT = {
    category_code: '',
    name: '',
    slug: '',
    title: '',
    icon: '',
    image: '',
    sortOrder: '0',
    type: 'product',
    is_active: true,
}

const SUB_INIT = {
    subcategory_code: '',
    name: '',
    slug: '',
    title: '',
    icon: '',
    image: '',
    is_active: true,
}

// Slug generator (only used when user clicks Auto-fill button)
const genSlug = (s) =>
    (s || '').toLowerCase().trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')



// Add this component ABOVE your Categories component — not inside it

const CategoryCard = ({ cat, openEditCat, openAddSub, handleDeleteCat, openEditSub, handleDeleteSub }) => {
    const [open, setOpen] = useState(false);
    const subCount = cat.subcategories?.length || 0;

    return (
        <div key={cat._id || cat.id} className="card">

            {/* ── Header ── */}
            <div
                className="card-header cursor-pointer select-none"
                onClick={() => setOpen(o => !o)}
            >
                <div className="flex items-center gap-3 flex-1">
                    <svg
                        className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
                        viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
                    >
                        <polyline points="5,3 11,8 5,13" />
                    </svg>
                    {cat.image || cat.image_url
                        ? <img src={cat.image || cat.image_url} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" alt="" />
                        : <span className="text-2xl flex-shrink-0">{cat.icon || '📦'}</span>
                    }
                    <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900">{cat.name}</p>
                            {cat.category_code && (
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded font-mono font-medium">
                                    {cat.category_code}
                                </span>
                            )}
                            {cat.type === 'service' && (
                                <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded font-medium">
                                    Service
                                </span>
                            )}
                            {cat.is_active === false && (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded font-medium">
                                    Inactive
                                </span>
                            )}
                            {subCount > 0 && (
                                <span className="text-[11px] text-gray-400">
                                    {subCount} sub{subCount > 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-400">{cat.title || cat.subtitle}</p>
                        <p className="text-[10px] text-gray-300 font-mono">/{cat.slug}</p>
                    </div>
                </div>
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    <Button variant="secondary" size="sm" onClick={() => openEditCat(cat)}>✏️ Edit</Button>
                    <Button variant="secondary" size="sm" onClick={() => openAddSub(cat)}>+ Sub</Button>
                    {/* <Button variant="danger" size="sm" onClick={() => handleDeleteCat(cat)}>🗑️</Button> */}
                </div>
            </div>

            {/* ── Subcategories panel ── */}
            {open && (
                <div className="border-t border-gray-100 px-5 pt-3 pb-4">
                    {subCount === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-2">No subcategories yet</p>
                    ) : (
                        <div className="flex flex-col gap-2 mb-3">
                            {cat.subcategories.map(sub => (
                                <div
                                    key={sub._id || sub.id}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm
                    ${sub.is_active === false
                                            ? 'bg-gray-50 border-gray-200 opacity-50'
                                            : 'bg-gray-50 border-gray-100'
                                        }`}
                                >
                                    <div className="w-6 h-6 rounded flex items-center justify-center bg-white border border-gray-100 flex-shrink-0 overflow-hidden text-sm">
                                        {sub.image || sub.image_url
                                            ? <img src={sub.image || sub.image_url} className="w-6 h-6 object-cover" alt="" />
                                            : (sub.icon || '📦')
                                        }
                                    </div>
                                    <span className="font-medium text-gray-700 flex-1">{sub.name}</span>
                                    {sub.subtitle && (
                                        <span className="text-xs text-gray-400 hidden sm:inline">{sub.subtitle}</span>
                                    )}
                                    {sub.subcategory_code && (
                                        <span className="font-mono text-[10px] text-blue-500">{sub.subcategory_code}</span>
                                    )}
                                    {sub.is_active === false && (
                                        <span className="px-1.5 py-0.5 bg-gray-200 text-gray-500 text-[10px] rounded">Inactive</span>
                                    )}
                                    <button onClick={() => openEditSub(cat, sub)} className="text-blue-400 hover:text-blue-600 ml-1">✏️</button>
                                    {/* <button onClick={() => handleDeleteSub(cat, sub)} className="text-red-400 hover:text-red-600">✕</button> */}
                                </div>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={() => openAddSub(cat)}
                        className="w-full text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg py-2 hover:bg-gray-50 hover:text-gray-600 transition-colors"
                    >
                        + Add subcategory
                    </button>
                </div>
            )}
        </div>
    );
};


export default function Categories() {
    const dispatch = useDispatch()
    const categories = useSelector(selectAllCategories)
    const loading = useSelector(selectCategoryLoading)

    // Modal states
    const [catModal, setCatModal] = useState(false)
    const [subModal, setSubModal] = useState(null)
    const [bulkModal, setBulkModal] = useState(false)

    // Edit tracking
    const [editingCat, setEditingCat] = useState(null)
    const [editingSub, setEditingSub] = useState(null)

    // Forms
    const [catForm, setCatForm] = useState(CAT_INIT)
    const [subForm, setSubForm] = useState(SUB_INIT)
    const [saving, setSaving] = useState(false)

    // Bulk
    const [bulkRows, setBulkRows] = useState([])
    const [bulkProgress, setBulkProgress] = useState(null)
    const fileRef = useRef()

    useEffect(() => {
        dispatch(fetchCategories())
    }, [dispatch])

    const setC = (k, v) => setCatForm(f => ({ ...f, [k]: v }))
    const setS = (k, v) => setSubForm(f => ({ ...f, [k]: v }))

    // ── Validate required fields ────────────────────────────────
    const validateCat = () => {
        const missing = []
        if (!catForm.category_code) missing.push('Category Code')
        if (!catForm.name) missing.push('Name')
        if (!catForm.slug) missing.push('Slug')
        if (!catForm.title) missing.push('Title')
        if (!catForm.type) missing.push('Type')
        return missing
    }

    const validateSub = () => {
        const missing = []
        if (!subForm.subcategory_code) missing.push('Subcategory Code')
        if (!subForm.name) missing.push('Name')
        if (!subForm.slug) missing.push('Slug')
        if (!subForm.title) missing.push('Title')
        return missing
    }

    // ── Open add/edit category ──────────────────────────────────
    const openAddCat = () => {
        setEditingCat(null)
        setCatForm(CAT_INIT)
        setCatModal(true)
    }

    const openEditCat = (cat) => {
        setEditingCat(cat)
        setCatForm({
            category_code: cat.category_code || '',
            name: cat.name || '',
            slug: cat.slug || '',
            title: cat.title || cat.subtitle || '',
            icon: cat.icon || '',
            image: cat.image || cat.image_url || '',
            sortOrder: String(cat.sortOrder || cat.sort_order || 0),
            type: cat.type || 'product',
            is_active: cat.is_active !== false,
        })
        setCatModal(true)
    }

    // ── Save category ───────────────────────────────────────────
    const handleSaveCat = async () => {
        const missing = validateCat()
        if (missing.length) {
            return dispatch(showToast({
                message: `Required: ${missing.join(', ')}`,
                type: 'error',
            }))
        }

        setSaving(true)
        const payload = {
            ...catForm,
            sortOrder: parseInt(catForm.sortOrder) || 0,
        }

        let res
        if (editingCat) {
            res = await dispatch(updateCategory({
                id: editingCat._id || editingCat.id,
                data: payload,
            }))
        } else {
            res = await dispatch(createCategory(payload))
        }
        setSaving(false)

        if (!res.error) {
            dispatch(showToast({
                message: editingCat ? 'Category updated!' : 'Category created!',
                type: 'success',
            }))
            setCatModal(false)
            setCatForm(CAT_INIT)
            setEditingCat(null)
        } else {
            dispatch(showToast({ message: res.payload || 'Failed', type: 'error' }))
        }
    }

    const handleDeleteCat = async (cat) => {
        if (!window.confirm(`Delete category "${cat.name}"? This also deletes all subcategories.`)) return
        const res = await dispatch(deleteCategory(cat._id || cat.id))
        if (!res.error) dispatch(showToast({ message: 'Category deleted', type: 'success' }))
        else dispatch(showToast({ message: res.payload || 'Failed', type: 'error' }))
    }

    // ── Open add/edit subcategory ───────────────────────────────
    const openAddSub = (cat) => {
        setEditingSub(null)
        setSubForm(SUB_INIT)
        setSubModal({ category: cat })
    }

    const openEditSub = (cat, sub) => {
        setEditingSub({ catId: cat._id || cat.id, sub })
        setSubForm({
            subcategory_code: sub.subcategory_code || '',
            name: sub.name || '',
            slug: sub.slug || '',
            title: sub.title || sub.subtitle || '',
            icon: sub.icon || '',
            image: sub.image || sub.image_url || '',
            is_active: sub.is_active !== false,
        })
        setSubModal({ category: cat })
    }

    const handleSaveSub = async () => {
        const missing = validateSub()
        if (missing.length) {
            return dispatch(showToast({
                message: `Required: ${missing.join(', ')}`,
                type: 'error',
            }))
        }

        setSaving(true)
        const payload = { ...subForm }

        let res
        if (editingSub) {
            res = await dispatch(updateSubcategory({
                categoryId: editingSub.catId,
                subId: editingSub.sub._id || editingSub.sub.id,
                data: payload,
            }))
        } else {
            res = await dispatch(addSubcategory({
                categoryId: subModal.category._id || subModal.category.id,
                data: payload,
            }))
        }
        setSaving(false)

        if (!res.error) {
            dispatch(showToast({
                message: editingSub ? 'Subcategory updated!' : 'Subcategory added!',
                type: 'success',
            }))
            setSubModal(null)
            setSubForm(SUB_INIT)
            setEditingSub(null)
        } else {
            dispatch(showToast({ message: res.payload || 'Failed', type: 'error' }))
        }
    }

    const handleDeleteSub = async (cat, sub) => {
        if (!window.confirm(`Delete subcategory "${sub.name}"?`)) return
        const res = await dispatch(deleteSubcategory({
            categoryId: cat._id || cat.id,
            subId: sub._id || sub.id,
        }))
        if (!res.error) dispatch(showToast({ message: 'Subcategory deleted', type: 'success' }))
    }

    // ── File parsing (CSV or XLSX) ──────────────────────────────
    const handleFile = async (file) => {
        if (!file) return
        const name = file.name.toLowerCase()

        try {
            let rows = []

            if (name.endsWith('.csv')) {
                const text = await file.text()
                const lines = text.trim().split(/\r?\n/)
                const hdrs = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
                rows = lines.slice(1).map(line => {
                    const vals = line.split(',').map(v => v.trim().replace(/"/g, ''))
                    const row = {}
                    hdrs.forEach((h, i) => row[h] = vals[i] || '')
                    return row
                })
            } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
                const buf = await file.arrayBuffer()
                const wb = XLSX.read(buf, { type: 'array' })
                const ws = wb.Sheets[wb.SheetNames[0]]
                rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
            } else {
                dispatch(showToast({ message: 'Only CSV and XLSX files supported', type: 'error' }))
                return
            }

            // Normalize keys & filter empty rows (must have category_code at minimum)
            rows = rows
                .map(r => {
                    const clean = {}
                    Object.keys(r).forEach(k => clean[k.trim()] = String(r[k] ?? '').trim())
                    return clean
                })
                .filter(r => r.category_code)

            setBulkRows(rows)
            dispatch(showToast({ message: `${rows.length} rows loaded`, type: 'success' }))
        } catch (err) {
            dispatch(showToast({ message: `Failed to parse file: ${err.message}`, type: 'error' }))
        }
    }

    // ── Bulk upload — SEND ALL IN ONE REQUEST ──────────────────
    const handleBulkUpload = async () => {
        if (!bulkRows.length) return

        setBulkProgress({ total: bulkRows.length, done: 0 })

        const res = await dispatch(bulkUploadCategories(bulkRows))

        setBulkProgress({ total: bulkRows.length, done: bulkRows.length })

        if (res.error) {
            dispatch(showToast({
                message: res.payload || 'Bulk upload failed',
                type: 'error',
            }))
        } else {
            const d = res.payload
            dispatch(showToast({
                message: `✅ ${d.createdCategories} new categories, ${d.createdSubcategories} subcategories${d.errors?.length ? ` (${d.errors.length} errors)` : ''}`,
                type: d.errors?.length ? 'warning' : 'success',
            }))
            if (d.errors?.length) console.error('Bulk upload errors:', d.errors)
        }

        setBulkModal(false)
        setBulkRows([])
        setBulkProgress(null)
        dispatch(fetchCategories())
    }

    // ── Download CSV template ───────────────────────────────────
    const downloadTemplate = () => {
        const headers = [
            'category_code', 'category_name', 'category_slug', 'category_title',
            'category_icon', 'category_image_url', 'type', 'sort_order',
            'subcategory_code', 'subcategory_name', 'subcategory_slug', 'subcategory_title',
            'subcategory_icon', 'subcategory_image_url',
        ]
        const sample = [
            headers.join(','),
            // Same category repeated for multiple subcategories
            'CAT-00001,Grocery,grocery,Daily Essentials,🛒,,product,1,SUB-00001,Atta & Rice,atta-rice,Flour & Rice,🌾,',
            'CAT-00001,Grocery,grocery,Daily Essentials,🛒,,product,1,SUB-00002,Oil & Masala,oil-masala,Cooking Oils,🫙,',
            'CAT-00001,Grocery,grocery,Daily Essentials,🛒,,product,1,SUB-00003,Dairy & Bread,dairy-bread,Fresh Dairy,🥛,',
            // New category with 2 subcategories
            'CAT-00002,Summer,summer,Cooling Essentials,☀️,,product,2,SUB-00004,Cold Drinks,cold-drinks,Beverages,🥤,',
            'CAT-00002,Summer,summer,Cooling Essentials,☀️,,product,2,SUB-00005,Ice Cream,ice-cream,Frozen Treats,🍦,',
            // Service category example
            'CAT-00003,Medical,medical,Doctor Consultation,👨‍⚕️,,service,3,SUB-00006,General Physician,general-physician,Family Doctor,🩺,',
        ]
        const blob = new Blob([sample.join('\n')], { type: 'text/csv' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'categories_template.csv'
        a.click()
    }

    return (
        <div>
            <PageHeader
                title="Categories"
                subtitle="Manage product and service categories"
                action={
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setBulkModal(true)}>📤 Bulk Upload</Button>
                        <Button variant="primary" onClick={openAddCat}>+ Add Category</Button>
                    </div>
                }
            />

            {categories.map(cat => (
                <CategoryCard
                    key={cat._id || cat.id}
                    cat={cat}
                    openEditCat={openEditCat}
                    openAddSub={openAddSub}
                    handleDeleteCat={handleDeleteCat}
                    openEditSub={openEditSub}
                    handleDeleteSub={handleDeleteSub}
                />
            ))}
            {/* ─── Add/Edit Category Modal ──────────────────────────── */}
            <Modal
                title={editingCat ? `Edit "${editingCat.name}"` : 'Add Category'}
                open={catModal}
                onClose={() => { setCatModal(false); setEditingCat(null); setCatForm(CAT_INIT) }}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => { setCatModal(false); setEditingCat(null); setCatForm(CAT_INIT) }}>
                            Cancel
                        </Button>
                        <Button variant="primary" loading={saving} onClick={handleSaveCat}>
                            {editingCat ? 'Save Changes' : 'Create'}
                        </Button>
                    </>
                }
            >
                <ImageInput
                    label="Category Image URL (optional)"
                    value={catForm.image}
                    onChange={url => setC('image', url)}
                    placeholder="https://storage.googleapis.com/..."
                />

                <div className="form-grid-2">
                    <Input
                        label="Category Code *"
                        required
                        value={catForm.category_code}
                        onChange={e => setC('category_code', e.target.value.toUpperCase())}
                        placeholder="CAT-00001"
                        disabled={!!editingCat}
                    />
                    <Input
                        label="Name *"
                        required
                        value={catForm.name}
                        onChange={e => setC('name', e.target.value)}
                        placeholder="Grocery"
                    />
                    <Input
                        label={
                            <span>
                                Slug *
                                {catForm.name && !catForm.slug && (
                                    <button
                                        type="button"
                                        onClick={() => setC('slug', genSlug(catForm.name))}
                                        className="ml-2 text-[10px] text-blue-500 hover:underline"
                                    >
                                        Auto-fill
                                    </button>
                                )}
                            </span>
                        }
                        required
                        value={catForm.slug}
                        onChange={e => setC('slug', e.target.value)}
                        placeholder="grocery"
                    />
                    <Input
                        label="Title *"
                        required
                        value={catForm.title}
                        onChange={e => setC('title', e.target.value)}
                        placeholder="Daily Essentials"
                    />
                    <Input
                        label="Icon (emoji, optional)"
                        value={catForm.icon}
                        onChange={e => setC('icon', e.target.value)}
                        placeholder="🛒"
                    />
                    <Input
                        label="Sort Order"
                        type="number"
                        value={catForm.sortOrder}
                        onChange={e => setC('sortOrder', e.target.value)}
                    />
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Type *</label>
                        <select
                            value={catForm.type}
                            onChange={e => setC('type', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-500"
                        >
                            <option value="product">Product</option>
                            <option value="service">Service</option>
                        </select>
                    </div>
                </div>

                <label className="flex items-center gap-2 mt-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={catForm.is_active}
                        onChange={e => setC('is_active', e.target.checked)}
                        className="w-4 h-4 accent-primary-500"
                    />
                    <span className="text-sm text-gray-600">
                        Active <span className="text-xs text-gray-400">(visible to customers)</span>
                    </span>
                </label>
            </Modal>

            {/* ─── Add/Edit Subcategory Modal ───────────────────────── */}
            <Modal
                title={editingSub ? `Edit "${editingSub.sub.name}"` : `Add Subcategory to "${subModal?.category?.name}"`}
                open={!!subModal}
                onClose={() => { setSubModal(null); setEditingSub(null); setSubForm(SUB_INIT) }}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => { setSubModal(null); setEditingSub(null); setSubForm(SUB_INIT) }}>
                            Cancel
                        </Button>
                        <Button variant="primary" loading={saving} onClick={handleSaveSub}>
                            {editingSub ? 'Save Changes' : 'Add'}
                        </Button>
                    </>
                }
            >
                <ImageInput
                    label="Subcategory Image URL (optional)"
                    value={subForm.image}
                    onChange={url => setS('image', url)}
                    placeholder="https://storage.googleapis.com/..."
                />

                <div className="form-grid-2">
                    <Input
                        label="Subcategory Code *"
                        required
                        value={subForm.subcategory_code}
                        onChange={e => setS('subcategory_code', e.target.value.toUpperCase())}
                        placeholder="SUB-00001"
                        disabled={!!editingSub}
                    />
                    <Input
                        label="Name *"
                        required
                        value={subForm.name}
                        onChange={e => setS('name', e.target.value)}
                        placeholder="Atta & Rice"
                    />
                    <Input
                        label={
                            <span>
                                Slug *
                                {subForm.name && !subForm.slug && (
                                    <button
                                        type="button"
                                        onClick={() => setS('slug', genSlug(subForm.name))}
                                        className="ml-2 text-[10px] text-blue-500 hover:underline"
                                    >
                                        Auto-fill
                                    </button>
                                )}
                            </span>
                        }
                        required
                        value={subForm.slug}
                        onChange={e => setS('slug', e.target.value)}
                        placeholder="atta-rice"
                    />
                    <Input
                        label="Title *"
                        required
                        value={subForm.title}
                        onChange={e => setS('title', e.target.value)}
                        placeholder="Flour & Rice"
                    />
                    <Input
                        label="Icon (emoji, optional)"
                        value={subForm.icon}
                        onChange={e => setS('icon', e.target.value)}
                        placeholder="🌾"
                    />
                </div>

                <label className="flex items-center gap-2 mt-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={subForm.is_active}
                        onChange={e => setS('is_active', e.target.checked)}
                        className="w-4 h-4 accent-primary-500"
                    />
                    <span className="text-sm text-gray-600">Active</span>
                </label>
            </Modal>

            {/* ─── Bulk Upload Modal ────────────────────────────────── */}
            <Modal
                title="Bulk Upload Categories (CSV or XLSX)"
                open={bulkModal}
                onClose={() => { setBulkModal(false); setBulkRows([]) }}
                size="lg"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => { setBulkModal(false); setBulkRows([]) }}>
                            Cancel
                        </Button>
                        {bulkRows.length > 0 && (
                            <Button variant="primary" loading={!!bulkProgress} onClick={handleBulkUpload}>
                                Upload {bulkRows.length} rows
                            </Button>
                        )}
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="bg-primary-50 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex-1">
                            <p className="text-sm font-medium text-primary-700">📥 Download template</p>
                            <p className="text-xs text-primary-600 mt-1">
                                Required columns: category_code, category_name, category_slug, category_title, type, subcategory_code, subcategory_name, subcategory_slug, subcategory_title
                            </p>
                            <p className="text-xs text-primary-500 mt-0.5">
                                Optional: category_icon, category_image_url, sort_order, subcategory_icon, subcategory_image_url
                            </p>
                        </div>
                        <Button variant="secondary" size="sm" onClick={downloadTemplate}>⬇ CSV</Button>
                    </div>

                    <div
                        className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 transition-colors"
                        onClick={() => fileRef.current.click()}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
                    >
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            className="hidden"
                            onChange={e => handleFile(e.target.files[0])}
                        />
                        <div className="text-3xl mb-2">📂</div>
                        <p className="text-sm text-gray-600 font-medium">Drop CSV or XLSX file here</p>
                        <p className="text-xs text-gray-400 mt-1">or click to browse</p>
                    </div>

                    {bulkRows.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-3 max-h-60 overflow-y-auto">
                            <p className="text-xs font-medium text-gray-600 mb-2">{bulkRows.length} rows ready</p>
                            {bulkRows.slice(0, 6).map((r, i) => (
                                <div key={i} className="text-xs text-gray-500 py-1 border-b border-gray-100 last:border-0">
                                    <span className="font-mono text-blue-500">{r.category_code}</span>
                                    {' '}{r.category_icon} <strong>{r.category_name}</strong>
                                    {' → '}
                                    <span className="font-mono text-blue-500">{r.subcategory_code}</span>
                                    {' '}{r.subcategory_icon} {r.subcategory_name}
                                </div>
                            ))}
                            {bulkRows.length > 6 && <p className="text-xs text-gray-400 mt-1">...and {bulkRows.length - 6} more</p>}
                        </div>
                    )}

                    {bulkProgress && (
                        <div>
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                                <span>Uploading...</span>
                                <span>{bulkProgress.done} / {bulkProgress.total}</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary-500 rounded-full transition-all"
                                    style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    )
}