// src/store/slices/inventorySlice.js
//
// Bulk upload flow (mirrors Products):
//   1. Mart admin picks CSV/XLSX in BulkUploadModal
//   2. File + martId are POSTed as multipart/form-data to /inventory/bulk
//   3. Backend reads martId from the FormData, stamps every row,
//      creates a BulkJob in Mongo, returns { jobId }
//   4. Frontend polls /bulk-jobs/:jobId for progress
//
// Register in store:
//   import inventoryReducer from './slices/inventorySlice'
//   reducer: { inventory: inventoryReducer, ... }

import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit'
import api from '../../api/index'
import { showToast } from './uiSlice'

// ── Normalizer for backend dashboard response ────────────────────────────────
const normalizeDashboard = (raw) => ({
    total_items: Number(raw?.total_items) || 0,
    out_of_stock_count: Number(raw?.out_of_stock_count) || 0,
    low_stock_count: Number(raw?.low_stock_count) || 0,
    out_of_stock_items: Array.isArray(raw?.out_of_stock_items) ? raw.out_of_stock_items : [],
    low_stock_items: Array.isArray(raw?.low_stock_items) ? raw.low_stock_items : [],
})

// ── Fetch thunks ─────────────────────────────────────────────────────────────

export const fetchInventory = createAsyncThunk(
    'inventory/fetchAll',
    async (martId, { rejectWithValue }) => {
        console.log('🅳 [thunk] fetchInventory ENTERED with:', martId, typeof martId)

        if (!martId) {
            console.warn('🅳 [thunk] rejecting — no martId')
            return rejectWithValue('No martId provided')
        }

        try {
            const url = `/inventory?martId=${encodeURIComponent(martId)}`
            console.log('🅴 [thunk] calling API:', url)

            const res = await api.get(url)
            console.log('🅵 [thunk] API response:', res)

            if (!res.success) {
                console.warn('🅵 [thunk] res.success=false:', res)
                return rejectWithValue(res.message || 'Failed to load inventory')
            }
            return res.data || []
        } catch (err) {
            console.error('🅶 [thunk] caught error:', err)
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

// ── Single-item mutations ────────────────────────────────────────────────────

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

// ── Bulk upload ──────────────────────────────────────────────────────────────
//
// Accepts EITHER:
//   bulkUploadInventory(file)              ← backend gets martId from req.user
//   bulkUploadInventory({ file, martId })  ← explicit martId sent with FormData
//
// The backend stamps every CSV row with this martId before inserting.
//
export const bulkUploadInventory = createAsyncThunk(
    'inventory/bulkUpload',
    async (arg, { dispatch, rejectWithValue }) => {
        // 1. Destructure all arguments including staffId
        const file = arg?.file;
        const martId = arg?.martId;
        const staffId = arg?.staffId; 

        if (!file) return rejectWithValue('No file provided');

        try {
            const formData = new FormData();
            formData.append('file', file);
            
            // 2. Append both IDs to the form data
            if (martId) formData.append('mongo_mart_id', martId);
            if (staffId) formData.append('staff_id', staffId); 

            // The api utility handles the Authorization header automatically now
            const res = await api.post('/inventory/bulk', formData);

            if (!res.success) {
                dispatch(showToast({ message: res.message || 'Bulk upload failed', type: 'error' }));
                return rejectWithValue(res.message);
            }
            return res.data;
        } catch (err) {
            dispatch(showToast({ message: 'Upload failed.', type: 'error' }));
            return rejectWithValue(err?.message || 'Network error');
        }
    }
);

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
    items: [], loading: false, error: null, lastFetchedMartId: null, saving: false,
    dashboard: null, dashboardLoading: false, dashboardError: null, dashboardForMartId: null,
    bulkUploading: false, bulkJob: null,
}

const inventorySlice = createSlice({
    name: 'inventory',
    initialState,
    reducers: {
        clearInventory: (s) => { s.items = []; s.lastFetchedMartId = null },
        clearDashboard: (s) => { s.dashboard = null; s.dashboardForMartId = null },
        clearBulkJob: (s) => { s.bulkJob = null },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchInventory.pending, (s) => { s.loading = true; s.error = null })
            .addCase(fetchInventory.fulfilled, (s, a) => {
                s.loading = false; s.items = a.payload; s.lastFetchedMartId = a.meta.arg
            })
            .addCase(fetchInventory.rejected, (s, a) => { s.loading = false; s.error = a.payload })

            .addCase(fetchInventoryDashboard.pending, (s) => { s.dashboardLoading = true; s.dashboardError = null })
            .addCase(fetchInventoryDashboard.fulfilled, (s, a) => {
                s.dashboardLoading = false; s.dashboard = a.payload; s.dashboardForMartId = a.meta.arg
            })
            .addCase(fetchInventoryDashboard.rejected, (s, a) => {
                s.dashboardLoading = false; s.dashboardError = a.payload; s.dashboard = null
            })

            .addCase(addInventoryItem.pending, (s) => { s.saving = true })
            .addCase(addInventoryItem.fulfilled, (s, a) => {
                s.saving = false
                if (a.payload) s.items.unshift(a.payload)
            })
            .addCase(addInventoryItem.rejected, (s) => { s.saving = false })

            .addCase(updateInventoryItem.fulfilled, (s, a) => {
                const { id, patch, server } = a.payload
                const idx = s.items.findIndex(i => i.id === id)
                if (idx !== -1) s.items[idx] = { ...s.items[idx], ...patch, ...(server || {}) }
            })

            .addCase(toggleInventoryActive.fulfilled, (s, a) => {
                const { id, is_active } = a.payload
                const idx = s.items.findIndex(i => i.id === id)
                if (idx !== -1) s.items[idx].is_active = is_active
            })

            .addCase(deleteInventoryItem.fulfilled, (s, a) => {
                s.items = s.items.filter(i => i.id !== a.payload)
            })

            .addCase(bulkUploadInventory.pending, (s) => { s.bulkUploading = true; s.bulkJob = null })
            .addCase(bulkUploadInventory.fulfilled, (s, a) => { s.bulkUploading = false; s.bulkJob = a.payload })
            .addCase(bulkUploadInventory.rejected, (s) => { s.bulkUploading = false })

            .addCase(pollBulkJob.fulfilled, (s, a) => { s.bulkJob = a.payload })
    },
})

export const { clearInventory, clearDashboard, clearBulkJob } = inventorySlice.actions
export default inventorySlice.reducer

// ── Selectors ─────────────────────────────────────────────────────────────────

const root = (s) => s.inventory || initialState

export const selectInventoryItems = (s) => root(s).items
export const selectInventoryLoading = (s) => root(s).loading
export const selectInventorySaving = (s) => root(s).saving
export const selectInventoryBulkUploading = (s) => root(s).bulkUploading
export const selectInventoryBulkJob = (s) => root(s).bulkJob

export const selectInventoryDashboard = (s) => root(s).dashboard
export const selectInventoryDashboardLoading = (s) => root(s).dashboardLoading
export const selectInventoryDashboardError = (s) => root(s).dashboardError
export const selectInventoryDashboardForMart = (s) => root(s).dashboardForMartId

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