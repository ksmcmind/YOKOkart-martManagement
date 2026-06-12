// src/store/slices/staffSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/index'

export const fetchStaff = createAsyncThunk(
    'staff/fetchAll',
    async (martId, { getState, rejectWithValue }) => {
        const cached = getState().staff?.cache?.[martId || 'all']
        if (cached) {
            return cached
        }
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
        cache: {}, // keyed by martId || 'all'
    },
    reducers: {
        clearStaffError: (state) => { state.error = null },
        clearStaffCache: (state) => { state.cache = {}; state.list = [] }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchStaff.pending, (state) => { state.loading = true; state.error = null })
            .addCase(fetchStaff.fulfilled, (state, action) => {
                state.loading = false
                state.list = action.payload || []
                const martIdKey = action.meta.arg || 'all'
                state.cache[martIdKey] = action.payload || []
            })
            .addCase(fetchStaff.rejected, (state, action) => { state.loading = false; state.error = action.payload })
 
        builder
            .addCase(createStaff.fulfilled, (state, action) => {
                state.list.unshift(action.payload)
                state.cache = {} // invalidate cache on creation
            })
 
        builder
            .addCase(updateStaff.fulfilled, (state, action) => {
                const idx = state.list.findIndex(s => s.id === action.payload.id)
                if (idx !== -1) state.list[idx] = action.payload
                state.cache = {} // invalidate cache on update
            })
 
        builder
            .addCase(toggleStaffStatus.fulfilled, (state, action) => {
                const idx = state.list.findIndex(s => s.id === action.payload.id)
                if (idx !== -1) state.list[idx].is_active = action.payload.is_active
                state.cache = {} // invalidate cache on toggle status
            })
    },
})
 
export const selectAllStaff = (state) => state.staff.list
export const selectStaffLoading = (state) => state.staff.loading
export const selectStaffError = (state) => state.staff.error
 
export const { clearStaffError, clearStaffCache } = staffSlice.actions
export default staffSlice.reducer