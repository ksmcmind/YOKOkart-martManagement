// src/store/slices/martSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/index'

// ── Thunks ────────────────────────────────────────────────────
export const fetchMarts = createAsyncThunk(
  'mart/fetchAll',
  async (_, { rejectWithValue }) => {
    const res = await api.get('/marts')
    if (!res.success) return rejectWithValue(res.message)
    return res.data
  },
  {
    condition: (_, { getState }) => {
      const { mart } = getState()
      if (mart.list.length > 0 && !mart.loading) {
        return false // Already have data, skip redundant call
      }
    }
  }
)

export const fetchMartById = createAsyncThunk(
  'mart/fetchById',
  async (id, { rejectWithValue }) => {
    const res = await api.get(`/marts/${id}`)
    if (!res.success) return rejectWithValue(res.message)
    return res.data
  }
)

export const createMart = createAsyncThunk(
  'mart/create',
  async (data, { rejectWithValue }) => {
    const res = await api.post('/marts', data)
    if (!res.success) return rejectWithValue(res.message)
    return res.data
  }
)

export const toggleMartStatus = createAsyncThunk(
  'mart/toggle',
  async (martId, { rejectWithValue }) => {
    const res = await api.patch(`/marts/${martId}/toggle`)
    if (!res.success) return rejectWithValue(res.message)
    return res.data
  }
)

export const updateMart = createAsyncThunk(
  'mart/update',
  async ({ id, data }, { rejectWithValue }) => {
    const res = await api.patch(`/marts/${id}`, data)
    if (!res.success) return rejectWithValue(res.message)
    return res.data
  }
)

export const setMartStatus = createAsyncThunk(
  'mart/setStatus',
  async ({ id, status }, { rejectWithValue }) => {
    const res = await api.patch(`/marts/${id}/status`, { status })
    if (!res.success) return rejectWithValue(res.message)
    return res.data
  }
)

// ── Slice ─────────────────────────────────────────────────────
const martSlice = createSlice({
  name: 'mart',
  initialState: {
    list: [],
    selected: null,
    loading: false,
    error: null,
  },
  reducers: {
    setSelectedMart: (state, action) => { state.selected = action.payload },
    clearMartError: (state) => { state.error = null },
  },
  extraReducers: (builder) => {
    // Fetch all
    builder
      .addCase(fetchMarts.pending, (state) => {
        state.loading = true; state.error = null
      })
      .addCase(fetchMarts.fulfilled, (state, action) => {
        state.loading = false
        state.list = Array.isArray(action.payload) ? action.payload : []
      })
      .addCase(fetchMarts.rejected, (state, action) => {
        state.loading = false; state.error = action.payload
      })

    // Fetch by id
    builder.addCase(fetchMartById.fulfilled, (state, action) => {
      state.selected = action.payload
      const idx = state.list.findIndex(m => m.id === action.payload.id)
      if (idx !== -1) state.list[idx] = action.payload
    })

    // Create
    builder.addCase(createMart.fulfilled, (state, action) => {
      state.list.unshift(action.payload)
    })

    // Toggle status — replace whole row (backend returns full mart)
    builder.addCase(toggleMartStatus.fulfilled, (state, action) => {
      const idx = state.list.findIndex(m => m.id === action.payload.id)
      if (idx !== -1) state.list[idx] = action.payload
    })

    // Set status
    builder.addCase(setMartStatus.fulfilled, (state, action) => {
      const idx = state.list.findIndex(m => m.id === action.payload.id)
      if (idx !== -1) state.list[idx] = action.payload
    })

    // Update
    builder.addCase(updateMart.fulfilled, (state, action) => {
      const idx = state.list.findIndex(m => m.id === action.payload.id)
      if (idx !== -1) state.list[idx] = action.payload
    })
  },
})

// ── Selectors ─────────────────────────────────────────────────
export const selectAllMarts = (state) => state.mart.list
export const selectSelectedMart = (state) => state.mart.selected
export const selectMartsLoading = (state) => state.mart.loading
export const selectMartsError = (state) => state.mart.error
export const selectOpenMarts = (state) =>
  state.mart.list.filter(m => m.status === 'open' && m.is_active)

export const { setSelectedMart, clearMartError } = martSlice.actions
export default martSlice.reducer