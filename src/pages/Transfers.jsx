import { useEffect, useState, useCallback, useMemo } from 'react'
import { useDispatch } from 'react-redux'
import api from '../api/index'
import { showToast } from '../store/slices/uiSlice'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Grid from '../components/Grid'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Input from '../components/Input'
import useAuth from '../hooks/useAuth'

export default function Transfers() {
  const dispatch = useDispatch()
  const { martId, staffId } = useAuth()

  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(false)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [selectedTransfer, setSelectedTransfer] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [receiveForm, setReceiveForm] = useState({ qtyReceived: '' })
  const [statusFilter, setStatusFilter] = useState('all')

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '—'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const fetchTransfers = useCallback(async () => {
    if (!martId) return
    setLoading(true)
    try {
      const res = await api.get(`/warehouse-transfers/mart/${martId}`)
      if (res.success) {
        // "until dispatch don't show that row" - filter out 'created' status transfers
        const filtered = (res.data || []).filter(t => t.status !== 'created')
        setTransfers(filtered)
      }
    } catch (err) {
      console.error(err)
      dispatch(showToast({ message: 'Failed to retrieve transfers list', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }, [martId, dispatch])

  useEffect(() => {
    fetchTransfers()
  }, [fetchTransfers])

  // Filter transfers list by status tab
  const filteredTransfers = useMemo(() => {
    if (statusFilter === 'all') return transfers
    return transfers.filter(t => t.status === statusFilter)
  }, [transfers, statusFilter])

  // Compute stats
  const stats = useMemo(() => {
    return {
      total: transfers.length,
      inTransit: transfers.filter(t => t.status === 'dispatched').length,
      received: transfers.filter(t => t.status === 'received').length,
      cancelled: transfers.filter(t => t.status === 'cancelled').length
    }
  }, [transfers])

  const openReceiveWizard = (transfer) => {
    setSelectedTransfer(transfer)
    setReceiveForm({ qtyReceived: String(transfer.qty_dispatched) })
    setReceiveOpen(true)
  }

  const handleReceiveCargoSubmit = async () => {
    const qty = parseFloat(receiveForm.qtyReceived)
    if (isNaN(qty) || qty <= 0) {
      dispatch(showToast({ message: 'Valid quantity received is required', type: 'error' }))
      return
    }

    setSubmitting(true)
    try {
      const res = await api.patch(`/warehouse-transfers/${selectedTransfer.transfer_id}/receive`, {
        qtyReceived: qty
      })
      if (res.success) {
        dispatch(showToast({ message: 'Restock completed! Mart inventory levels updated.', type: 'success' }))
        setReceiveOpen(false)
        fetchTransfers()
      } else {
        dispatch(showToast({ message: res.message || 'Confirmation failed', type: 'error' }))
      }
    } catch (err) {
      dispatch(showToast({ message: 'Failed to complete inbound confirmation', type: 'error' }))
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    {
      key: 'transfer_id',
      label: 'Ticket',
      render: (row) => (
        <div>
          <span className="font-mono font-bold text-indigo-600">#TX-{row.transfer_id.slice(0, 6).toUpperCase()}</span>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
            {formatDateDisplay(row.dispatched_at || row.received_at || row.created_at)}
          </p>
        </div>
      )
    },
    {
      key: 'warehouse_name',
      label: 'Source Warehouse',
      render: (row) => <span className="font-semibold text-slate-700">🏭 {row.warehouse_name || 'Main Warehouse'}</span>
    },
    {
      key: 'product_details',
      label: 'Product Details',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-800">{row.productName || row.product_name || 'Generic SKU'}</span>
          {row.brand && (
            <span className="ml-2 bg-amber-50 text-amber-800 text-[8px] font-extrabold px-1 py-0.5 rounded border border-amber-200 uppercase tracking-wider">
              🏷️ {row.brand}
            </span>
          )}
          <p className="text-[10px] font-mono text-slate-400 mt-0.5">SKU: {row.variant_sku || 'N/A'}</p>
        </div>
      )
    },
    {
      key: 'qty_dispatched',
      label: 'Qty Dispatched',
      className: 'text-right',
      render: (row) => <span className="font-bold text-slate-700">{parseFloat(row.qty_dispatched).toLocaleString()}</span>
    },
    {
      key: 'qty_received',
      label: 'Qty Received',
      className: 'text-right',
      render: (row) => (
        <span className="font-bold text-emerald-600">
          {row.qty_received != null ? parseFloat(row.qty_received).toLocaleString() : '—'}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => {
        let badgeCol = 'gray'
        if (row.status === 'received') badgeCol = 'green'
        if (row.status === 'dispatched') badgeCol = 'blue'
        if (row.status === 'cancelled') badgeCol = 'red'
        return <Badge variant={badgeCol}>{row.status.toUpperCase()}</Badge>
      }
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="flex gap-1.5 justify-end">
          {row.status === 'dispatched' && (
            <Button
              variant="primary"
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => openReceiveWizard(row)}
            >
              📥 Receive Goods
            </Button>
          )}
          {(row.status === 'received' || row.status === 'cancelled') && (
            <span className="text-xs text-slate-400 font-semibold italic p-1">Archived</span>
          )}
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Received Goods"
        subtitle="Verify and check-in stock transfer dispatches arriving from warehouse facilities."
        action={<Button variant="secondary" onClick={fetchTransfers}>↻ Refresh</Button>}
      />

      {/* Stats Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Tickets', value: stats.total, icon: '📋', border: 'border-slate-100', sub: 'Dispatches processed or incoming' },
          { label: 'In Transit', value: stats.inTransit, icon: '🚚', border: 'border-blue-100 bg-blue-50/10', sub: 'On the road from Warehouse' },
          { label: 'Received', value: stats.received, icon: '🟢', border: 'border-emerald-100 bg-emerald-50/10', sub: 'Checked in at this mart' },
          { label: 'Cancelled', value: stats.cancelled, icon: '❌', border: 'border-rose-100 bg-rose-50/10', sub: 'Cancelled dispatches' }
        ].map((item, idx) => (
          <div key={idx} className={`bg-white border ${item.border} rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:shadow transition-shadow duration-150`}>
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</span>
              <span className="text-sm">{item.icon}</span>
            </div>
            <div className="mt-2.5">
              <span className="text-xl font-extrabold text-slate-900">{item.value}</span>
              <p className="text-[9px] text-slate-400 font-medium leading-snug mt-1">{item.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter status tabs */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-px">
        {['all', 'dispatched', 'received', 'cancelled'].map(tab => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-4 py-2 text-xs font-bold transition-all duration-150 border-b-2 -mb-px ${
              statusFilter === tab
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Grid */}
      <Grid
        columns={columns}
        data={filteredTransfers}
        loading={loading}
        emptyText="No dispatches found."
        pagination={true}
        pageSize={15}
        showSearch={true}
        searchPlaceholder="Search dispatches..."
        searchKey={(item, query) => [item.transfer_id, item.warehouse_name, item.productName || item.product_name, item.status].some(v => String(v || '').toLowerCase().includes(query))}
      />

      {/* Confirm Mart Receipt Modal */}
      <Modal
        title="Confirm Inbound Mart Receipt"
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReceiveOpen(false)} disabled={submitting}>Cancel</Button>
            <Button variant="primary" className="bg-indigo-600 hover:bg-indigo-700" loading={submitting} onClick={handleReceiveCargoSubmit}>📥 Confirm Delivery</Button>
          </>
        }
      >
        {selectedTransfer && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 font-medium">
              Confirm inbound delivery at mart for item: <strong className="text-slate-800">{selectedTransfer.productName || selectedTransfer.product_name}</strong>.
            </p>

            <Input
              label="Actual Quantity Received *"
              type="number"
              required
              min="1"
              value={receiveForm.qtyReceived}
              onChange={e => setReceiveForm({ qtyReceived: e.target.value })}
            />

            <span className="text-[10px] text-slate-400 font-mono block mt-1">
              Quantity dispatched from warehouse: {parseFloat(selectedTransfer.qty_dispatched).toLocaleString()} units.
            </span>
          </div>
        )}
      </Modal>
    </div>
  )
}
