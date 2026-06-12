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
import AlgoliaProductSearch from '../components/AlgoliaProductSearch'

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

  // Request Stock states
  const [requestOpen, setRequestOpen] = useState(false)
  const [warehouses, setWarehouses] = useState([])
  const [products, setProducts] = useState([])
  const [associatedWarehouseId, setAssociatedWarehouseId] = useState('')
  const [requestForm, setRequestForm] = useState({
    warehouseId: '',
    productId: '',
    variantId: '',
    qtyRequested: '',
    notes: ''
  })

  const [selectedProductLabel, setSelectedProductLabel] = useState('')
  const [selectedProductVariants, setSelectedProductVariants] = useState([])
  const [variantLoadingForProduct, setVariantLoadingForProduct] = useState(false)

  // Returns state
  const [activeTab, setActiveTab] = useState('transfers') // 'transfers' | 'returns'
  const [returns, setReturns] = useState([])
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnBatches, setReturnBatches] = useState([])
  const [selectedReturnBatch, setSelectedReturnBatch] = useState(null)
  const [batchSearchText, setBatchSearchText] = useState('')
  const [batchDropdownOpen, setBatchDropdownOpen] = useState(false)
  const [returnForm, setReturnForm] = useState({ qty: '', reason: '', notes: '' })
  const [returnsLoading, setReturnsLoading] = useState(false)

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
        // Keep all transfers including 'created' status (requested transfers)
        setTransfers(res.data || [])
      }
    } catch (err) {
      console.error(err)
      dispatch(showToast({ message: 'Failed to retrieve transfers list', type: 'error' }))
    } finally {
      setLoading(false)
    }
  }, [martId, dispatch])

  const fetchReturns = useCallback(async () => {
    if (!martId) return
    setReturnsLoading(true)
    try {
      const res = await api.get(`/mart-returns/mart/${martId}`)
      if (res.success) {
        setReturns(res.data || [])
      }
    } catch (err) {
      console.error(err)
      dispatch(showToast({ message: 'Failed to retrieve returns list', type: 'error' }))
    } finally {
      setReturnsLoading(false)
    }
  }, [martId, dispatch])

  const fetchReturnBatches = useCallback(async () => {
    if (!martId) return
    try {
      const res = await api.get(`/mart-returns/mart/${martId}/batches`)
      if (res.success) {
        setReturnBatches(res.data || [])
      }
    } catch (err) {
      console.error(err)
    }
  }, [martId])

  const handleCancelReturn = async (returnId) => {
    if (!window.confirm('Are you sure you want to cancel this return request?')) return
    setSubmitting(true)
    try {
      const res = await api.patch(`/mart-returns/${returnId}/cancel`)
      if (res.success) {
        dispatch(showToast({ message: 'Return request cancelled successfully', type: 'success' }))
        fetchReturns()
      } else {
        dispatch(showToast({ message: res.message || 'Cancellation failed', type: 'error' }))
      }
    } catch (err) {
      dispatch(showToast({ message: 'Failed to cancel return request', type: 'error' }))
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateReturnSubmit = async () => {
    const { qty, reason, notes } = returnForm
    const qtyNum = parseFloat(qty)
    if (!selectedReturnBatch) {
      dispatch(showToast({ message: 'Please select a batch to return', type: 'error' }))
      return
    }
    if (isNaN(qtyNum) || qtyNum <= 0) {
      dispatch(showToast({ message: 'Please enter a valid positive quantity', type: 'error' }))
      return
    }
    if (qtyNum > parseFloat(selectedReturnBatch.qty_remaining)) {
      dispatch(showToast({ message: 'Cannot return more than available batch stock', type: 'error' }))
      return
    }
    if (!reason) {
      dispatch(showToast({ message: 'Please select a return reason', type: 'error' }))
      return
    }

    setSubmitting(true)
    try {
      const res = await api.post(`/mart-returns/mart/${martId}`, {
        martBatchId: selectedReturnBatch.id,
        qty: qtyNum,
        reason,
        notes
      })
      if (res.success) {
        dispatch(showToast({ message: 'Return request submitted successfully!', type: 'success' }))
        setReturnOpen(false)
        setReturnForm({ qty: '', reason: '', notes: '' })
        setSelectedReturnBatch(null)
        setBatchSearchText('')
        fetchReturns()
      } else {
        dispatch(showToast({ message: res.message || 'Return request failed', type: 'error' }))
      }
    } catch (err) {
      dispatch(showToast({ message: err?.response?.data?.message || err?.message || 'Failed to submit return request', type: 'error' }))
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    fetchTransfers()
    fetchReturns()

    // Fetch mart details to resolve associated warehouse
    if (martId) {
      api.get(`/marts/${martId}`)
        .then(res => {
          if (res.success && res.data?.warehouse_id) {
            setAssociatedWarehouseId(res.data.warehouse_id)
            setRequestForm(prev => ({ ...prev, warehouseId: res.data.warehouse_id }))
          }
        })
        .catch(console.error)
    }

    // Fetch warehouses for dropdown
    api.get('/warehouses')
      .then(res => {
        if (res.success) setWarehouses(res.data || [])
      })
      .catch(console.error)
  }, [martId, fetchTransfers, fetchReturns])

  // Reset product selection when warehouseId changes
  useEffect(() => {
    setSelectedProductLabel('')
    setSelectedProductVariants([])
  }, [requestForm.warehouseId])

  const fetchWarehouseVariantsForProduct = async (productId) => {
    if (!requestForm.warehouseId || !productId) return
    setVariantLoadingForProduct(true)
    try {
      const res = await api.get(
        `/warehouse-inventory/warehouse/${requestForm.warehouseId}?product_id=${productId}&limit=200`
      )
      if (res.success) {
        setSelectedProductVariants(res.data || [])
      } else {
        setSelectedProductVariants([])
      }
    } catch (err) {
      console.error('[fetchWarehouseVariants]', err)
      setSelectedProductVariants([])
    } finally {
      setVariantLoadingForProduct(false)
    }
  }

  // Filter transfers list by status tab
  const filteredTransfers = useMemo(() => {
    if (statusFilter === 'all') return transfers
    return transfers.filter(t => t.status === statusFilter)
  }, [transfers, statusFilter])

  // Compute stats
  const stats = useMemo(() => {
    return {
      total: transfers.length,
      requested: transfers.filter(t => t.status === 'created').length,
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

  const handleCancelRequest = async (transferId) => {
    if (!window.confirm('Are you sure you want to cancel this stock request?')) return
    setSubmitting(true)
    try {
      const res = await api.patch(`/warehouse-transfers/${transferId}/cancel`)
      if (res.success) {
        dispatch(showToast({ message: 'Stock request cancelled successfully', type: 'success' }))
        fetchTransfers()
      } else {
        dispatch(showToast({ message: res.message || 'Cancellation failed', type: 'error' }))
      }
    } catch (err) {
      dispatch(showToast({ message: 'Failed to cancel stock request', type: 'error' }))
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateRequestSubmit = async () => {
    const { warehouseId, productId, variantId, qtyRequested, notes } = requestForm
    const qty = parseFloat(qtyRequested)
    if (!warehouseId) {
      dispatch(showToast({ message: 'Please select a source warehouse', type: 'error' }))
      return
    }
    if (!productId) {
      dispatch(showToast({ message: 'Please select a product', type: 'error' }))
      return
    }
    if (isNaN(qty) || qty <= 0) {
      dispatch(showToast({ message: 'Please enter a valid quantity', type: 'error' }))
      return
    }

    setSubmitting(true)
    try {
      const res = await api.post('/warehouse-transfers', {
        warehouseId,
        martId,
        productId,
        variantId,
        qtyDispatched: qty,
        notes
      })
      if (res.success) {
        dispatch(showToast({ message: 'Stock request submitted successfully!', type: 'success' }))
        setRequestOpen(false)
        setRequestForm({ warehouseId: associatedWarehouseId, productId: '', variantId: '', qtyRequested: '', notes: '' })
        setSelectedProductLabel('')
        setSelectedProductVariants([])
        fetchTransfers()
      } else {
        dispatch(showToast({ message: res.message || 'Request failed', type: 'error' }))
      }
    } catch (err) {
      dispatch(showToast({ message: err?.response?.data?.message || err?.message || 'Failed to submit stock request', type: 'error' }))
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
      label: 'Qty Requested',
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
        if (row.status === 'created') badgeCol = 'yellow'
        if (row.status === 'received') badgeCol = 'green'
        if (row.status === 'dispatched') badgeCol = 'blue'
        if (row.status === 'cancelled') badgeCol = 'red'
        return <Badge variant={badgeCol}>{row.status === 'created' ? 'REQUESTED' : row.status.toUpperCase()}</Badge>
      }
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="flex gap-1.5 justify-end">
          {row.status === 'created' && (
            <Button
              variant="secondary"
              size="sm"
              className="text-rose-600 hover:text-rose-800 border border-rose-200 hover:bg-rose-50"
              disabled={submitting}
              onClick={() => handleCancelRequest(row.transfer_id)}
            >
              ✕ Cancel Request
            </Button>
          )}
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

  const returnColumns = [
    {
      key: 'return_code',
      label: 'Return Code',
      render: (row) => (
        <div>
          <span className="font-mono font-bold text-rose-600">#MR-{row.return_code}</span>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
            {formatDateDisplay(row.created_at)}
          </p>
        </div>
      )
    },
    {
      key: 'item_details',
      label: 'Item / Batch Details',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-800">{row.product_name || 'Generic SKU'}</span>
          {row.brand_name && (
            <span className="ml-2 bg-amber-50 text-amber-800 text-[8px] font-extrabold px-1 py-0.5 rounded border border-amber-200 uppercase tracking-wider">
              🏷️ {row.brand_name}
            </span>
          )}
          <p className="text-[10px] font-mono text-slate-400 mt-0.5">
            Batch: {row.batch_number} {row.expiry_date ? `| Exp: ${formatDateDisplay(row.expiry_date)}` : ''}
          </p>
        </div>
      )
    },
    {
      key: 'warehouse_name',
      label: 'Target Warehouse',
      render: (row) => <span className="font-semibold text-slate-700">🏭 {row.warehouse_name || 'Main Warehouse'}</span>
    },
    {
      key: 'qty_returned',
      label: 'Qty Returned',
      className: 'text-right',
      render: (row) => <span className="font-bold text-slate-700">{parseFloat(row.qty_returned).toLocaleString()}</span>
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (row) => {
        let badgeCol = 'gray'
        if (row.reason === 'expired') badgeCol = 'red'
        if (row.reason === 'damage') badgeCol = 'yellow'
        if (row.reason === 'near_expiry') badgeCol = 'blue'
        return <Badge variant={badgeCol}>{row.reason.replace(/_/g, ' ').toUpperCase()}</Badge>
      }
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => {
        let badgeCol = 'gray'
        if (row.status === 'requested') badgeCol = 'yellow'
        if (row.status === 'accepted') badgeCol = 'green'
        if (row.status === 'rejected') badgeCol = 'red'
        if (row.status === 'cancelled') badgeCol = 'gray'
        return <Badge variant={badgeCol}>{row.status.toUpperCase()}</Badge>
      }
    },
    {
      key: 'remarks',
      label: 'Remarks / Notes',
      render: (row) => (
        <div className="max-w-xs truncate text-xs text-slate-500">
          {row.status === 'rejected' ? (
            <span className="text-rose-600 font-medium">Rejection Reason: {row.rejection_reason}</span>
          ) : (
            row.notes || '—'
          )}
        </div>
      )
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="flex gap-1.5 justify-end">
          {row.status === 'requested' && (
            <Button
              variant="secondary"
              size="sm"
              className="text-rose-600 hover:text-rose-800 border border-rose-200 hover:bg-rose-50"
              disabled={submitting}
              onClick={() => handleCancelReturn(row.return_id)}
            >
              ✕ Cancel Return
            </Button>
          )}
        </div>
      )
    }
  ]

  const filteredReturnBatches = useMemo(() => {
    const q = batchSearchText.toLowerCase().trim()
    if (!q) return returnBatches
    return returnBatches.filter(b => 
      (b.batch_number || '').toLowerCase().includes(q) ||
      (b.product_name || b.productName || '').toLowerCase().includes(q) ||
      (b.variant_sku || '').toLowerCase().includes(q)
    )
  }, [returnBatches, batchSearchText])

  return (
    <div className="space-y-6">
      <PageHeader
        title={activeTab === 'transfers' ? "Received Goods" : "Stock Returns"}
        subtitle={activeTab === 'transfers' ? "Verify and check-in stock transfer dispatches arriving from warehouse facilities." : "Create and manage returns of damaged, expired or near-expiry stock back to the warehouse."}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={activeTab === 'transfers' ? fetchTransfers : fetchReturns}>↻ Refresh</Button>
            {activeTab === 'transfers' ? (
              <Button variant="primary" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => {
                setRequestForm({
                  warehouseId: associatedWarehouseId,
                  productId: '',
                  variantId: '',
                  qtyRequested: '',
                  notes: ''
                });
                setSelectedProductLabel('');
                setSelectedProductVariants([]);
                setRequestOpen(true);
              }}>+ Request Stock</Button>
            ) : (
              <Button variant="primary" className="bg-rose-600 hover:bg-rose-700" onClick={() => {
                fetchReturnBatches();
                setReturnForm({
                  qty: '',
                  reason: '',
                  notes: ''
                });
                setBatchSearchText('');
                setSelectedReturnBatch(null);
                setReturnOpen(true);
              }}>+ Return Stock</Button>
            )}
          </div>
        }
      />

      {/* Tab Switcher */}
      <div className="flex items-center gap-6 border-b border-slate-100 pb-px">
        <button
          onClick={() => setActiveTab('transfers')}
          className={`px-4 py-2 text-sm font-bold transition-all duration-150 border-b-2 -mb-px ${
            activeTab === 'transfers'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          🚚 Inbound Transfers
        </button>
        <button
          onClick={() => setActiveTab('returns')}
          className={`px-4 py-2 text-sm font-bold transition-all duration-150 border-b-2 -mb-px ${
            activeTab === 'returns'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          ↩️ Returns to Warehouse
        </button>
      </div>

      {activeTab === 'transfers' ? (
        <>
          {/* Stats Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            {[
              { label: 'Total Tickets', value: stats.total, icon: '📋', border: 'border-slate-100', sub: 'Dispatches processed or incoming' },
              { label: 'Requested', value: stats.requested, icon: '✍️', border: 'border-yellow-100 bg-yellow-50/10', sub: 'Pending dispatch by Warehouse' },
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
            {['all', 'created', 'dispatched', 'received', 'cancelled'].map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-4 py-2 text-xs font-bold transition-all duration-150 border-b-2 -mb-px ${
                  statusFilter === tab
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab === 'created' ? 'REQUESTED' : tab.toUpperCase()}
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
        </>
      ) : (
        <>
          {/* Returns Grid */}
          <Grid
            columns={returnColumns}
            data={returns}
            loading={returnsLoading}
            emptyText="No returns recorded."
            pagination={true}
            pageSize={15}
            showSearch={true}
            searchPlaceholder="Search returns..."
            searchKey={(item, query) => [item.return_code, item.warehouse_name, item.product_name, item.status, item.reason].some(v => String(v || '').toLowerCase().includes(query))}
          />
        </>
      )}

      {/* Request Stock Modal */}
      <Modal
        title="Request Stock from Warehouse"
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRequestOpen(false)} disabled={submitting}>Cancel</Button>
            <Button variant="primary" className="bg-indigo-600 hover:bg-indigo-700" loading={submitting} onClick={handleCreateRequestSubmit}>Submit Request</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700">Source Warehouse *</label>
            <select
              disabled={!!associatedWarehouseId}
              className="w-full text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:border-indigo-500 focus:outline-none transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed"
              value={requestForm.warehouseId}
              onChange={e => setRequestForm(prev => ({ ...prev, warehouseId: e.target.value }))}
            >
              <option value="">Select Warehouse</option>
              {warehouses.map(w => (
                <option key={w.warehouse_id} value={w.warehouse_id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
            {associatedWarehouseId && (
              <span className="text-[10px] text-slate-400 font-semibold italic">Locked to Mart's designated supplier warehouse.</span>
            )}
          </div>

          <AlgoliaProductSearch
            mode="product"
            label="Select Product *"
            value={selectedProductLabel}
            placeholder="Search catalog by name or brand…"
            onSelect={async (prod) => {
              const label = `${prod.productName} (${prod.brandName})`
              setSelectedProductLabel(label)
              setSelectedProductVariants([])
              setRequestForm(prev => ({
                ...prev,
                productId: prod.productId,
                variantId: ''
              }))
              // Fetch REAL warehouse variants for this product (correct UUIDs + stock)
              await fetchWarehouseVariantsForProduct(prod.productId)
            }}
            onClear={() => {
              setSelectedProductLabel('')
              setSelectedProductVariants([])
              setRequestForm(prev => ({ ...prev, productId: '', variantId: '' }))
            }}
          />

          {variantLoadingForProduct && (
            <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
              <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              Loading warehouse stock for this product…
            </div>
          )}

          {!variantLoadingForProduct && selectedProductVariants.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">Select Variant *</label>
              <select
                required
                value={requestForm.variantId}
                onChange={e => setRequestForm(prev => ({ ...prev, variantId: e.target.value }))}
                className="w-full text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:border-indigo-500 focus:outline-none transition-colors"
              >
                <option value="">-- Choose Variant --</option>
                {selectedProductVariants.map((v, i) => {
                  const variantId = v.variant_id
                  const variantName = v.variant_name || v.variantName || v.sku || 'Default'
                  const sku = v.variant_sku || v.sku || 'N/A'
                  const avail = parseFloat(v.available_qty ?? v.qty_available ?? 0)
                  const isOutOfStock = avail <= 0
                  return (
                    <option key={variantId || i} value={variantId} disabled={isOutOfStock}>
                      {variantName} · SKU: {sku} · {isOutOfStock ? '❌ Out of stock' : `Available: ${avail.toLocaleString()} pcs`}
                    </option>
                  )
                })}
              </select>
            </div>
          )}

          {!variantLoadingForProduct && requestForm.productId && selectedProductVariants.length === 0 && (
            <p className="text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠️ No warehouse stock found for this product.
            </p>
          )}

          <Input
            label="Quantity to Request *"
            type="number"
            required
            min="1"
            value={requestForm.qtyRequested}
            onChange={e => setRequestForm(prev => ({ ...prev, qtyRequested: e.target.value }))}
          />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700">Notes (Optional)</label>
            <textarea
              className="w-full text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:border-indigo-500 focus:outline-none transition-colors"
              rows="3"
              placeholder="Reason for requesting stock..."
              value={requestForm.notes}
              onChange={e => setRequestForm(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

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

      {/* Return to Warehouse Modal */}
      <Modal
        title="Return Damaged / Expired Stock to Warehouse"
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReturnOpen(false)} disabled={submitting}>Cancel</Button>
            <Button variant="primary" className="bg-rose-600 hover:bg-rose-700" loading={submitting} onClick={handleCreateReturnSubmit}>Submit Return Request</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-1 relative">
            <label className="text-xs font-bold text-slate-700">Select Batch to Return *</label>
            <input
              type="text"
              required
              placeholder="🔍 Search batch number, SKU or product name..."
              value={batchSearchText}
              onChange={(e) => {
                setBatchSearchText(e.target.value);
                setBatchDropdownOpen(true);
              }}
              onFocus={() => setBatchDropdownOpen(true)}
              onBlur={() => setTimeout(() => setBatchDropdownOpen(false), 200)}
              className="w-full text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:border-indigo-500 focus:outline-none transition-colors"
            />
            {batchDropdownOpen && (
              <div className="absolute left-0 right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto top-full mt-1 p-1">
                {filteredReturnBatches.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400 font-medium">No returnable batches found</div>
                ) : (
                  filteredReturnBatches.map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSelectedReturnBatch(b);
                        setBatchSearchText(`${b.batch_number} — ${b.product_name || 'Generic Product'}`);
                        setBatchDropdownOpen(false);
                      }}
                      className={`w-full text-left text-xs font-semibold text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors duration-150 border-b border-slate-100 flex flex-col gap-0.5 ${selectedReturnBatch?.id === b.id ? 'bg-rose-50 text-rose-900' : ''}`}
                    >
                      <span className="font-bold">{b.product_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Batch: {b.batch_number} | Exp: {formatDateDisplay(b.expiry_date)} | Stock: {parseFloat(b.qty_remaining).toLocaleString()}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {selectedReturnBatch && (
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-1 text-xs text-slate-600 font-medium">
              <div>📦 Batch Qty Available: <strong className="text-slate-800">{parseFloat(selectedReturnBatch.qty_remaining).toLocaleString()} units</strong></div>
              <div>📅 Expiry Date: <strong className="text-slate-800">{formatDateDisplay(selectedReturnBatch.expiry_date)}</strong></div>
              <div>💰 COGS Cost: <strong className="text-slate-800">₹{selectedReturnBatch.cogs}</strong></div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700">Reason for Return *</label>
            <select
              required
              className="w-full text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:border-indigo-500 focus:outline-none transition-colors"
              value={returnForm.reason}
              onChange={e => setReturnForm(prev => ({ ...prev, reason: e.target.value }))}
            >
              <option value="">Select Reason</option>
              <option value="damage">💥 Damage</option>
              <option value="expired">⏰ Expired</option>
              <option value="near_expiry">📅 Near Expiry</option>
              <option value="quality_issue">❌ Quality Issue</option>
              <option value="wrong_item">📦 Wrong Item</option>
            </select>
          </div>

          <Input
            label="Quantity to Return *"
            type="number"
            required
            min="1"
            max={selectedReturnBatch ? parseFloat(selectedReturnBatch.qty_remaining) : undefined}
            value={returnForm.qty}
            onChange={e => setReturnForm(prev => ({ ...prev, qty: e.target.value }))}
          />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700">Notes (Optional)</label>
            <textarea
              className="w-full text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:border-indigo-500 focus:outline-none transition-colors"
              rows="3"
              placeholder="Provide details about return (e.g., condition of packaging)..."
              value={returnForm.notes}
              onChange={e => setReturnForm(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
