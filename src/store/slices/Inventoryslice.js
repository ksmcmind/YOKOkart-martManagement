// src/store/slices/inventorySlice.js
//
// ROOT CAUSE OF ALL THREE BUGS:
//
//   fetchInventoryFiltered was calling:
//     api.get(`/inventory?${params}`)          ← getAll controller
//
//   getAll:
//     - ignores ALL filter params (martId is used but others are not)
//     - returns res.data as a flat array  →  no .pagination key ever
//     - so filteredItems showed 15 random items, filters had zero effect,
//       and filteredPagination was always null (PaginationBar never rendered)
//
//   Fix: change to /inventory/filters which hits filterInventory controller
//   that applies every filter and returns { data: [...], pagination: {...} }

import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit'
import api from '../../api/index'
import { showToast } from './uiSlice'

// ── Normalizer ───────────────────────────────────────────────────────────────

const normalizeDashboard = (raw) => ({
    total_items: Number(raw?.total_items) || 0,
    out_of_stock_count: Number(raw?.out_of_stock_count) || 0,
    low_stock_count: Number(raw?.low_stock_count) || 0,
    out_of_stock_items: Array.isArray(raw?.out_of_stock_items) ? raw.out_of_stock_items : [],
    low_stock_items: Array.isArray(raw?.low_stock_items) ? raw.low_stock_items : [],
})

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchInventory = createAsyncThunk(
    'inventory/fetchAll',
    async (martId, { rejectWithValue }) => {
        if (!martId) return rejectWithValue('No martId provided')
        try {
            const res = await api.get(`/inventory?martId=${encodeURIComponent(martId)}`)
            if (!res.success) return rejectWithValue(res.message || 'Failed to load inventory')
            const rawData = res.data || (Array.isArray(res) ? res : [])
            return rawData.map(item => ({
                ...item,
                id: item.id || item._id,
                stock_qty: item.stock_qty ?? item.ck_qty ?? 0
            }))
        } catch (err) {
            return rejectWithValue(err?.message || 'Network error')
        }
    }
)

export const fetchInventoryFiltered = createAsyncThunk(
    'inventory/fetchFiltered',
    async (filters = {}, { rejectWithValue }) => {
        const { martId, ...rest } = filters
        if (!martId) return rejectWithValue('martId is required')
        try {
            const params = new URLSearchParams()
            params.set('martId', martId)
            Object.entries(rest).forEach(([k, v]) => {
                if (v !== '' && v !== null && v !== undefined) params.set(k, v)
            })
            // ← FIXED: /inventory/filters not /inventory
            const res = await api.get(`/inventory/filters?${params.toString()}`)
            if (!res.success) return rejectWithValue(res.message || 'Failed to load')
            const rawData = res.data || (Array.isArray(res) ? res : [])
            const items = rawData.map(item => ({
                ...item,
                id: item.id || item._id,
                stock_qty: item.stock_qty ?? item.ck_qty ?? 0
            }))
            return {
                data: items,
                pagination: res.pagination || null,
            }
        } catch (err) {
            return rejectWithValue(err?.message || 'Network error')
        }
    }
)

export const fetchInventorySummary = createAsyncThunk(
    'inventory/fetchSummary',
    async (martId, { rejectWithValue }) => {
        if (!martId) return rejectWithValue('martId required')
        try {
            const res = await api.get(`/inventory/summary/${encodeURIComponent(martId)}`)
            if (!res.success) return rejectWithValue(res.message || 'Failed to load summary')
            return res.data
        } catch (err) {
            return rejectWithValue(err?.message || 'Network error')
        }
    }
)

export const fetchInventoryDashboard = createAsyncThunk(
    'inventory/fetchDashboard',
    async (martId, { rejectWithValue }) => {
        if (!martId) return rejectWithValue('No martId provided')
        try {
            const res = await api.get(`/inventory/dashboard?martId=${encodeURIComponent(martId)}`)
            if (!res.success) return rejectWithValue(res.message || 'Failed to load dashboard')
            return normalizeDashboard(res.data)
        } catch (err) {
            return rejectWithValue(err?.message || 'Network error')
        }
    }
)

export const addInventoryItem = createAsyncThunk(
    'inventory/add',
    async (payload, { dispatch, rejectWithValue }) => {
        try {
            const res = await api.post('/inventory', payload)
            if (!res.success) {
                dispatch(showToast({ message: res.message || 'Failed to add', type: 'error' }))
                return rejectWithValue(res.message)
            }
            dispatch(showToast({ message: 'Item added!', type: 'success' }))
            return res.data
        } catch (err) {
            dispatch(showToast({ message: 'Network error', type: 'error' }))
            return rejectWithValue(err?.message)
        }
    }
)

