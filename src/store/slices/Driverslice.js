// src/store/slices/driverSlice.js
//
// Minimal slice — just enough to populate the driver dropdown when assigning
// orders. If you already have a fuller driver slice, delete this file and
// import `selectAvailableDrivers` / `fetchDrivers` from yours instead.
//
// Endpoints assumed (adjust if your backend differs):
//   GET /api/drivers/available?martId=...   → list of drivers ready to deliver

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/index'

export const fetchAvailableDrivers = createAsyncThunk(
    'drivers/fetchAvailable',
    async ({ martId } = {}, { rejectWithValue }) => {
        try {
            const url = martId
                ? `/drivers/available?martId=${encodeURIComponent(martId)}`
                : `/drivers/available`
            const res = await api.get(url)
            if (!res.success) return rejectWithValue(res.message)
            return res.data || []
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

const driverSlice = createSlice({
    name: 'drivers',
    initialState: {
        available: [],     // [{ id, name, phone, vehicle_number, is_online, ... }]
        loading: false,
        error: null,
    },
    reducers: {
        clearDrivers: (s) => { s.available = [] },
    },
    extraReducers: (b) => {
        b
            .addCase(fetchAvailableDrivers.pending, (s) => { s.loading = true; s.error = null })
            .addCase(fetchAvailableDrivers.fulfilled, (s, a) => { s.loading = false; s.available = a.payload })
            .addCase(fetchAvailableDrivers.rejected, (s, a) => { s.loading = false; s.error = a.payload })
    },
})

export const selectAvailableDrivers = (s) => s.drivers?.available || []
export const selectAvailableDriversLoading = (s) => s.drivers?.loading || false

export const { clearDrivers } = driverSlice.actions
export default driverSlice.reducer