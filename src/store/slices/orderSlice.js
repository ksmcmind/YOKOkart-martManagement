// src/store/slices/orderSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/index'

export const fetchOrders = createAsyncThunk(
    'order/fetchAll',
    async ({ martId, status = '' }, { rejectWithValue }) => {
        const res = await api.get(`/orders/mart?martId=${martId}&status=${status}`)
        if (!res.success) return rejectWithValue(res.message)
        return res.data
    }
)

export const updateOrderStatus = createAsyncThunk(
    'order/updateStatus',
    async ({ orderId, status }, { rejectWithValue }) => {
        const res = await api.patch(`/orders/${orderId}/status`, { status })
        if (!res.success) return rejectWithValue(res.message)
        return res.data
    }
)

export const assignDriver = createAsyncThunk(
    'order/assignDriver',
    async ({ orderId, driverId }, { rejectWithValue }) => {
        const res = await api.patch(`/orders/${orderId}/assign-driver`, { driverId })
        if (!res.success) return rejectWithValue(res.message)
        return res.data
    }
)

const orderSlice = createSlice({
    name: 'order',
    initialState: { list: [], loading: false, error: null },
    reducers: {
        clearOrderError: (s) => { s.error = null },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchOrders.pending, (s) => { s.loading = true; s.error = null })
            .addCase(fetchOrders.fulfilled, (s, a) => { s.loading = false; s.list = a.payload || [] })
            .addCase(fetchOrders.rejected, (s, a) => { s.loading = false; s.error = a.payload })

        builder
            .addCase(updateOrderStatus.fulfilled, (s, a) => {
                const idx = s.list.findIndex(o => o.id === a.payload.id)
                if (idx !== -1) s.list[idx] = { ...s.list[idx], ...a.payload }
            })
    },
})

export const selectAllOrders = (s) => s.order.list
export const selectOrderLoading = (s) => s.order.loading
export const { clearOrderError } = orderSlice.actions
export default orderSlice.reducer