export const restockInventoryItem = createAsyncThunk(
    'inventory/restock',
    async (payload, { dispatch, rejectWithValue }) => {
        try {
            const res = await api.post('/inventory/restock', payload)
            if (!res.success) {
                dispatch(showToast({ message: res.message || 'Restock failed', type: 'error' }))
                return rejectWithValue(res.message)
            }
            dispatch(showToast({ message: 'Stock updated', type: 'success' }))
            return res.data
        } catch (err) {
            dispatch(showToast({ message: 'Network error', type: 'error' }))
            return rejectWithValue(err?.message)
        }
    }
)

export const updateInventoryItem = createAsyncThunk(
    'inventory/update',
    async ({ id, patch, silent = false }, { dispatch, rejectWithValue }) => {
        try {
            const res = await api.patch(`/inventory/${id}`, patch)
            if (!res.success) {
                dispatch(showToast({ message: res.message || 'Update failed', type: 'error' }))
                return rejectWithValue(res.message)
            }
            if (!silent) dispatch(showToast({ message: 'Updated', type: 'success' }))
            return { id, patch, server: res.data }
        } catch (err) {
            dispatch(showToast({ message: 'Update failed', type: 'error' }))
            return rejectWithValue(err?.message)
        }
    }
)

export const toggleInventoryActive = createAsyncThunk(
    'inventory/toggleActive',
    async (item, { dispatch, rejectWithValue }) => {
        try {
            const res = await api.patch(`/inventory/${item.id}`, { is_active: !item.is_active })
            if (!res.success) {
                dispatch(showToast({ message: 'Toggle failed', type: 'error' }))
                return rejectWithValue(res.message)
            }
            return { id: item.id, is_active: !item.is_active }
        } catch (err) {
            dispatch(showToast({ message: 'Toggle failed', type: 'error' }))
            return rejectWithValue(err?.message)
        }
    }
)

export const deleteInventoryItem = createAsyncThunk(
    'inventory/delete',
    async (id, { dispatch, rejectWithValue }) => {
        try {
            const res = await api.delete(`/inventory/${id}`)
            if (!res.success) return rejectWithValue(res.message)
            dispatch(showToast({ message: 'Item deleted', type: 'success' }))
            return id
        } catch (err) {
            return rejectWithValue(err?.message)
        }
    }
)

export const fetchItemTransactions = createAsyncThunk(
    'inventory/fetchItemTransactions',
    async ({ id, limit = 50 }, { rejectWithValue }) => {
        if (!id) return rejectWithValue('id required')
        try {
            const res = await api.get(`/inventory/${id}/transactions?limit=${limit}`)
            if (!res.success) return rejectWithValue(res.message)
            return { id, txns: res.data || [] }
        } catch (err) {
            return rejectWithValue(err?.message || 'Network error')
        }
    }
)

export const fetchMartTransactions = createAsyncThunk(
    'inventory/fetchMartTransactions',
    async (args = {}, { rejectWithValue }) => {
        const { martId, type, from, to, limit = 100 } = args
        if (!martId) return rejectWithValue('martId required')
        try {
            const params = new URLSearchParams({ martId, limit: String(limit) })
            if (type) params.set('type', type)
            if (from) params.set('from', from)
            if (to) params.set('to', to)
            const res = await api.get(`/inventory/transactions?${params.toString()}`)
            if (!res.success) return rejectWithValue(res.message)
            return res.data || []
        } catch (err) {
            return rejectWithValue(err?.message || 'Network error')
        }
    }
)

export const bulkUploadInventory = createAsyncThunk(
    'inventory/bulkUpload',
    async (arg, { dispatch, rejectWithValue }) => {
        const file = arg?.file
        const martId = arg?.martId
        const staffId = arg?.staffId
        if (!file) return rejectWithValue('No file provided')
        try {
            const formData = new FormData()
            formData.append('file', file)
            if (martId) formData.append('martid', martId)
            if (staffId) formData.append('staffid', staffId)
            const res = await api.post('/inventory/bulk', formData)
            if (!res.success) {
                dispatch(showToast({ message: res.message || 'Bulk upload failed', type: 'error' }))
                return rejectWithValue(res.message)
            }
            return res.data
        } catch (err) {
            dispatch(showToast({ message: 'Upload failed.', type: 'error' }))
            return rejectWithValue(err?.message || 'Network error')
        }
    }
)

