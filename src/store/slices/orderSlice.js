// src/store/slices/orderSlice.js
//
// Extends your existing slice with:
//   - fetchOrderDetail        (GET /api/orders/:id)
//   - fetchOrderTransactions  (GET /api/orders/:id/transactions)
//   - cancelOrder             (POST /api/orders/:id/cancel)
//   - packOrderItem           (PATCH /api/orders/:id/items/:itemId/pack)
//
// Existing thunks kept exactly as-is.

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/index'

// ── Existing thunks (unchanged) ──────────────────────────────────────────────

export const fetchOrders = createAsyncThunk(
    'order/fetchAll',
    async ({ martId, status = '' }, { rejectWithValue }) => {
        try {
            const url = status
                ? `/orders/mart?martId=${martId}&status=${status}`
                : `/orders/mart?martId=${martId}`
            const res = await api.get(url)
            if (!res.success) return rejectWithValue(res.message)
            return res.data
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

export const fetchOrderStats = createAsyncThunk(
    'order/fetchStats',
    async ({ martId, range = '1 day' }, { rejectWithValue }) => {
        try {
            const res = await api.get(`/orders/mart/stats?martId=${martId}&range=${range}`)
            if (!res.success) return rejectWithValue(res.message)
            return res.data
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

export const updateOrderStatus = createAsyncThunk(
    'order/updateStatus',
    async ({ orderId, status, reason }, { rejectWithValue }) => {
        try {
            const res = await api.patch(`/orders/${orderId}/status`, { status, reason })
            if (!res.success) return rejectWithValue(res.message)
            return res.data
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

export const confirmOrder = createAsyncThunk(
    'order/confirm',
    async ({ orderId }, { rejectWithValue }) => {
        try {
            const res = await api.patch(`/orders/${orderId}/confirm`)
            if (!res.success) return rejectWithValue(res.message)
            return res.data
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

export const assignDriver = createAsyncThunk(
    'order/assignDriver',
    async ({ orderId, driverId }, { rejectWithValue }) => {
        try {
            const res = await api.patch(`/orders/${orderId}/assign-driver`, { driverId })
            if (!res.success) return rejectWithValue(res.message)
            return res.data
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

// ── NEW thunks ───────────────────────────────────────────────────────────────

// Fetch full order detail (with items) for the detail modal
export const fetchOrderDetail = createAsyncThunk(
    'order/fetchDetail',
    async (orderId, { rejectWithValue }) => {
        if (!orderId) return rejectWithValue('orderId required')
        try {
            const res = await api.get(`/orders/${orderId}`)
            if (!res.success) return rejectWithValue(res.message)
            return res.data
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

// Fetch stock movements caused by an order (audit trail)
export const fetchOrderTransactions = createAsyncThunk(
    'order/fetchTransactions',
    async (orderId, { rejectWithValue }) => {
        if (!orderId) return rejectWithValue('orderId required')
        try {
            const res = await api.get(`/orders/${orderId}/transactions`)
            if (!res.success) return rejectWithValue(res.message)
            return { orderId, txns: res.data || [] }
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

// Cancel an order (reason required — backend enforces)
export const cancelOrder = createAsyncThunk(
    'order/cancel',
    async ({ orderId, reason }, { rejectWithValue }) => {
        if (!reason || !reason.trim()) return rejectWithValue('reason required')
        try {
            const res = await api.post(`/orders/${orderId}/cancel`, { reason: reason.trim() })
            if (!res.success) return rejectWithValue(res.message)
            return res.data
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

// Mark a single line item as packed (auto-advances order to 'packed' when all done)
export const packOrderItem = createAsyncThunk(
    'order/packItem',
    async ({ orderId, itemId }, { rejectWithValue }) => {
        try {
            const res = await api.patch(`/orders/${orderId}/items/${itemId}/pack`)
            if (!res.success) return rejectWithValue(res.message)
            return { orderId, ...res.data }   // { orderId, item, orderFullyPacked }
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

// ── Slice ─────────────────────────────────────────────────────
const orderSlice = createSlice({
    name: 'order',
    initialState: {
        list: [],
        stats: null,
        detail: null,                 // full order with items (for modal)
        detailLoading: false,
        txnsByOrder: {},              // { [orderId]: [txn, ...] }
        loading: false,
        statsLoading: false,
        error: null,
    },
    reducers: {
        clearOrderError: (s) => { s.error = null },
        clearOrderDetail: (s) => { s.detail = null },

        updateOrderInList: (s, a) => {
            const idx = s.list.findIndex(o => o.id === a.payload.id)
            if (idx !== -1) s.list[idx] = { ...s.list[idx], ...a.payload }
        },
    },
    extraReducers: (builder) => {
        // ── fetchOrders ──────────────────────────────────────────
        builder
            .addCase(fetchOrders.pending, (s) => { s.loading = true; s.error = null })
            .addCase(fetchOrders.fulfilled, (s, a) => {
                s.loading = false
                s.list = a.payload || []
            })
            .addCase(fetchOrders.rejected, (s, a) => {
                s.loading = false
                s.error = a.payload
            })

        // ── fetchOrderStats ───────────────────────────────────────
        builder
            .addCase(fetchOrderStats.pending, (s) => { s.statsLoading = true })
            .addCase(fetchOrderStats.fulfilled, (s, a) => {
                s.statsLoading = false
                s.stats = a.payload
            })
            .addCase(fetchOrderStats.rejected, (s) => { s.statsLoading = false })

        // ── fetchOrderDetail ──────────────────────────────────────
        builder
            .addCase(fetchOrderDetail.pending, (s) => { s.detailLoading = true })
            .addCase(fetchOrderDetail.fulfilled, (s, a) => {
                s.detailLoading = false
                s.detail = a.payload
            })
            .addCase(fetchOrderDetail.rejected, (s) => { s.detailLoading = false })

        // ── fetchOrderTransactions ────────────────────────────────
        builder
            .addCase(fetchOrderTransactions.fulfilled, (s, a) => {
                s.txnsByOrder[a.payload.orderId] = a.payload.txns
            })

        // ── Mutations: keep list AND detail in sync ───────────────
        const syncOrder = (s, payload) => {
            const id = payload?.id || payload?.orderId;
            if (!id) return
            const idx = s.list.findIndex(o => o.id === id)
            if (idx !== -1) s.list[idx] = { ...s.list[idx], ...payload }
            if (s.detail?.id === id) {
                s.detail = { ...s.detail, ...payload }
            }
        }

        builder
            .addCase(updateOrderStatus.fulfilled, (s, a) => syncOrder(s, a.payload))
            .addCase(confirmOrder.fulfilled, (s, a) => syncOrder(s, a.payload))
            .addCase(assignDriver.fulfilled, (s, a) => syncOrder(s, { ...a.payload, status: 'assigned' }))
            .addCase(cancelOrder.fulfilled, (s, a) => syncOrder(s, a.payload))

        // ── packOrderItem ─────────────────────────────────────────
        builder
            .addCase(packOrderItem.fulfilled, (s, a) => {
                const { orderId, item, orderFullyPacked } = a.payload
                // Update the line item inside detail.items[]
                if (s.detail?.id === orderId && Array.isArray(s.detail.items)) {
                    const idx = s.detail.items.findIndex(i => i.id === item.id)
                    if (idx !== -1) s.detail.items[idx] = { ...s.detail.items[idx], ...item }
                }
                // If all items are packed, the backend advanced status to 'packed'
                if (orderFullyPacked) {
                    if (s.detail?.id === orderId) s.detail.status = 'packed'
                    const lIdx = s.list.findIndex(o => o.id === orderId)
                    if (lIdx !== -1) s.list[lIdx].status = 'packed'
                }
            })
    },
})

// ── Selectors ─────────────────────────────────────────────────
export const selectAllOrders = (s) => s.order.list
export const selectOrderLoading = (s) => s.order.loading
export const selectOrderStats = (s) => s.order.stats
export const selectOrderDetail = (s) => s.order.detail
export const selectOrderDetailLoading = (s) => s.order.detailLoading
export const selectOrderTxns = (s, orderId) => s.order.txnsByOrder[orderId] || []

export const selectOrdersByStatus = (s, status) =>
    status
        ? s.order.list.filter(o => o.status === status)
        : s.order.list

export const selectOrderCountByStatus = (s, status) =>
    s.order.list.filter(o => o.status === status).length

export const {
    clearOrderError, clearOrderDetail, updateOrderInList,
} = orderSlice.actions
export default orderSlice.reducer