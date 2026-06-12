import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/index'

// ── THUNKS FOR TRANSFERS ──────────────────────────────────────────────────
export const fetchTransfers = createAsyncThunk(
  'transfers/fetchByMart',
  async (martId, { rejectWithValue }) => {
    try {
      const res = await api.get(`/warehouse-transfers/mart/${martId}`)
      if (!res.success) return rejectWithValue(res.message || 'Failed to load transfers')
      return res.data || []
    } catch (err) {
      return rejectWithValue(err.message)
    }
  }
)

export const createTransferRequest = createAsyncThunk(
  'transfers/createRequest',
  async ({ warehouseId, martId, productId, variantId, qtyDispatched, notes }, { rejectWithValue }) => {
    try {
      const res = await api.post('/warehouse-transfers', {
        warehouseId,
        martId,
        productId,
        variantId,
        qtyDispatched,
        notes
      })
      if (!res.success) return rejectWithValue(res.message || 'Request failed')
      return res.data
    } catch (err) {
      return rejectWithValue(err.message)
    }
  }
)

export const cancelTransferRequest = createAsyncThunk(
  'transfers/cancelRequest',
  async (transferId, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/warehouse-transfers/${transferId}/cancel`)
      if (!res.success) return rejectWithValue(res.message || 'Cancellation failed')
      return { transferId, data: res.data }
    } catch (err) {
      return rejectWithValue(err.message)
    }
  }
)

export const receiveTransferCargo = createAsyncThunk(
  'transfers/receiveCargo',
  async ({ transferId, qtyReceived }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/warehouse-transfers/${transferId}/receive`, { qtyReceived })
      if (!res.success) return rejectWithValue(res.message || 'Confirmation failed')
      return { transferId, data: res.data }
    } catch (err) {
      return rejectWithValue(err.message)
    }
  }
)

// ── THUNKS FOR RETURNS ────────────────────────────────────────────────────
export const fetchReturns = createAsyncThunk(
  'transfers/fetchReturns',
  async (martId, { rejectWithValue }) => {
    try {
      const res = await api.get(`/mart-returns/mart/${martId}`)
      if (!res.success) return rejectWithValue(res.message || 'Failed to load returns')
      return res.data || []
    } catch (err) {
      return rejectWithValue(err.message)
    }
  }
)

export const fetchReturnBatches = createAsyncThunk(
  'transfers/fetchReturnBatches',
  async (martId, { rejectWithValue }) => {
    try {
      const res = await api.get(`/mart-returns/mart/${martId}/batches`)
      if (!res.success) return rejectWithValue(res.message || 'Failed to load returnable batches')
      return res.data || []
    } catch (err) {
      return rejectWithValue(err.message)
    }
  }
)

export const createReturnRequest = createAsyncThunk(
  'transfers/createReturnRequest',
  async ({ martId, martBatchId, qty, reason, notes }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/mart-returns/mart/${martId}`, {
        martBatchId,
        qty,
        reason,
        notes
      })
      if (!res.success) return rejectWithValue(res.message || 'Return request failed')
      return res.data
    } catch (err) {
      return rejectWithValue(err.message)
    }
  }
)

export const cancelReturnRequest = createAsyncThunk(
  'transfers/cancelReturn',
  async (returnId, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/mart-returns/${returnId}/cancel`)
      if (!res.success) return rejectWithValue(res.message || 'Cancellation failed')
      return { returnId, data: res.data }
    } catch (err) {
      return rejectWithValue(err.message)
    }
  }
)

