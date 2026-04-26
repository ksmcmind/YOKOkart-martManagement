// src/store/slices/orderSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/index'

// ── Async thunks ──────────────────────────────────────────────

// Fetch ALL orders — store in Redux, filter client-side on tab switch
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

// Fetch mart stats (today by default)
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

// Update order status — updates Redux store immediately (optimistic)
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

// Confirm order
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

// Assign driver
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

// ── Slice ─────────────────────────────────────────────────────
const orderSlice = createSlice({
    name: 'order',
    initialState: {
        list: [],      // all orders — filtered client-side
        stats: null,    // mart dashboard stats
        loading: false,
        statsLoading: false,
        error: null,
    },
    reducers: {
        clearOrderError: (s) => { s.error = null },

        // Optimistically update a single order in the list
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

        // ── updateOrderStatus ─────────────────────────────────────
        // Update the order in list without refetching everything
        builder
            .addCase(updateOrderStatus.fulfilled, (s, a) => {
                const idx = s.list.findIndex(o => o.id === a.payload.id)
                if (idx !== -1) s.list[idx] = { ...s.list[idx], ...a.payload }
            })

        // ── confirmOrder ──────────────────────────────────────────
        builder
            .addCase(confirmOrder.fulfilled, (s, a) => {
                const idx = s.list.findIndex(o => o.id === a.payload.id)
                if (idx !== -1) s.list[idx] = { ...s.list[idx], ...a.payload }
            })

        // ── assignDriver ──────────────────────────────────────────
        builder
            .addCase(assignDriver.fulfilled, (s, a) => {
                const idx = s.list.findIndex(o => o.id === a.payload.id)
                if (idx !== -1) s.list[idx] = { ...s.list[idx], ...a.payload }
            })
    },
})

// ── Selectors ─────────────────────────────────────────────────
export const selectAllOrders = (s) => s.order.list
export const selectOrderLoading = (s) => s.order.loading
export const selectOrderStats = (s) => s.order.stats

// Client-side filter — no API call on tab switch ✅
export const selectOrdersByStatus = (s, status) =>
    status
        ? s.order.list.filter(o => o.status === status)
        : s.order.list

// Count by status — for badges
export const selectOrderCountByStatus = (s, status) =>
    s.order.list.filter(o => o.status === status).length

export const { clearOrderError, updateOrderInList } = orderSlice.actions
export default orderSlice.reducer