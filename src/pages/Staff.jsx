// src/pages/Staff.jsx
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    fetchStaff, createStaff, toggleStaffStatus,
    selectAllStaff, selectStaffLoading,
} from '../store/slices/staffSlice'
// import { fetchMarts, selectAllMarts } from '../store/slices/martSlice'
import { showToast } from '../store/slices/uiSlice'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Grid from '../components/Grid'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Input, { Select } from '../components/Input'
import ImageUpload from '../components/ImageUpload'
import { fetchMarts } from '../store/slices/martSlice'
import useAuth from '../hooks/useAuth'

const ROLES = [
    { value: 'mart_admin', label: 'Mart Admin' },
    { value: 'manager', label: 'Manager' },
    { value: 'dispatcher', label: 'Dispatcher' },
    { value: 'stock_manager', label: 'Stock Manager' },
    { value: 'cashier', label: 'Cashier' },
    { value: 'packing_staff', label: 'Packing Staff' },
    { value: 'accountant', label: 'Accountant' },
    { value: 'support', label: 'Support' },
]

const EMPTY = {
    name: '', phone: '', email: '', role: 'mart_admin',
    martId: '', basicSalary: '',
    profileImageFile: null, panImageFile: null, aadhaarImageFile: null,
}

const toBase64 = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
    })

