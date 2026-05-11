// src/store/slices/returnSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/index'

// ── THUNKS ────────────────────────────────────────────────────

export const fetchMartReturns = createAsyncThunk(
    'returns/fetchByMart',
    async ({ martId, status = '', reason = '', page = 1, limit = 20 }, { rejectWithValue }) => {
        try {
            const params = new URLSearchParams({ martId, page, limit })
            if (status) params.append('status', status)
            if (reason) params.append('reason', reason)
            const res = await api.get(`/returns?${params}`)
            if (!res.success) return rejectWithValue(res.message)
            return { list: res.data, pagination: res.pagination }
        } catch (err) { return rejectWithValue(err.message) }
    }
)

export const fetchReturnById = createAsyncThunk(
    'returns/fetchById',
    async (returnId, { rejectWithValue }) => {
        try {
            const res = await api.get(`/returns/${returnId}`)
            if (!res.success) return rejectWithValue(res.message)
            return res.data
        } catch (err) { return rejectWithValue(err.message) }
    }
)

export const approveReturn = createAsyncThunk(
    'returns/approve',
    async ({ returnId, refundMethod, reviewNote }, { rejectWithValue }) => {
        try {
            const res = await api.patch(`/returns/${returnId}/approve`, { refundMethod, reviewNote })
            if (!res.success) return rejectWithValue(res.message)
            return res.data
        } catch (err) { return rejectWithValue(err.message) }
    }
)

export const rejectReturn = createAsyncThunk(
    'returns/reject',
    async ({ returnId, reviewNote }, { rejectWithValue }) => {
        try {
            const res = await api.patch(`/returns/${returnId}/reject`, { reviewNote })
            if (!res.success) return rejectWithValue(res.message)
            return res.data
        } catch (err) { return rejectWithValue(err.message) }
    }
)

// Customer thunks
export const fetchUserReturns = createAsyncThunk(
    'returns/fetchByUser',
    async ({ page = 1, limit = 20 } = {}, { rejectWithValue }) => {
        try {
            const res = await api.get(`/users/me/returns?page=${page}&limit=${limit}`)
            if (!res.success) return rejectWithValue(res.message)
            return res.data
        } catch (err) { return rejectWithValue(err.message) }
    }
)

export const fetchOrderReturns = createAsyncThunk(
    'returns/fetchByOrder',
    async (orderId, { rejectWithValue }) => {
        try {
            const res = await api?.get(`/orders/${orderId}/returns`)
            if (!res.success) return rejectWithValue(res.message)
            return res.data
        } catch (err) { return rejectWithValue(err.message) }
    }
)

export const createReturn = createAsyncThunk(
    'returns/create',
    async ({ orderId, items, reason, notes, images }, { rejectWithValue }) => {
        try {
            const res = await api.post(`/orders/${orderId}/returns`, { items, reason, notes, images })
            if (!res.success) return rejectWithValue(res.message)
            return res.data
        } catch (err) { return rejectWithValue(err.message) }
    }
)

// ── SLICE ─────────────────────────────────────────────────────
const returnSlice = createSlice({
    name: 'returns',
    initialState: {
        list: [],       // mart returns list (manager)
        userList: [],       // user's own returns (customer)
        selected: null,     // currently viewed return detail
        pagination: null,
        loading: false,
        error: null,
    },
    reducers: {
        clearReturnError: (state) => { state.error = null },
        clearSelectedReturn: (state) => { state.selected = null },
    },
    extraReducers: (b) => {

        // fetchMartReturns
        b.addCase(fetchMartReturns?.pending, (s) => { s.loading = true; s.error = null })
        b.addCase(fetchMartReturns?.fulfilled, (s, a) => {
            s.loading = false
            s.list = a.payload?.list || []
            s.pagination = a.payload?.pagination || null
        })
        b.addCase(fetchMartReturns?.rejected, (s, a) => { s.loading = false; s.error = a.payload })

        // fetchReturnById
        b.addCase(fetchReturnById?.pending, (s) => { s.loading = true })
        b.addCase(fetchReturnById?.fulfilled, (s, a) => { s.loading = false; s.selected = a.payload })
        b.addCase(fetchReturnById?.rejected, (s) => { s.loading = false })

        // approveReturn — update in list + selected
        b.addCase(approveReturn.fulfilled, (s, a) => {
            const idx = s.list?.findIndex(r => r.id === a.payload.id)
            if (idx !== -1) s.list[idx] = a.payload
            if (s.selected?.id === a.payload.id) s.selected = a.payload
        })

        // rejectReturn — update in list + selected
        b.addCase(rejectReturn.fulfilled, (s, a) => {
            const idx = s.list?.findIndex(r => r?.id === a?.payload?.id)
            if (idx !== -1) s.list[idx] = a.payload
            if (s.selected?.id === a.payload.id) s.selected = a.payload
        })

        // fetchUserReturns
        b.addCase(fetchUserReturns.fulfilled, (s, a) => { s.userList = a.payload || [] })

        // createReturn — prepend to userList
        b.addCase(createReturn.fulfilled, (s, a) => { s.userList.unshift(a.payload) })
    },
})

// ── SELECTORS ─────────────────────────────────────────────────
export const selectReturnList = (s) => s.returns?.list
export const selectReturnPagination = (s) => s.returns?.pagination
export const selectReturnLoading = (s) => s.returns?.loading
export const selectReturnError = (s) => s.returns?.error
export const selectSelectedReturn = (s) => s.returns?.selected
export const selectUserReturns = (s) => s.returns?.userList

// Computed stats from list
export const selectReturnStats = (s) => {
    const list = s.returns?.list
    return {
        total: list?.length,
        pending: list?.filter(r => r.status === 'pending')?.length,
        approved: list?.filter(r => r.status === 'approved')?.length,
        rejected: list?.filter(r => r.status === 'rejected')?.length,
        totalRefunded: list
            ?.filter(r => r.status === 'approved')
            ?.reduce((sum, r) => sum + parseFloat(r.refund_amount || 0), 0),
    }
}

export const { clearReturnError, clearSelectedReturn } = returnSlice.actions
export default returnSlice.reducer