// src/store/slices/orderSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/index'

export const fetchOrders = createAsyncThunk(
    'order/fetchAll',
    async (params, { rejectWithValue }) => {
        // params can include martId, status, search, page, limit, startDate, endDate, orderType
        const query = new URLSearchParams()
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') query.append(k, v)
        })
        const res = await api.get(`/orders/mart?${query.toString()}`)
        if (!res.success) return rejectWithValue(res.message)
        return { list: res.data, pagination: res.pagination }
    }
)

export const fetchOrderById = createAsyncThunk(
    'order/fetchById',
    async (orderId, { rejectWithValue }) => {
        const res = await api.get(`/orders/${orderId}`)
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

const orderSlice = createSlice({
    name: 'order',
    initialState: {
        list: [],
        pagination: null,
        loading: false,
        error: null,
        filter: '',
    },
    reducers: {
        setOrderFilter: (state, action) => { state.filter = action.payload },
        clearOrderError: (state) => { state.error = null },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchOrders.pending, (state) => { state.loading = true; state.error = null })
            .addCase(fetchOrders.fulfilled, (state, action) => {
                state.loading = false
                state.list = action.payload.list || []
                state.pagination = action.payload.pagination
            })
            .addCase(fetchOrders.rejected, (state, action) => { state.loading = false; state.error = action.payload })

        builder
            .addCase(updateOrderStatus.fulfilled, (state, action) => {
                const idx = state.list.findIndex(o => o.id === action.payload.id)
                if (idx !== -1) state.list[idx] = { ...state.list[idx], ...action.payload }
            })
    },
})

export const selectAllOrders = (state) => state.order.list
export const selectOrderPagination = (state) => state.order.pagination
export const selectOrderLoading = (state) => state.order.loading
export const selectOrderError = (state) => state.order.error
export const selectOrderFilter = (state) => state.order.filter

export const { setOrderFilter, clearOrderError } = orderSlice.actions
export default orderSlice.reducer