export default function Staff() {
    const dispatch = useDispatch()
    const staff = useSelector(selectAllStaff)
    const loading = useSelector(selectStaffLoading)
    const marts = useSelector((state) => state.mart.list)

    const [open, setOpen] = useState(false)
    const [editingStaff, setEditingStaff] = useState(null)
    const [form, setForm] = useState(EMPTY)
    const [saving, setSaving] = useState(false)
    const [martFilter, setMartFilter] = useState('')

    const { martId: currentMartId } = useAuth()

    useEffect(() => {
        dispatch(fetchStaff(currentMartId || ''))
    }, [dispatch, currentMartId])

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    const handleEdit = (s) => {
        setEditingStaff(s)
        setForm({
            ...EMPTY,
            name: s.name,
            phone: s.phone,
            email: s.email || '',
            role: s.role,
            martId: s.martId || '', // Use martId for assignment
            basicSalary: String(s.basic_salary || ''),
        })
        setOpen(true)
    }

    const handleSave = async () => {
        if (!form.name || !form.phone) {
            dispatch(showToast({ message: 'Name and phone required', type: 'error' })); return
        }
        if (form.role !== 'super_admin' && !form.martId) {
            dispatch(showToast({ message: 'Mart required for this role', type: 'error' })); return
        }

        // Mandatory images for new staff
        if (!editingStaff && (!form.profileImageFile || !form.panImageFile || !form.aadhaarImageFile)) {
            dispatch(showToast({ message: 'Profile Photo, PAN Card, and Aadhaar Card are all mandatory', type: 'error' })); return
        }

        setSaving(true)
        try {
            const [profileImage, panImage, aadhaarImage] = await Promise.all([
                form.profileImageFile ? toBase64(form.profileImageFile) : Promise.resolve(null),
                form.panImageFile ? toBase64(form.panImageFile) : Promise.resolve(null),
                form.aadhaarImageFile ? toBase64(form.aadhaarImageFile) : Promise.resolve(null),
            ])

            const payload = {
                name: form.name,
                phone: form.phone,
                email: form.email,
                role: form.role,
                martId: form.martId || null,
                basicSalary: parseFloat(form.basicSalary) || 0,
                ...(profileImage && { profileImage }),
                ...(panImage && { panImage }),
                ...(aadhaarImage && { aadhaarImage }),
            }

            const action = editingStaff ? updateStaff({ id: editingStaff.id, data: payload }) : createStaff(payload)
            const res = await dispatch(action)

            if (!res.error) {
                dispatch(showToast({ message: editingStaff ? 'Staff updated!' : 'Staff created!', type: 'success' }))
                setOpen(false); setForm(EMPTY); setEditingStaff(null)
            }
        } catch (err) {
            dispatch(showToast({ message: err.message, type: 'error' }))
        } finally {
            setSaving(false)
        }
    }

    const columns = [
        {
            key: 'name', label: 'Staff',
            render: r => (
                <div className="flex items-center gap-2 py-1">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden shrink-0 border border-primary-200">
                        {r.profile_image ? <img src={r.profile_image} className="w-full h-full object-cover" alt="" /> : <span className="text-xs font-bold text-primary-600">{r.name?.charAt(0)?.toUpperCase()}</span>}
                    </div>
                    <div className="leading-tight">
                        <p className="text-xs font-bold text-gray-900">{r.name}</p>
                        <p className="text-[10px] text-gray-500 font-mono">{r.phone}</p>
                    </div>
                </div>
            )
        },
        { key: 'role', label: 'Role', render: r => <Badge variant="blue" size="xs">{r.role?.replace(/_/g, ' ').toUpperCase()}</Badge> },
        { key: 'status', label: 'Status', render: r => <Badge variant={r.is_active ? 'success' : 'gray'} size="xs">{r.is_active ? 'ACTIVE' : 'INACTIVE'}</Badge> },
        {
            key: 'mart', label: 'Mart',
            render: r => {
                if (!r.martId) return <span className="text-[9px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter border border-purple-100">Super Admin</span>
                const m = marts.find(m => m.id === r.martId || m.mongo_mart_id === r.martId)
                return <span className="text-[10px] text-gray-500 font-medium">{m?.name || '—'}</span>
            }
        },
        { key: 'salary', label: 'Salary', render: r => <span className="text-xs font-bold text-gray-700">₹{parseFloat(r.basic_salary || 0).toLocaleString()}</span> },
        {
            key: 'actions', label: '',
            render: r => (
                <div className="flex justify-end gap-2">
                    <button onClick={() => handleEdit(r)} className="text-[10px] text-gray-600 font-black hover:bg-gray-100 px-2 py-1 rounded transition-colors uppercase tracking-tighter">Edit</button>
                    <button onClick={() => dispatch(toggleStaffStatus(r.id))} className={`text-[10px] font-black px-2 py-1 rounded transition-colors uppercase tracking-tighter ${r.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
                        {r.is_active ? 'Disable' : 'Enable'}
                    </button>
                </div>
            )
        }
    ]

    const filtered = martFilter ? staff.filter(s => s.martId === martFilter) : staff

    return (
        <div className="p-4 sm:p-6 space-y-4">
            <PageHeader
                title="Staff"
                subtitle="Manage organization workforce"
                action={<Button variant="primary" onClick={() => { setForm({ ...EMPTY, martId: currentMartId || '' }); setEditingStaff(null); setOpen(true) }}>+ Add Staff Member</Button>}
            />

            <Grid
                columns={columns}
                data={filtered}
                loading={loading}
                searchKey="name"
                actions={
                    <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide max-w-xl">
                        {marts.map(m => (
                            <button key={m.id} onClick={() => setMartFilter(m.id)} className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors ${martFilter === m.id ? 'bg-primary-600 text-white shadow-md shadow-primary-200' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>{m.name.toUpperCase()}</button>
                        ))}
                    </div>
                }
            />

            <Modal open={open} onClose={() => { setOpen(false); setEditingStaff(null); setForm(EMPTY) }} title={editingStaff ? `Edit Staff: ${editingStaff.name}` : "Add Staff Member"} size="lg"
                footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={handleSave}>{editingStaff ? 'Update Staff' : 'Create Staff'}</Button></>}>
                <div className="space-y-8">
                    <section className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                        <h4 className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-4 h-4 bg-primary-100 rounded-full flex items-center justify-center text-[8px]">1</span>
                            Identity Details
                        </h4>
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="shrink-0">
                                <ImageUpload label="Profile Photo *" value={form.profileImageFile} onChange={file => set('profileImageFile', file)} />
                            </div>
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Full Name *" placeholder="Ravi Kumar" value={form.name} onChange={e => set('name', e.target.value)} />
                                <Input label="Phone *" placeholder="10-digit mobile" value={form.phone} onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} />
                                <Input label="Email Address" placeholder="ravi@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
                                <Input label="Basic Salary (₹)" type="number" placeholder="15000" value={form.basicSalary} onChange={e => set('basicSalary', e.target.value)} />
                            </div>
                        </div>
                    </section>

                    <section className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                        <h4 className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-4 h-4 bg-primary-100 rounded-full flex items-center justify-center text-[8px]">2</span>
                            Role & Assignment
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select label="System Role *" value={form.role} onChange={e => set('role', e.target.value)}>
                                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </Select>
                            {
                                marts?.map(m => (
                                    <Select key={m.id} label="Assign to Mart *" value={form.martId} onChange={e => set('martId', e.target.value)}>
                                        <option value="">Select Mart</option>
                                        <option value={m.id}>{m.name}</option>
                                    </Select>
                                ))
                            }
                        </div>
                    </section>

                    <section className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-4 h-4 bg-gray-200 rounded-full flex items-center justify-center text-[8px]">3</span>
                            KYC Verification
                        </h4>
                        {!editingStaff && <p className="text-[10px] text-red-500 mb-4 font-black tracking-tighter">* BOTH PAN AND AADHAAR ARE REQUIRED FOR REGISTRATION</p>}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <ImageUpload label="PAN Card *" value={form.panImageFile} onChange={file => set('panImageFile', file)} />
                            <ImageUpload label="Aadhaar Card *" value={form.aadhaarImageFile} onChange={file => set('aadhaarImageFile', file)} />
                        </div>
                    </section>
                </div>
            </Modal>
        </div>
    )
}