// src/pages/Returns.jsx
import { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    fetchMartReturns,
    fetchReturnById,
    approveReturn,
    rejectReturn,
    selectReturnList,
    selectReturnLoading,
    selectReturnPagination,
    selectReturnStats,
    selectSelectedReturn,
    clearSelectedReturn,
} from '../store/slices/returnslice'
import { fetchMarts } from '../store/slices/martSlice'
import { showToast } from '../store/slices/uiSlice'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Table from '../components/Table'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import MartSelector from '../components/MartSelector'
import useMart from '../hooks/useMart'

// ── Constants ─────────────────────────────────────────────────
const STATUS_COLOR = {
    pending: 'yellow',
    approved: 'green',
    rejected: 'red',
    completed: 'blue',
}

const REASON_LABEL = {
    wrong_item: 'Wrong Item',
    damaged: 'Damaged',
    missing_item: 'Missing Item',
    expired: 'Expired',
    quality_issue: 'Quality Issue',
    changed_mind: 'Changed Mind',
}

const REFUND_METHODS = [
    { value: 'wallet', label: '👛 Wallet Credit' },
    { value: 'source', label: '💳 Refund to Source' },
    { value: 'exchange', label: '🔄 Exchange' },
    { value: 'none', label: '✗ No Refund' },
]

const fmtDate = (iso) =>
    !iso ? '—' : new Date(iso).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
    })

