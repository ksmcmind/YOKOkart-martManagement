// src/pages/Staff.jsx — mart_admin only
import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { showToast } from '../store/slices/uiSlice'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Table from '../components/Table'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Input, { Select } from '../components/Input'
import useAuth from '../hooks/useAuth'
import api from '../api/index'

const ROLES = [
    { value: 'manager', label: 'Manager' },
    { value: 'dispatcher', label: 'Dispatcher' },
    { value: 'stock_manager', label: 'Stock Manager' },
    { value: 'packing_staff', label: 'Packing Staff' },
    { value: 'accountant', label: 'Accountant' },
    { value: 'support', label: 'Support' },
]

const EMPTY = { name: '', phone: '', role: 'manager', basicSalary: '' }

export default function Staff() {
    const dispatch = useDispatch()
    const { martId } = useAuth()

    const [staff, setStaff] = useState([])
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const [form, setForm] = useState(EMPTY)
    const [saving, setSaving] = useState(false)

    const load = () => {
        if (!martId) return
        setLoading(true)
        api.get(`/staff?martId=${martId}`).then(r => { setStaff(r.data || []); setLoading(false) })
    }

    useEffect(() => { load() }, [martId])

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    const handleCreate = async () => {
        if (!form.name || !form.phone) return dispatch(showToast({ message: 'Name and phone required', type: 'error' }))
        setSaving(true)
        const res = await api.post('/staff', { ...form, mongoMartId: martId })
        setSaving(false)
        if (res.success) {
            dispatch(showToast({ message: 'Staff added!', type: 'success' }))
            setOpen(false); setForm(EMPTY); load()
        } else {
            dispatch(showToast({ message: res.message || 'Failed', type: 'error' }))
        }
    }

    const handleToggle = async (id) => {
        await api.patch(`/staff/${id}/toggle`)
        dispatch(showToast({ message: 'Status updated', type: 'success' }))
        load()
    }

    const columns = [
        {
            key: 'name', label: 'Staff', render: r => (
                <div>
                    <p className="font-medium text-gray-900">{r.name}</p>
                    <p className="text-xs text-gray-400">{r.phone}</p>
                </div>
            )
        },
        { key: 'role', label: 'Role', render: r => <Badge variant="blue">{r.role?.replace(/_/g, ' ')}</Badge> },
        { key: 'is_active', label: 'Status', render: r => <Badge>{r.is_active ? 'active' : 'inactive'}</Badge> },
        { key: 'basic_salary', label: 'Salary', render: r => r.basic_salary ? `₹${r.basic_salary}` : '—' },
        {
            key: 'actions', label: 'Actions', render: r => (
                <Button variant={r.is_active ? 'danger' : 'primary'} size="sm" onClick={() => handleToggle(r.id)}>
                    {r.is_active ? 'Deactivate' : 'Activate'}
                </Button>
            )
        },
    ]

    return (
        <div>
            <PageHeader
                title="Staff"
                subtitle="Manage your mart staff"
                action={<Button variant="primary" onClick={() => { setForm(EMPTY); setOpen(true) }}>+ Add Staff</Button>}
            />
            <div className="card">
                <Table columns={columns} data={staff} loading={loading} emptyText="No staff added yet" />
            </div>
            <Modal title="Add Staff" open={open} onClose={() => setOpen(false)}
                footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={handleCreate}>Add</Button></>}
            >
                <div className="form-grid-2">
                    <Input label="Full Name" required value={form.name} onChange={e => set('name', e.target.value)} />
                    <Input label="Phone" required value={form.phone} onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210" />
                    <Select label="Role" required value={form.role} onChange={e => set('role', e.target.value)}>
                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </Select>
                    <Input label="Basic Salary (₹)" type="number" value={form.basicSalary} onChange={e => set('basicSalary', e.target.value)} />
                </div>
            </Modal>
        </div>
    )
}