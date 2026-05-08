// src/store/slices/driverSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/index'

export const fetchDrivers = createAsyncThunk(
    'drivers/fetchAll',
    async (martId, { rejectWithValue }) => {
        const url = martId ? `/drivers?martid=${martId}` : '/drivers'
        const res = await api.get(url)
        if (!res.success) return rejectWithValue(res.message)
        return res.data
    }
)

export const fetchAvailableDrivers = createAsyncThunk(
    'drivers/fetchAvailable',
    async ({ martId } = {}, { rejectWithValue }) => {
        const url = martId ? `/drivers/available?martid=${martId}` : '/drivers/available'
        const res = await api.get(url)
        if (!res.success) return rejectWithValue(res.message)
        return res.data
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

export const toggleDriverStatus = createAsyncThunk(
    'drivers/toggle',
    async (driverId, { rejectWithValue }) => {
        const res = await api.patch(`/drivers/${driverId}/toggle`)
        if (!res.success) return rejectWithValue(res.message)
        return res.data
    }
)

export const assignDriverToOrder = createAsyncThunk(
    'drivers/assign',
    async ({ orderId, driverId }, { rejectWithValue }) => {
        const res = await api.post('/orders/assign', { orderId, driverId })  // ← fixed URL
        if (!res.success) return rejectWithValue(res.message)
        return res.data
    }
)

const driverSlice = createSlice({
    name: 'drivers',
    initialState: {
        list: [],
        loading: false,
        availableLoading: false,
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
            .addCase(fetchDrivers.fulfilled, (state, action) => {
                state.loading = false
                state.list = action.payload || []
            })
            .addCase(fetchDrivers.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload
            })

        builder
            .addCase(fetchAvailableDrivers.pending, (state) => { state.availableLoading = true; state.error = null })
            .addCase(fetchAvailableDrivers.fulfilled, (state, action) => {
                state.availableLoading = false
                const newDrivers = action.payload || []
                newDrivers.forEach(d => {
                    const idx = state.list.findIndex(x => x.id === d.id)
                    if (idx !== -1) state.list[idx] = d
                    else state.list.push(d)
                })
            })
            .addCase(fetchAvailableDrivers.rejected, (state, action) => {
                state.availableLoading = false
                state.error = action.payload
            })

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
                if (idx !== -1) state.list[idx].is_active = action.payload.is_active
            })

        builder
            .addCase(assignDriverToOrder.fulfilled, (state, action) => {
                const idx = state.list.findIndex(d => d.id === action.payload.driverId)
                if (idx !== -1) state.list[idx].status = 'on_trip'
            })
            .addCase('order/assignDriver/fulfilled', (state, action) => {
                const idx = state.list.findIndex(d => d.id === action.payload.driverId)
                if (idx !== -1) state.list[idx].status = 'on_trip'
            })
    },
})

export const selectAllDrivers = (state) => state.drivers.list || [];
export const selectDriversLoading = (state) => state.drivers.loading;
export const selectDriversError = (state) => state.drivers.error;
export const selectAvailableDrivers = (state) =>
    state.drivers.list.filter(d => d.status === 'available' && d.is_active) || [];
export const selectAvailableDriversLoading = (state) => state.drivers.availableLoading;

export const { clearDriverError, updateDriverLocation } = driverSlice.actions
export default driverSlice.reducer