const fmtCurrency = (n) =>
    `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

// ── FilterBar ─────────────────────────────────────────────────
function FilterBar({ filters, onSearch, onReset, loading }) {
    const [draft, setDraft] = useState(filters)
    useEffect(() => setDraft(filters), [filters])
    const set = (k, v) => setDraft(f => ({ ...f, [k]: v }))

    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex gap-2 p-3 flex-wrap">
                <select
                    value={draft.status || ''}
                    onChange={e => set('status', e.target.value)}
                    className="text-xs border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 outline-none focus:border-green-500 min-w-[130px]"
                >
                    <option value="">All Statuses</option>
                    {['pending', 'approved', 'rejected', 'completed'].map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                </select>

                <select
                    value={draft.reason || ''}
                    onChange={e => set('reason', e.target.value)}
                    className="text-xs border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 outline-none focus:border-green-500 min-w-[150px]"
                >
                    <option value="">All Reasons</option>
                    {Object.entries(REASON_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                    ))}
                </select>

                <Button variant="primary" size="sm" onClick={() => onSearch(draft)} loading={loading}>Search</Button>
                <Button variant="secondary" size="sm" onClick={() => { setDraft({ status: '', reason: '' }); onReset() }}>Reset</Button>
            </div>
        </div>
    )
}

// ── ReturnDetailModal ─────────────────────────────────────────
function ReturnDetailModal({ open, onClose }) {
    const dispatch = useDispatch()
    const ret = useSelector(selectSelectedReturn)
    const loading = useSelector(selectReturnLoading)
    const [refundMethod, setRefundMethod] = useState('wallet')
    const [reviewNote, setReviewNote] = useState('')
    const [actLoading, setActLoading] = useState(false)

    useEffect(() => {
        if (open) { setRefundMethod('wallet'); setReviewNote('') }
    }, [open, ret?.id])

    if (!ret) return null

    const isPending = ret.status === 'pending'

    const handleApprove = async () => {
        setActLoading(true)
        const res = await dispatch(approveReturn({ returnId: ret.id, refundMethod, reviewNote }))
        if (approveReturn.fulfilled.match(res)) {
            dispatch(showToast({ message: 'Return approved — refund processed', type: 'success' }))
            onClose()
        } else {
            dispatch(showToast({ message: res.payload || 'Failed to approve', type: 'error' }))
        }
        setActLoading(false)
    }

    const handleReject = async () => {
        setActLoading(true)
        const res = await dispatch(rejectReturn({ returnId: ret.id, reviewNote }))
        if (rejectReturn.fulfilled.match(res)) {
            dispatch(showToast({ message: 'Return rejected', type: 'success' }))
            onClose()
        } else {
            dispatch(showToast({ message: res.payload || 'Failed to reject', type: 'error' }))
        }
        setActLoading(false)
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={`Return Request — #${ret.id?.slice(-8).toUpperCase()}`}
            size="lg"
            footer={
                <div className="flex gap-2 justify-end">
                    <Button variant="secondary" onClick={onClose}>Close</Button>
                    {isPending && (
                        <>
                            <Button variant="danger" loading={actLoading} onClick={handleReject}>✗ Reject</Button>
                            <Button variant="primary" loading={actLoading} onClick={handleApprove}>✓ Approve & Refund</Button>
                        </>
                    )}
                </div>
            }
        >
            <div className="space-y-5">

                {/* Status + meta */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        ['Status', <Badge key="s" variant={STATUS_COLOR[ret.status]} size="sm">{ret.status?.toUpperCase()}</Badge>],
                        ['Reason', <span key="r" className="text-xs font-semibold text-gray-700">{REASON_LABEL[ret.reason] || ret.reason}</span>],
                        ['Refund', <span key="ra" className="font-bold text-green-600 text-sm">{fmtCurrency(ret.refund_amount)}</span>],
                        ['Requested', <span key="d" className="text-xs text-gray-500">{fmtDate(ret.created_at)}</span>],
                    ].map(([label, value]) => (
                        <div key={label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                            {value}
                        </div>
                    ))}
                </div>

                {/* Customer note */}
                {ret.notes && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Customer Note</p>
                        <p className="text-sm text-gray-700 italic">"{ret.notes}"</p>
                    </div>
                )}

                {/* Proof images */}
                {ret.images?.length > 0 && (
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Proof Images</p>
                        <div className="flex gap-2 flex-wrap">
                            {ret.images.map((img, i) => (
                                <a key={i} href={img} target="_blank" rel="noreferrer">
                                    <img src={img} alt={`proof-${i}`}
                                        className="w-20 h-20 object-cover rounded-xl border border-gray-200 hover:opacity-80 transition-opacity" />
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* Return items table */}
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Return Items</p>
                    <div className="border border-gray-100 rounded-2xl overflow-hidden">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="text-left py-2.5 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Product</th>
                                    <th className="text-center py-2.5 px-2 text-[10px] font-bold text-gray-400 uppercase">Qty</th>
                                    <th className="text-center py-2.5 px-2 text-[10px] font-bold text-gray-400 uppercase">Unit Price</th>
                                    <th className="text-center py-2.5 px-2 text-[10px] font-bold text-gray-400 uppercase">Policy</th>
                                    <th className="text-center py-2.5 px-2 text-[10px] font-bold text-gray-400 uppercase">Stock</th>
                                    <th className="text-right py-2.5 px-4 text-[10px] font-bold text-gray-400 uppercase">Refund</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {ret.items?.map((item, i) => (
                                    <tr key={i} className="hover:bg-gray-50/50">
                                        <td className="py-3 px-4">
                                            <p className="font-bold text-gray-800">{item.product_name}</p>
                                            <p className="text-[10px] text-gray-400">{item.variant_id}</p>
                                        </td>
                                        <td className="py-3 px-2 text-center font-bold text-gray-700">{item.quantity}</td>
                                        <td className="py-3 px-2 text-center text-gray-600">{fmtCurrency(item.unit_price)}</td>
                                        <td className="py-3 px-2 text-center">
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${item.return_policy === 'no_return'
                                                ? 'bg-red-50 text-red-600'
                                                : 'bg-blue-50 text-blue-600'
                                                }`}>
                                                {item.return_policy?.replace(/_/g, ' ').toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="py-3 px-2 text-center">
                                            {item.return_to_stock
                                                ? <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">Restore</span>
                                                : <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Write-off</span>
                                            }
                                        </td>
                                        <td className="py-3 px-4 text-right font-bold text-green-600">{fmtCurrency(item.refund_amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-gray-200 bg-gray-50">
                                    <td colSpan={5} className="py-3 px-4 text-right text-xs font-bold text-gray-700">Total Refund</td>
                                    <td className="py-3 px-4 text-right text-sm font-black text-green-600">{fmtCurrency(ret.refund_amount)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Manager decision — only if pending */}
                {isPending && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Manager Decision</p>

                        <div>
                            <p className="text-xs font-bold text-gray-600 mb-1.5">Refund Method</p>
                            <div className="flex gap-2 flex-wrap">
                                {REFUND_METHODS.map(m => (
                                    <button
                                        key={m.value}
                                        onClick={() => setRefundMethod(m.value)}
                                        className={`text-xs font-bold px-3 py-2 rounded-xl border transition-all ${refundMethod === m.value
                                            ? 'bg-primary-600 border-primary-600 text-white'
                                            : 'bg-white border-gray-200 text-gray-700 hover:border-primary-300'
                                            }`}
                                    >
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="text-xs font-bold text-gray-600 mb-1.5">Review Note (optional)</p>
                            <textarea
                                value={reviewNote}
                                onChange={e => setReviewNote(e.target.value)}
                                placeholder="Add a note for the customer..."
                                rows={2}
                                className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-primary-400 bg-white resize-none"
                            />
                        </div>
                    </div>
                )}

                {/* Already reviewed */}
                {!isPending && ret.review_note && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Review Note</p>
                        <p className="text-sm text-gray-700">"{ret.review_note}"</p>
                        <p className="text-[10px] text-gray-400 mt-1">
                            Refund method: <span className="font-bold text-gray-600">{ret.refund_method?.replace(/_/g, ' ').toUpperCase()}</span>
                        </p>
                    </div>
                )}
            </div>
        </Modal>
    )
}

// ── Pagination ────────────────────────────────────────────────
function PaginationBar({ pagination, onPageChange }) {
    if (!pagination || pagination.totalPages <= 1) return null
    const { page, totalPages, total, limit } = pagination
    const from = (page - 1) * (limit || 20) + 1
    const to = Math.min(page * (limit || 20), total)

    const pages = totalPages <= 7
        ? Array.from({ length: totalPages }, (_, i) => i + 1)
        : [1,
            ...(page > 3 ? ['...'] : []),
            ...Array.from({ length: 3 }, (_, i) => Math.max(2, page - 1) + i)
                .filter(p => p > 1 && p < totalPages),
            ...(page < totalPages - 2 ? ['...'] : []),
            totalPages,
        ]

    return (
        <div className="flex items-center justify-between py-3 px-1 border-t border-gray-100 mt-1">
            <span className="text-xs text-gray-500">
                Showing <span className="font-semibold text-gray-700">{from}–{to}</span> of{' '}
                <span className="font-semibold text-gray-700">{total}</span> returns
            </span>
            <div className="flex items-center gap-1">
                <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
                    className="px-2.5 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:border-primary-300 disabled:opacity-40 disabled:cursor-not-allowed">
                    ← Prev
                </button>
                {pages.map((p, i) =>
                    p === '...'
                        ? <span key={`e${i}`} className="px-1 text-xs text-gray-400">…</span>
                        : <button key={p} onClick={() => onPageChange(p)}
                            className={`w-8 h-8 text-xs font-semibold rounded-lg border transition-colors ${p === page
                                ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                                : 'border-gray-200 text-gray-600 hover:border-primary-300'
                                }`}>{p}</button>
                )}
                <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
                    className="px-2.5 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:border-primary-300 disabled:opacity-40 disabled:cursor-not-allowed">
                    Next →
                </button>
            </div>
        </div>
    )
}

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({ label, value, color = 'text-gray-900', bg = 'bg-gray-50' }) {
    return (
        <div className={`${bg} rounded-2xl p-4 border border-gray-100`}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
            <p className={`text-xl font-black ${color}`}>{value}</p>
        </div>
    )
}

// ── Main Page ─────────────────────────────────────────────────
export default function Returns() {
    const dispatch = useDispatch()
    const returns = useSelector(selectReturnList)
    const loading = useSelector(selectReturnLoading)
    const pagination = useSelector(selectReturnPagination)
    const stats = useSelector(selectReturnStats)
    const selected = useSelector(selectSelectedReturn)
    const { activeMartId: martId, selectorProps } = useMart()

    const [filters, setFilters] = useState({ status: '', reason: '' })
    const [page, setPage] = useState(1)
    const [modalOpen, setModalOpen] = useState(false)

    useEffect(() => { dispatch(fetchMarts()) }, [dispatch])

    const load = useCallback((f = filters, p = page) => {
        if (!martId) return
        dispatch(fetchMartReturns({ martId, ...f, page: p, limit: 20 }))
    }, [martId, filters, page, dispatch])

    useEffect(() => { load() }, [martId, load])

    const handleSearch = (f) => { setFilters(f); setPage(1); load(f, 1) }
    const handleReset = () => { const f = { status: '', reason: '' }; setFilters(f); setPage(1); load(f, 1) }

    const handleView = async (ret) => {
        const res = await dispatch(fetchReturnById(ret.id))
        if (fetchReturnById.fulfilled.match(res)) setModalOpen(true)
        else setModalOpen(true) // open with list data as fallback
    }

    const handleClose = () => {
        setModalOpen(false)
        dispatch(clearSelectedReturn())
        load() // refresh list after any action
    }

    const columns = [
        {
            key: 'id', label: 'Return ID',
            render: r => (
                <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold border border-gray-200">
                    #{r.id?.slice(-8).toUpperCase()}
                </span>
            )
        },
        {
            key: 'order_id', label: 'Order',
            render: r => (
                <span className="text-[10px] font-mono text-gray-500">#{r.order_id?.slice(-8)}</span>
            )
        },
        {
            key: 'items', label: 'Items',
            render: r => (
                <div>
                    {r.items?.slice(0, 2).map((item, i) => (
                        <p key={i} className="text-xs text-gray-700 font-medium leading-tight">
                            {item.product_name}
                            <span className="text-gray-400 ml-1">×{item.quantity}</span>
                        </p>
                    ))}
                    {r.items?.length > 2 && (
                        <p className="text-[10px] text-gray-400">+{r.items.length - 2} more</p>
                    )}
                </div>
            )
        },
        {
            key: 'reason', label: 'Reason',
            render: r => (
                <span className="text-xs font-semibold text-gray-600">
                    {REASON_LABEL[r.reason] || r.reason}
                </span>
            )
        },
        {
            key: 'refund_amount', label: 'Refund',
            render: r => <span className="text-sm font-bold text-green-600">{fmtCurrency(r.refund_amount)}</span>
        },
        {
            key: 'status', label: 'Status',
            render: r => (
                <Badge variant={STATUS_COLOR[r.status] || 'gray'} size="xs">
                    {r.status?.toUpperCase()}
                </Badge>
            )
        },
        {
            key: 'created_at', label: 'Requested',
            render: r => <span className="text-[10px] text-gray-400">{fmtDate(r.created_at)}</span>
        },
        {
            key: 'actions', label: '',
            render: r => (
                <div className="flex justify-end gap-1">
                    <button
                        onClick={() => handleView(r)}
                        className="text-[10px] text-gray-600 font-black hover:bg-gray-100 px-2 py-1 rounded transition-colors uppercase tracking-tighter">
                        View
                    </button>
                    {r.status === 'pending' && (
                        <>
                            <button
                                onClick={() => handleView(r)}
                                className="text-[10px] text-green-700 font-black hover:bg-green-50 px-2 py-1 rounded transition-colors uppercase tracking-tighter">
                                ✓ Approve
                            </button>
                            <button
                                onClick={() => handleView(r)}
                                className="text-[10px] text-red-600 font-black hover:bg-red-50 px-2 py-1 rounded transition-colors uppercase tracking-tighter">
                                ✗ Reject
                            </button>
                        </>
                    )}
                </div>
            )
        },
    ]

    return (
        <div className="p-4 sm:p-6 space-y-4">
            <PageHeader
                title="Returns"
                subtitle="Review and process customer return requests"
                action={
                    <div className="flex items-center gap-3">
                        <MartSelector {...selectorProps} />
                        <Button variant="secondary" onClick={() => load()}>↻ Refresh</Button>
                    </div>
                }
            />

            {/* Stats */}
            {martId && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <StatCard label="Total Returns" value={stats.total} />
                    <StatCard label="Pending" value={stats.pending} color="text-yellow-600" bg="bg-yellow-50" />
                    <StatCard label="Approved" value={stats.approved} color="text-green-600" bg="bg-green-50" />
                    <StatCard label="Rejected" value={stats.rejected} color="text-red-600" bg="bg-red-50" />
                    <StatCard label="Total Refunded" value={fmtCurrency(stats.totalRefunded)} color="text-green-700" bg="bg-green-50" />
                </div>
            )}

            {martId && (
                <FilterBar
                    filters={filters}
                    onSearch={handleSearch}
                    onReset={handleReset}
                    loading={loading}
                />
            )}

            {!martId ? (
                <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-500 font-medium shadow-sm">
                    Please select a mart to view return requests.
                </div>
            ) : (
                <>
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                        <Table
                            columns={columns}
                            data={returns}
                            loading={loading}
                            emptyText="No return requests found"
                        />
                    </div>
                    <PaginationBar
                        pagination={pagination}
                        onPageChange={(p) => { setPage(p); load(filters, p) }}
                    />
                </>
            )}

            <ReturnDetailModal
                open={modalOpen}
                onClose={handleClose}
            />
        </div>
    )
}