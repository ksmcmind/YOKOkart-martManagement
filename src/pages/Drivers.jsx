// src/pages/Drivers.jsx
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    fetchDrivers, createDriver, updateDriver, toggleDriverStatus,
    selectAllDrivers, selectDriversLoading, selectDriversError,
    clearDriverError,
} from '../store/slices/driverSlice'
import { fetchMarts, selectAllMarts } from '../store/slices/martSlice'
import { showToast } from '../store/slices/uiSlice'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Grid from '../components/Grid'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Input, { Select } from '../components/Input'
import ImageUpload from '../components/ImageUpload'
import MartSelector from '../pages/MartSelector'
import useMart from '../hooks/useMart'

const INITIAL = {
    name: '', phone: '', email: '', vehicleType: 'bike',
    vehicleNumber: '', licenseNumber: '', mongoMartId: '',
    profileImageFile: null, licenceImageFile: null, panImageFile: null, aadhaarImageFile: null,
}

const toBase64 = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
    })

export default function Drivers() {
    const dispatch = useDispatch()
    const marts = useSelector(selectAllMarts)
    const drivers = useSelector(selectAllDrivers)
    const loading = useSelector(selectDriversLoading)
    const error = useSelector(selectDriversError)
    const { activeMartId, selectorProps } = useMart()

    const [open, setOpen] = useState(false)
    const [editingDriver, setEditingDriver] = useState(null)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState(INITIAL)

    useEffect(() => { dispatch(fetchMarts()) }, [dispatch])
    useEffect(() => {
        if (activeMartId) dispatch(fetchDrivers(activeMartId))
    }, [activeMartId, dispatch])

    useEffect(() => {
        if (error) {
            dispatch(showToast({ message: error, type: 'error' }))
            dispatch(clearDriverError())
        }
    }, [error, dispatch])

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    const handleSave = async () => {
        if (!form.name || !form.phone || !form.mongoMartId) {
            dispatch(showToast({ message: 'Name, phone and mart required', type: 'error' })); return
        }

        // All docs mandatory for new drivers
        if (!editingDriver) {
            if (!form.profileImageFile || !form.licenceImageFile || !form.panImageFile || !form.aadhaarImageFile) {
                dispatch(showToast({ message: 'All documents (Photo, Licence, PAN, Aadhaar) are mandatory for new drivers', type: 'error' })); return
            }
        }

        setSaving(true)
        try {
            const [profileImage, licenceImage, panImage, aadhaarImage] = await Promise.all([
                form.profileImageFile ? toBase64(form.profileImageFile) : Promise.resolve(null),
                form.licenceImageFile ? toBase64(form.licenceImageFile) : Promise.resolve(null),
                form.panImageFile ? toBase64(form.panImageFile) : Promise.resolve(null),
                form.aadhaarImageFile ? toBase64(form.aadhaarImageFile) : Promise.resolve(null),
            ])

            const payload = {
                name: form.name,
                phone: form.phone,
                email: form.email || undefined,
                vehicleType: form.vehicleType,
                vehicleNumber: form.vehicleNumber || undefined,
                licenseNumber: form.licenseNumber || undefined,
                mongoMartId: form.mongoMartId,
                ...(profileImage && { profileImage }),
                ...(licenceImage && { licenceImage }),
                ...(panImage && { panImage }),
                ...(aadhaarImage && { aadhaarImage }),
            }

            const action = editingDriver ? updateDriver({ id: editingDriver.id, data: payload }) : createDriver(payload)
            const res = await dispatch(action)
            if (!res.error) {
                dispatch(showToast({ message: editingDriver ? 'Driver updated!' : 'Driver created!', type: 'success' }))
                setOpen(false); setForm(INITIAL); setEditingDriver(null)
            }
        } catch (err) {
            dispatch(showToast({ message: err.message, type: 'error' }))
        } finally {
            setSaving(false)
        }
    }

    const DocLink = ({ url, label }) => url
        ? <a href={url} target="_blank" rel="noreferrer" className="bg-gray-100 hover:bg-gray-200 text-[9px] text-gray-600 px-1.5 py-0.5 rounded font-bold uppercase transition-colors border border-gray-200">{label}</a>
        : null

    const columns = [
        {
            key: 'name', label: 'Driver',
            render: r => (
                <div className="flex items-center gap-2 py-1">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden shrink-0 border border-primary-200">
                        {r.profileImgUrl ? <img src={r.profileImgUrl} className="w-full h-full object-cover" alt="" /> : <span className="text-xs">👤</span>}
                    </div>
                    <div className="leading-tight">
                        <p className="text-xs font-bold text-gray-900">{r.name}</p>
                        <p className="text-[10px] text-gray-500 font-mono">{r.phone}</p>
                    </div>
                </div>
            )
        },
        {
            key: 'vehicle', label: 'Vehicle',
            render: r => (
                <div className="text-[10px] leading-tight">
                    <p className="uppercase font-black text-gray-700 tracking-tighter">{r.vehicleType}</p>
                    <p className="text-gray-400 font-mono">{r.vehicleNumber || '—'}</p>
                </div>
            )
        },
        {
            key: 'status', label: 'Status',
            render: r => <Badge variant={r.status === 'available' ? 'green' : 'gray'} size="xs">{r.status?.toUpperCase() || 'OFFLINE'}</Badge>
        },
        { key: 'orders', label: 'Orders', render: r => <span className="text-xs font-bold text-gray-700">{r.totalDeliveries || 0}</span> },
        { key: 'earnings', label: 'Earnings', render: r => <span className="text-xs font-bold text-green-600">₹{r.totalEarnings || 0}</span> },
        {
            key: 'documents', label: 'Docs',
            render: r => (
                <div className="flex gap-1 flex-wrap">
                    <DocLink url={r.licenseImgUrl} label="Lic" />
                    <DocLink url={r.kycDocs?.pan} label="PAN" />
                    <DocLink url={r.kycDocs?.aadhaar} label="AAD" />
                </div>
            )
        },
        {
            key: 'actions', label: '',
            render: r => (
                <div className="flex justify-end gap-2">
                    <button onClick={() => { setEditingDriver(r); setForm({ ...r, mongoMartId: r.mongoMartId || activeMartId || '', profileImageFile: null, licenceImageFile: null, panImageFile: null, aadhaarImageFile: null }); setOpen(true) }} className="text-[10px] text-gray-600 font-black hover:bg-gray-100 px-2 py-1 rounded transition-colors uppercase tracking-tighter">Edit</button>
                    <button onClick={() => dispatch(toggleDriverStatus(r.id))} className={`text-[10px] font-black px-2 py-1 rounded transition-colors uppercase tracking-tighter ${r.isActive ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
                        {r.isActive ? 'Disable' : 'Enable'}
                    </button>
                </div>
            )
        }
    ]

    return (
        <div className="p-4 sm:p-6 space-y-4">
            <PageHeader
                title="Drivers"
                subtitle="Manage delivery fleet"
                action={
                    <div className="flex gap-3">
                        <MartSelector {...selectorProps} />
                        <Button variant="primary" onClick={() => { setEditingDriver(null); setForm(INITIAL); setOpen(true) }}>+ Add Driver</Button>
                    </div>
                }
            />

            <Grid
                columns={columns}
                data={drivers}
                loading={loading}
                emptyText={activeMartId ? "No drivers found" : "Select a mart first"}
                searchKey="name"
            />

            <Modal open={open} onClose={() => { setOpen(false); setEditingDriver(null); setForm(INITIAL); }}
                title={editingDriver ? `Edit Driver: ${editingDriver.name}` : "Add New Driver"} size="lg"
                footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={handleSave}>{editingDriver ? 'Update Driver' : 'Create Driver'}</Button></>}>
                <div className="space-y-8">
                    <section className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                        <h4 className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-4 h-4 bg-primary-100 rounded-full flex items-center justify-center text-[8px]">1</span>
                            Basic Information
                        </h4>
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="shrink-0">
                                <ImageUpload label="Profile Photo *" value={form.profileImageFile} onChange={file => set('profileImageFile', file)} />
                            </div>
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Full Name *" placeholder="e.g. Ravi Kumar" value={form.name} onChange={e => set('name', e.target.value)} />
                                <Input label="Phone Number *" placeholder="10-digit number" value={form.phone} onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} />
                                <Input label="Email Address" placeholder="e.g. ravi@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
                                <Select label="Assign to Mart *" value={form.mongoMartId} onChange={e => set('mongoMartId', e.target.value)}>
                                    <option value="">Select Mart</option>
                                    {marts.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </Select>
                            </div>
                        </div>
                    </section>

                    <section className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                        <h4 className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-4 h-4 bg-primary-100 rounded-full flex items-center justify-center text-[8px]">2</span>
                            Vehicle Details
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Select label="Vehicle Type *" value={form.vehicleType} onChange={e => set('vehicleType', e.target.value)}>
                                {['bike', 'scooter', 'cycle', 'van'].map(v => (
                                    <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                                ))}
                            </Select>
                            <Input label="Vehicle Number" placeholder="AP 31 AB 1234" value={form.vehicleNumber} onChange={e => set('vehicleNumber', e.target.value)} />
                            <Input label="License Number" placeholder="DL-..." value={form.licenseNumber} onChange={e => set('licenseNumber', e.target.value)} />
                        </div>
                    </section>

                    <section className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-4 h-4 bg-gray-200 rounded-full flex items-center justify-center text-[8px]">3</span>
                            Verification Documents
                        </h4>
                        {!editingDriver && <p className="text-[10px] text-red-500 mb-4 font-black tracking-tighter">* PHOTO, LICENCE, PAN, AND AADHAAR ARE ALL REQUIRED</p>}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <ImageUpload label="Driving Licence *" value={form.licenceImageFile} onChange={file => set('licenceImageFile', file)} />
                            <ImageUpload label="PAN Card *" value={form.panImageFile} onChange={file => set('panImageFile', file)} />
                            <ImageUpload label="Aadhaar Card *" value={form.aadhaarImageFile} onChange={file => set('aadhaarImageFile', file)} />
                        </div>
                    </section>
                </div>
            </Modal>
        </div>
    )
}