// src/store/slices/categorySlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/index'

// ── Categories ────────────────────────────────────────────────
export const fetchCategories = createAsyncThunk(
    'categories/fetchAll',
    async (_, { rejectWithValue }) => {
        const res = await api.get('/categories')
        if (!res.success) return rejectWithValue(res.message)
        return res.data
    }
)

export const createCategory = createAsyncThunk(
    'categories/create',
    async (data, { rejectWithValue }) => {
        const res = await api.post('/categories', data)
        if (!res.success) return rejectWithValue(res.message)
        return res.data
    }
)

export const updateCategory = createAsyncThunk(
    'categories/update',
    async ({ id, data }, { rejectWithValue }) => {
        const res = await api.patch(`/categories/${id}`, data)
        if (!res.success) return rejectWithValue(res.message)
        return res.data
    }
)

export const deleteCategory = createAsyncThunk(
    'categories/delete',
    async (id, { rejectWithValue }) => {
        const res = await api.delete(`/categories/${id}`)
        if (!res.success) return rejectWithValue(res.message)
        return id
    }
)

// ── Subcategories ─────────────────────────────────────────────
export const bulkUploadCategories = createAsyncThunk(
    'categories/bulkUpload',
    async (arg, { dispatch, rejectWithValue }) => {
        const { file, staffId } = arg; // Ensure arg is an object { file, staffId }
        if (!file) return rejectWithValue('No file provided');

        try {
            const formData = new FormData();
            formData.append('file', file);
            if (staffId) formData.append('staffId', staffId);

            // CHANGE: Removed '/upload' from the path and kept it consistent with category.routes.js
            const res = await api.post('/categories/bulk', formData);

            if (!res.success) {
                dispatch(showToast({ message: res.message || 'Bulk upload failed', type: 'error' }));
                return rejectWithValue(res.message);
            }

            dispatch(showToast({ message: 'Bulk upload queued successfully', type: 'success' }));
            return res.data;
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'Bulk upload failed';
            dispatch(showToast({ message: errorMsg, type: 'error' }));
            return rejectWithValue(errorMsg);
        }
    }
);

export const addSubcategory = createAsyncThunk(
    'categories/addSub',
    async ({ categoryId, data }, { rejectWithValue }) => {
        const res = await api.post(`/categories/${categoryId}/subcategories`, data)
        if (!res.success) return rejectWithValue(res.message)
        return res.data
    }
)

export const updateSubcategory = createAsyncThunk(
    'categories/updateSub',
    async ({ categoryId, subId, data }, { rejectWithValue }) => {
        const res = await api.patch(`/categories/${categoryId}/subcategories/${subId}`, data)
        if (!res.success) return rejectWithValue(res.message)
        return res.data
    }
)

export const deleteSubcategory = createAsyncThunk(
    'categories/deleteSub',
    async ({ categoryId, subId }, { rejectWithValue }) => {
        const res = await api.delete(`/categories/${categoryId}/subcategories/${subId}`)
        if (!res.success) return rejectWithValue(res.message)
        return { categoryId, subId }
    }
)

const categorySlice = createSlice({
    name: 'categories',
    initialState: {
        list: [],
        loading: false,
        error: null,
    },
    reducers: {
        clearError: (state) => { state.error = null },
    },
    extraReducers: (builder) => {
        // Fetch
        builder
            .addCase(fetchCategories.pending, (s) => { s.loading = true; s.error = null })
            .addCase(fetchCategories.fulfilled, (s, a) => { s.loading = false; s.list = a.payload || [] })
            .addCase(fetchCategories.rejected, (s, a) => { s.loading = false; s.error = a.payload })

        // Create
        builder.addCase(createCategory.fulfilled, (s, a) => { s.list.push(a.payload) })

        // Update
        builder.addCase(updateCategory.fulfilled, (s, a) => {
            const idx = s.list.findIndex(c => (c._id || c.id) === (a.payload._id || a.payload.id))
            if (idx !== -1) s.list[idx] = a.payload
        })

        // Delete
        builder.addCase(deleteCategory.fulfilled, (s, a) => {
            s.list = s.list.filter(c => (c._id || c.id) !== a.payload)
        })

        // Add subcategory — backend returns updated category
        builder.addCase(addSubcategory.fulfilled, (s, a) => {
            const idx = s.list.findIndex(c => (c._id || c.id) === (a.payload._id || a.payload.id))
            if (idx !== -1) s.list[idx] = a.payload
        })

        // Update subcategory — backend returns updated category
        builder.addCase(updateSubcategory.fulfilled, (s, a) => {
            const idx = s.list.findIndex(c => (c._id || c.id) === (a.payload._id || a.payload.id))
            if (idx !== -1) s.list[idx] = a.payload
        })

        // Delete subcategory — remove from category's subcategories array
        builder.addCase(deleteSubcategory.fulfilled, (s, a) => {
            const cat = s.list.find(c => (c._id || c.id) === a.payload.categoryId)
            if (cat) {
                cat.subcategories = cat.subcategories.filter(
                    sub => (sub._id || sub.id) !== a.payload.subId
                )
            }
        })
    },
})

export const { clearError } = categorySlice.actions
export const selectAllCategories = (state) => state.category.list
export const selectCategoryLoading = (state) => state.category.loading
export const selectCategoryError = (state) => state.category.error

export default categorySlice.reducer