export const dispatchReturnCargo = createAsyncThunk(
  'transfers/dispatchReturn',
  async (returnId, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/mart-returns/${returnId}/dispatch`)
      if (!res.success) return rejectWithValue(res.message || 'Dispatch failed')
      return { returnId, data: res.data }
    } catch (err) {
      return rejectWithValue(err.message)
    }
  }
)

// ── SLICE ─────────────────────────────────────────────────────────────────
const transferSlice = createSlice({
  name: 'transfers',
  initialState: {
    transfers: [],
    returns: [],
    returnBatches: [],
    loading: false,
    returnsLoading: false,
    submitting: false,
    error: null
  },
  reducers: {
    clearTransferError: (state) => {
      state.error = null
    }
  },
  extraReducers: (builder) => {
    // fetchTransfers
    builder
      .addCase(fetchTransfers.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchTransfers.fulfilled, (state, action) => {
        state.loading = false
        state.transfers = action.payload
      })
      .addCase(fetchTransfers.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

    // createTransferRequest
    builder
      .addCase(createTransferRequest.pending, (state) => {
        state.submitting = true
      })
      .addCase(createTransferRequest.fulfilled, (state, action) => {
        state.submitting = false
        state.transfers.unshift(action.payload)
      })
      .addCase(createTransferRequest.rejected, (state) => {
        state.submitting = false
      })

    // cancelTransferRequest
    builder
      .addCase(cancelTransferRequest.pending, (state) => {
        state.submitting = true
      })
      .addCase(cancelTransferRequest.fulfilled, (state, action) => {
        state.submitting = false
        const idx = state.transfers.findIndex(t => t.transfer_id === action.payload.transferId)
        if (idx !== -1) {
          state.transfers[idx] = { ...state.transfers[idx], status: 'cancelled' }
        }
      })
      .addCase(cancelTransferRequest.rejected, (state) => {
        state.submitting = false
      })

    // receiveTransferCargo
    builder
      .addCase(receiveTransferCargo.pending, (state) => {
        state.submitting = true
      })
      .addCase(receiveTransferCargo.fulfilled, (state, action) => {
        state.submitting = false
        const idx = state.transfers.findIndex(t => t.transfer_id === action.payload.transferId)
        if (idx !== -1) {
          state.transfers[idx] = { ...state.transfers[idx], status: 'received', qty_received: action.payload.data?.qty_received }
        }
      })
      .addCase(receiveTransferCargo.rejected, (state) => {
        state.submitting = false
      })

    // fetchReturns
    builder
      .addCase(fetchReturns.pending, (state) => {
        state.returnsLoading = true
        state.error = null
      })
      .addCase(fetchReturns.fulfilled, (state, action) => {
        state.returnsLoading = false
        state.returns = action.payload
      })
      .addCase(fetchReturns.rejected, (state, action) => {
        state.returnsLoading = false
        state.error = action.payload
      })

    // fetchReturnBatches
    builder
      .addCase(fetchReturnBatches.fulfilled, (state, action) => {
        state.returnBatches = action.payload
      })

    // createReturnRequest
    builder
      .addCase(createReturnRequest.pending, (state) => {
        state.submitting = true
      })
      .addCase(createReturnRequest.fulfilled, (state, action) => {
        state.submitting = false
        state.returns.unshift(action.payload)
      })
      .addCase(createReturnRequest.rejected, (state) => {
        state.submitting = false
      })

    // cancelReturnRequest
    builder
      .addCase(cancelReturnRequest.pending, (state) => {
        state.submitting = true
      })
      .addCase(cancelReturnRequest.fulfilled, (state, action) => {
        state.submitting = false
        const idx = state.returns.findIndex(r => r.return_id === action.payload.returnId)
        if (idx !== -1) {
          state.returns[idx] = { ...state.returns[idx], status: 'cancelled' }
        }
      })
      .addCase(cancelReturnRequest.rejected, (state) => {
        state.submitting = false
      })

    // dispatchReturnCargo
    builder
      .addCase(dispatchReturnCargo.pending, (state) => {
        state.submitting = true
      })
      .addCase(dispatchReturnCargo.fulfilled, (state, action) => {
        state.submitting = false
        const idx = state.returns.findIndex(r => r.return_id === action.payload.returnId)
        if (idx !== -1) {
          state.returns[idx] = { ...state.returns[idx], status: 'dispatched' }
        }
      })
      .addCase(dispatchReturnCargo.rejected, (state) => {
        state.submitting = false
      })
  }
})

export const { clearTransferError } = transferSlice.actions
export default transferSlice.reducer
