// src/store/slices/driverSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/index'

export const fetchDrivers = createAsyncThunk(
    'drivers/fetchAll',
    async ({ martId, status } = {}, { rejectWithValue }) => {
        const query = new URLSearchParams()
        if (martId) query.append('martid', martId)   // ✅ lowercase — matches backend req.query.martid
        if (status) query.append('status', status)
        const res = await api.get(`/drivers?${query.toString()}`)
        if (!res.success) return rejectWithValue(res.message)
        return res.data || []
    }
)

export const createDriver = createAsyncThunk(
    'drivers/create',
    async (data, { rejectWithValue }) => {
        const res = await api.post('/drivers', data)
        if (!res.success) return rejectWithValue(res.message)
        return res.data
    }
)

export const updateDriver = createAsyncThunk(
    'drivers/update',
    async ({ id, data }, { rejectWithValue }) => {
        const res = await api.patch(`/drivers/${id}`, data)
        if (!res.success) return rejectWithValue(res.message)
        return res.data
    }
)

// ✅ restored — used by Drivers.jsx Enable/Disable button
export const toggleDriverStatus = createAsyncThunk(
    'drivers/toggle',
    async (driverId, { getState, rejectWithValue }) => {
        // Read current is_active from store, flip it
        const current = getState().drivers.list.find(d => d.id === driverId)
        const newActive = !(current?.isActive ?? current?.is_active)
        const res = await api.patch(`/drivers/${driverId}`, { is_active: newActive })
        if (!res.success) return rejectWithValue(res.message)
        return res.data
    }
)

export const assignDriverToOrder = createAsyncThunk(
    'drivers/assign',
    async ({ orderId, driverId }, { rejectWithValue }) => {
        // ✅ manager assigns via /drivers/assign
        const res = await api.post('/drivers/assign', { orderId, driverId })
        if (!res.success) return rejectWithValue(res.message)
        return res.data
    }
)

const driverSlice = createSlice({
    name: 'drivers',
    initialState: {
        list: [],
        loading: false,
        error: null,
    },
    reducers: {
        clearDriverError: (state) => { state.error = null },
        updateDriverLocation: (state, action) => {
            const { driverId, location } = action.payload
            const idx = state.list.findIndex(d => d.id === driverId)
            if (idx !== -1) state.list[idx].location = location
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchDrivers.pending, (state) => { state.loading = true; state.error = null })
            .addCase(fetchDrivers.fulfilled, (state, action) => { state.loading = false; state.list = action.payload })
            .addCase(fetchDrivers.rejected, (state, action) => { state.loading = false; state.error = action.payload })

        builder
            .addCase(createDriver.fulfilled, (state, action) => {
                state.list.unshift(action.payload)
            })

        builder
            .addCase(updateDriver.fulfilled, (state, action) => {
                const idx = state.list.findIndex(d => d.id === action.payload.id)
                if (idx !== -1) state.list[idx] = action.payload
            })

        builder
            .addCase(toggleDriverStatus.fulfilled, (state, action) => {
                const idx = state.list.findIndex(d => d.id === action.payload.id)
                if (idx !== -1) state.list[idx] = { ...state.list[idx], ...action.payload }
            })

        builder
            .addCase(assignDriverToOrder.fulfilled, (state, action) => {
                const idx = state.list.findIndex(d => d.id === action.payload.driverId)
                // ✅ driver goes to 'assigned' after manager assigns, not 'on_trip'
                if (idx !== -1) state.list[idx].status = 'assigned'
            })
    },
})

export const selectAllDrivers = (state) => state.drivers.list
export const selectDriversLoading = (state) => state.drivers.loading
export const selectDriversError = (state) => state.drivers.error
export const selectAvailableDrivers = (state) =>
    state.drivers.list.filter(d => d.status === 'available' && d.isActive)

export const { clearDriverError, updateDriverLocation } = driverSlice.actions
export default driverSlice.reducer