export const pollBulkJob = createAsyncThunk(
    'inventory/pollBulkJob',
    async (jobId, { rejectWithValue }) => {
        if (!jobId) return rejectWithValue('jobId required')
        try {
            const res = await api.get(`/bulk-jobs/${encodeURIComponent(jobId)}`)
            if (!res.success) return rejectWithValue(res.message || 'Failed to fetch job')
            return res.data
        } catch (err) {
            return rejectWithValue(err?.message || 'Network error')
        }
    }
)

// ── Slice ─────────────────────────────────────────────────────────────────────

const initialState = {
    items: [], loading: false, error: null, lastFetchedMartId: null,

    filteredItems: [], filteredLoading: false, filteredError: null,
    filteredPagination: null,

    summary: null, summaryLoading: false, summaryError: null,

    saving: false, restocking: false,

    dashboard: null, dashboardLoading: false, dashboardError: null, dashboardForMartId: null,

    bulkUploading: false, bulkJob: null,

    itemTxns: {}, itemTxnsLoading: false,
    martTxns: [], martTxnsLoading: false, martTxnsError: null,
}

const inventorySlice = createSlice({
    name: 'inventory',
    initialState,
    reducers: {
        clearInventory: (s) => { s.items = []; s.lastFetchedMartId = null },
        clearFilteredInventory: (s) => { s.filteredItems = []; s.filteredPagination = null; s.filteredError = null },
        clearDashboard: (s) => { s.dashboard = null; s.dashboardForMartId = null },
        clearBulkJob: (s) => { s.bulkJob = null },
        clearItemTxns: (s, a) => { delete s.itemTxns[a.payload] },
        clearMartTxns: (s) => { s.martTxns = [] },
        clearSummary: (s) => { s.summary = null },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchInventory.pending, (s) => { s.loading = true; s.error = null })
            .addCase(fetchInventory.fulfilled, (s, a) => { s.loading = false; s.items = a.payload; s.lastFetchedMartId = a.meta.arg })
            .addCase(fetchInventory.rejected, (s, a) => { s.loading = false; s.error = a.payload })

            .addCase(fetchInventoryFiltered.pending, (s) => { s.filteredLoading = true; s.filteredError = null })
            .addCase(fetchInventoryFiltered.fulfilled, (s, a) => {
                s.filteredLoading = false
                s.filteredItems = a.payload.data
                s.filteredPagination = a.payload.pagination
            })
            .addCase(fetchInventoryFiltered.rejected, (s, a) => {
                s.filteredLoading = false
                s.filteredError = a.payload
                s.filteredItems = []
            })

            .addCase(fetchInventorySummary.pending, (s) => { s.summaryLoading = true; s.summaryError = null })
            .addCase(fetchInventorySummary.fulfilled, (s, a) => { s.summaryLoading = false; s.summary = a.payload })
            .addCase(fetchInventorySummary.rejected, (s, a) => { s.summaryLoading = false; s.summaryError = a.payload; s.summary = null })

            .addCase(fetchInventoryDashboard.pending, (s) => { s.dashboardLoading = true; s.dashboardError = null })
            .addCase(fetchInventoryDashboard.fulfilled, (s, a) => { s.dashboardLoading = false; s.dashboard = a.payload; s.dashboardForMartId = a.meta.arg })
            .addCase(fetchInventoryDashboard.rejected, (s, a) => { s.dashboardLoading = false; s.dashboardError = a.payload; s.dashboard = null })

            .addCase(addInventoryItem.pending, (s) => { s.saving = true })
            .addCase(addInventoryItem.fulfilled, (s, a) => {
                s.saving = false
                if (a.payload) {
                    s.items.unshift(a.payload)
                    s.filteredItems.unshift(a.payload)
                    if (s.filteredPagination) s.filteredPagination.total += 1
                }
            })
            .addCase(addInventoryItem.rejected, (s) => { s.saving = false })

            .addCase(restockInventoryItem.pending, (s) => { s.restocking = true })
            .addCase(restockInventoryItem.fulfilled, (s, a) => {
                s.restocking = false
                if (!a.payload) return
                const sync = (arr) => {
                    const idx = arr.findIndex(i => i.id === a.payload.id)
                    if (idx !== -1) arr[idx] = a.payload
                    else arr.unshift(a.payload)
                }
                sync(s.items)
                sync(s.filteredItems)
            })
            .addCase(restockInventoryItem.rejected, (s) => { s.restocking = false })

            .addCase(updateInventoryItem.fulfilled, (s, a) => {
                const { id, patch, server } = a.payload
                const apply = (arr) => {
                    const idx = arr.findIndex(i => i.id === id)
                    if (idx !== -1) arr[idx] = { ...arr[idx], ...patch, ...(server || {}) }
                }
                apply(s.items)
                apply(s.filteredItems)
            })

            .addCase(toggleInventoryActive.fulfilled, (s, a) => {
                const { id, is_active } = a.payload
                    ;[s.items, s.filteredItems].forEach(arr => {
                        const idx = arr.findIndex(i => i.id === id)
                        if (idx !== -1) arr[idx].is_active = is_active
                    })
            })

            .addCase(deleteInventoryItem.fulfilled, (s, a) => {
                s.items = s.items.filter(i => i.id !== a.payload)
                s.filteredItems = s.filteredItems.filter(i => i.id !== a.payload)
                if (s.filteredPagination) s.filteredPagination.total = Math.max(0, s.filteredPagination.total - 1)
            })

            .addCase(fetchItemTransactions.pending, (s) => { s.itemTxnsLoading = true })
            .addCase(fetchItemTransactions.fulfilled, (s, a) => {
                s.itemTxnsLoading = false
                s.itemTxns[a.payload.id] = a.payload.txns
            })
            .addCase(fetchItemTransactions.rejected, (s) => { s.itemTxnsLoading = false })

            .addCase(fetchMartTransactions.pending, (s) => { s.martTxnsLoading = true; s.martTxnsError = null })
            .addCase(fetchMartTransactions.fulfilled, (s, a) => { s.martTxnsLoading = false; s.martTxns = a.payload })
            .addCase(fetchMartTransactions.rejected, (s, a) => { s.martTxnsLoading = false; s.martTxnsError = a.payload; s.martTxns = [] })

            .addCase(bulkUploadInventory.pending, (s) => { s.bulkUploading = true; s.bulkJob = null })
            .addCase(bulkUploadInventory.fulfilled, (s, a) => { s.bulkUploading = false; s.bulkJob = a.payload })
            .addCase(bulkUploadInventory.rejected, (s) => { s.bulkUploading = false })
            .addCase(pollBulkJob.fulfilled, (s, a) => { s.bulkJob = a.payload })
    },
})

