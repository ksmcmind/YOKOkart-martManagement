// src/store/slices/productSlice.js
//
// Products are GLOBAL catalog items (no mart_id). Only super admin creates/edits them.
// Mart admins don't touch this slice — they work with inventorySlice instead.
//
// Register in your store:
//   import productReducer from './slices/productSlice'
//   reducer: { product: productReducer, ... }

import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit'
import api from '../../api/index'
import { showToast } from './uiSlice'

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchProducts = createAsyncThunk(
  'product/fetchAll',
  async ({ categorySlug = null, subcategorySlug = null, search = '', code = '', brand = '', isActive = '', isVeg = '', page = 1, limit = 50 } = {}, { rejectWithValue }) => {
    try {
      const qs = new URLSearchParams()
      if (categorySlug)    qs.set('categorySlug', categorySlug)
      if (subcategorySlug) qs.set('subcategorySlug', subcategorySlug)
      if (search)          qs.set('search', search)
      if (code)            qs.set('code', code)
      if (brand)           qs.set('brand', brand)
      if (isActive !== '') qs.set('isActive', isActive)
      if (isVeg !== '')    qs.set('isVeg', isVeg)
      qs.set('page',  String(page))
      qs.set('limit', String(limit))

      const res = await api.get(`/products?${qs.toString()}`)
      if (!res.success) return rejectWithValue(res.message || 'Failed to load products')
      return res.data
    } catch (err) {
      return rejectWithValue(err?.message || 'Network error')
    }
  }
)

export const createProduct = createAsyncThunk(
  'product/create',
  async (data, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post('/products', data)
      if (!res.success) {
        dispatch(showToast({ message: res.message || 'Failed to create', type: 'error' }))
        return rejectWithValue(res.message)
      }
      dispatch(showToast({ message: 'Product created!', type: 'success' }))
      return res.data
    } catch (err) {
      dispatch(showToast({ message: 'Network error', type: 'error' }))
      return rejectWithValue(err?.message)
    }
  }
)

export const updateProduct = createAsyncThunk(
  'product/update',
  async ({ id, data, silent = false }, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.patch(`/products/${id}`, data)
      if (!res.success) {
        dispatch(showToast({ message: res.message || 'Update failed', type: 'error' }))
        return rejectWithValue(res.message)
      }
      if (!silent) dispatch(showToast({ message: 'Product updated', type: 'success' }))
      return res.data
    } catch (err) {
      dispatch(showToast({ message: 'Update failed', type: 'error' }))
      return rejectWithValue(err?.message)
    }
  }
)

export const deleteProduct = createAsyncThunk(
  'product/delete',
  async (id, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.delete(`/products/${id}`)
      if (!res.success) return rejectWithValue(res.message)
      dispatch(showToast({ message: 'Product deleted', type: 'success' }))
      return id
    } catch (err) {
      return rejectWithValue(err?.message)
    }
  }
)

export const bulkUploadProducts = createAsyncThunk(
  'product/bulkUpload',
  async (file, { rejectWithValue }) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/products/bulk/upload?type=products', formData)
      if (!res.success) return rejectWithValue(res)
      return res
    } catch (err) {
      return rejectWithValue({ message: err.message })
    }
  }
)

// ── Slice ─────────────────────────────────────────────────────────────────────

const initialState = {
  list:         [],
  pagination:   null,
  loading:      false,
  error:        null,
  saving:       false,
  bulkUploading: false,
  bulkStatus:   null, // { total, done, success, failed }
}

const productSlice = createSlice({
  name: 'product',
  initialState,
  reducers: {
    clearProductError: (state) => { state.error = null },
    setBulkStatus:     (state, action) => { state.bulkStatus = action.payload },
    clearBulkStatus:   (state) => { state.bulkStatus = null },
    clearProducts:     (state) => { state.list = []; state.pagination = null },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending,   (state) => { state.loading = true; state.error = null })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading    = false
        state.list       = action.payload?.products || action.payload || []
        state.pagination = action.payload?.pagination || null
      })
      .addCase(fetchProducts.rejected,  (state, action) => {
        state.loading = false
        state.error   = action.payload
      })

      .addCase(createProduct.pending,   (state) => { state.saving = true })
      .addCase(createProduct.fulfilled, (state, action) => {
        state.saving = false
        if (action.payload) state.list.unshift(action.payload)
      })
      .addCase(createProduct.rejected,  (state) => { state.saving = false })

      .addCase(updateProduct.fulfilled, (state, action) => {
        const p = action.payload
        const idx = state.list.findIndex(x => (x._id || x.id) === (p._id || p.id))
        if (idx !== -1) state.list[idx] = p
      })

      .addCase(deleteProduct.fulfilled, (state, action) => {
        state.list = state.list.filter(p => (p._id || p.id) !== action.payload)
      })

      .addCase(bulkUploadProducts.pending,   (state) => { state.bulkUploading = true })
      .addCase(bulkUploadProducts.fulfilled, (state) => { state.bulkUploading = false })
      .addCase(bulkUploadProducts.rejected,  (state) => { state.bulkUploading = false })
  },
})

export const {
  clearProductError,
  setBulkStatus,
  clearBulkStatus,
  clearProducts,
} = productSlice.actions

export default productSlice.reducer

// ── Selectors ─────────────────────────────────────────────────────────────────

const selectProductState = (state) => state.product || initialState

export const selectAllProducts     = (state) => selectProductState(state).list
export const selectProductLoading  = (state) => selectProductState(state).loading
export const selectProductSaving   = (state) => selectProductState(state).saving
export const selectProductError    = (state) => selectProductState(state).error
export const selectBulkStatus      = (state) => selectProductState(state).bulkStatus
export const selectBulkUploading   = (state) => selectProductState(state).bulkUploading
export const selectPagination      = (state) => selectProductState(state).pagination

// Memoized filtered view
export const selectFilteredProducts = createSelector(
  [selectAllProducts, (_state, search) => search],
  (products, search) => {
    if (!search) return products
    const q = search.toLowerCase()
    return products.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.category_slug?.toLowerCase().includes(q)
    )
  }
)