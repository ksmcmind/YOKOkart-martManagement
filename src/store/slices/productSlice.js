// src/store/slices/productSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/index'

export const fetchProducts = createAsyncThunk(
    'product/fetchAll',
    async ({ martId, categoryId }, { rejectWithValue }) => {
        const res = await api.get(`/products?martId=${martId}&categoryId=${categoryId}&inStockOnly=false`)
        if (!res.success) return rejectWithValue(res.message)
        return res.data
    }
)

export const updateProductStock = createAsyncThunk(
    'product/updateStock',
    async ({ productId, data }, { rejectWithValue }) => {
        const res = await api.patch(`/products/${productId}/stock`, data)
        if (!res.success) return rejectWithValue(res.message)
        return res.data
    }
)

const productSlice = createSlice({
    name: 'product',
    initialState: { list: [], loading: false, error: null },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchProducts.pending, (s) => { s.loading = true; s.error = null })
            .addCase(fetchProducts.fulfilled, (s, a) => { s.loading = false; s.list = a.payload?.products || [] })
            .addCase(fetchProducts.rejected, (s, a) => { s.loading = false; s.error = a.payload })
    },
})

export const selectAllProducts = (s) => s.product.list
export const selectProductLoading = (s) => s.product.loading
export default productSlice.reducer