export const {
    clearInventory, clearFilteredInventory, clearDashboard,
    clearBulkJob, clearItemTxns, clearMartTxns, clearSummary,
} = inventorySlice.actions

export default inventorySlice.reducer

// ── Selectors ─────────────────────────────────────────────────────────────────

const root = (s) => s.inventory || initialState

export const selectInventoryItems = (s) => root(s).items
export const selectInventoryLoading = (s) => root(s).loading
export const selectInventorySaving = (s) => root(s).saving
export const selectInventoryRestocking = (s) => root(s).restocking
export const selectInventoryBulkUploading = (s) => root(s).bulkUploading
export const selectInventoryBulkJob = (s) => root(s).bulkJob

export const selectFilteredItems = (s) => root(s).filteredItems
export const selectFilteredLoading = (s) => root(s).filteredLoading
export const selectFilteredError = (s) => root(s).filteredError
export const selectFilteredPagination = (s) => root(s).filteredPagination

export const selectInventorySummary = (s) => root(s).summary
export const selectInventorySummaryLoading = (s) => root(s).summaryLoading

export const selectInventoryDashboard = (s) => root(s).dashboard
export const selectInventoryDashboardLoading = (s) => root(s).dashboardLoading
export const selectInventoryDashboardError = (s) => root(s).dashboardError
export const selectInventoryDashboardForMart = (s) => root(s).dashboardForMartId

export const selectItemTransactions = (s, id) => root(s).itemTxns[id] || []
export const selectItemTransactionsLoading = (s) => root(s).itemTxnsLoading

export const selectMartTransactions = (s) => root(s).martTxns
export const selectMartTransactionsLoading = (s) => root(s).martTxnsLoading
export const selectMartTransactionsError = (s) => root(s).martTxnsError

export const selectInventoryStats = createSelector(
    [selectInventoryItems],
    (items) => ({
        total: items.length,
        outOfStock: items.filter(i => parseFloat(i.stock_qty) <= 0).length,
        lowStock: items.filter(i => {
            const qty = parseFloat(i.stock_qty)
            const alert = parseFloat(i.low_stock_alert)
            return qty > 0 && qty <= alert
        }).length,
        active: items.filter(i => i.is_active).length,
    })
)

export const selectFilteredInventory = createSelector(
    [selectInventoryItems, (_s, search) => search],
    (items, search) => {
        if (!search) return items
        const q = search.toLowerCase()
        return items.filter(it =>
            it.mongo_product_id?.toLowerCase().includes(q) ||
            it.variant_id?.toLowerCase().includes(q) ||
            it.aisle_location?.toLowerCase().includes(q)
        )
    }
)