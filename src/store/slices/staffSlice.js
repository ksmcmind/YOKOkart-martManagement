// src/store/slices/staffSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/index'

export const fetchStaff = createAsyncThunk(
    'staff/fetchAll',
    async (martId, { rejectWithValue }) => {
        const url = martId ? `/staff?martId=${martId}` : `/staff`
        const res = await api.get(url)
        if (!res.success) return rejectWithValue(res.message)
        return res.data
    }
)

export const createStaff = createAsyncThunk(
    'staff/create',
    async (data, { rejectWithValue }) => {
        const res = await api.post('/staff', data)
        if (!res.success) return rejectWithValue(res.message)
        return res.data
    }
)

export const updateStaff = createAsyncThunk(
    'staff/update',
    async ({ id, data }, { rejectWithValue }) => {
        const res = await api.patch(`/staff/${id}`, data)
        if (!res.success) return rejectWithValue(res.message)
        return res.data
    }
)

export const toggleStaffStatus = createAsyncThunk(
    'staff/toggle',
    async (staffId, { rejectWithValue }) => {
        const res = await api.patch(`/staff/${staffId}/toggle`)
        if (!res.success) return rejectWithValue(res.message)
        return res.data
    }
)

const staffSlice = createSlice({
    name: 'staff',
    initialState: {
        list: [],
        loading: false,
        error: null,
    },
    reducers: {
        clearStaffError: (state) => { state.error = null },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchStaff.pending, (state) => { state.loading = true; state.error = null })
            .addCase(fetchStaff.fulfilled, (state, action) => {
                state.loading = false
                state.list = action.payload || []
            })
            .addCase(fetchStaff.rejected, (state, action) => { state.loading = false; state.error = action.payload })

        builder
            .addCase(createStaff.fulfilled, (state, action) => {
                state.list.unshift(action.payload)
            })

        builder
            .addCase(updateStaff.fulfilled, (state, action) => {
                const idx = state.list.findIndex(s => s.id === action.payload.id)
                if (idx !== -1) state.list[idx] = action.payload
            })

        builder
            .addCase(toggleStaffStatus.fulfilled, (state, action) => {
                const idx = state.list.findIndex(s => s.id === action.payload.id)
                if (idx !== -1) state.list[idx].is_active = action.payload.is_active
            })
    },
})

export const selectAllStaff = (state) => state.staff.list
export const selectStaffLoading = (state) => state.staff.loading
export const selectStaffError = (state) => state.staff.error

export const { clearStaffError } = staffSlice.actions
export default staffSlice.reducer