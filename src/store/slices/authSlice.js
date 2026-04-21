// src/store/slices/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/index'

// Roles allowed in this panel
const MART_ROLES = [
    'mart_admin', 'manager', 'dispatcher', 'stock_manager',
    'cashier', 'packing_staff', 'accountant', 'support'
]

export const sendOtp = createAsyncThunk(
    'auth/sendOtp',
    async (phone, { rejectWithValue }) => {
        const res = await api.post('/auth/send-otp', { phone, userType: 'staff' })
        if (!res.success) return rejectWithValue(res.message)
        return res.data
    }
)

export const verifyOtp = createAsyncThunk(
    'auth/verifyOtp',
    async ({ phone, otp }, { rejectWithValue }) => {
        const res = await api.post('/auth/verify-otp', { phone, otp, userType: 'staff' })
        if (!res.success) return rejectWithValue(res.message)

        const role = res.data.user.role

        // Block super_admin — they have their own panel
        if (role === 'super_admin') {
            return rejectWithValue('Use Super Admin panel for this account')
        }

        // Only mart staff allowed here
        if (!MART_ROLES.includes(role)) {
            return rejectWithValue('Access denied. Mart staff only.')
        }

        // Must have a martId assigned
        if (!res.data.user.mongoMartId) {
            return rejectWithValue('No mart assigned to your account. Contact admin.')
        }

        localStorage.setItem('ksmcm_mart_token', res.data.token)
        localStorage.setItem('ksmcm_mart_user', JSON.stringify(res.data.user))
        return res.data
    }
)

export const logout = createAsyncThunk('auth/logout', async () => {
    try { await api.post('/auth/logout') } catch { }
    localStorage.removeItem('ksmcm_mart_token')
    localStorage.removeItem('ksmcm_mart_user')
})

const authSlice = createSlice({
    name: 'auth',
    initialState: {
        user: JSON.parse(localStorage.getItem('ksmcm_mart_user') || 'null'),
        token: localStorage.getItem('ksmcm_mart_token') || null,
        otpSent: false,
        loading: false,
        error: null,
    },
    reducers: {
        clearError: (state) => { state.error = null },
    },
    extraReducers: (builder) => {
        builder
            .addCase(sendOtp.pending, (s) => { s.loading = true; s.error = null })
            .addCase(sendOtp.fulfilled, (s) => { s.loading = false; s.otpSent = true })
            .addCase(sendOtp.rejected, (s, a) => { s.loading = false; s.error = a.payload })

        builder
            .addCase(verifyOtp.pending, (s) => { s.loading = true; s.error = null })
            .addCase(verifyOtp.fulfilled, (s, a) => {
                s.loading = false
                s.token = a.payload.token
                s.user = a.payload.user
            })
            .addCase(verifyOtp.rejected, (s, a) => { s.loading = false; s.error = a.payload })

        builder
            .addCase(logout.fulfilled, (s) => { s.user = null; s.token = null; s.otpSent = false })
    },
})

export const selectUser = (s) => s.auth.user
export const selectToken = (s) => s.auth.token
export const selectOtpSent = (s) => s.auth.otpSent
export const selectAuthLoading = (s) => s.auth.loading
export const selectAuthError = (s) => s.auth.error
export const selectIsLoggedIn = (s) => !!s.auth.token

export const { clearError } = authSlice.actions
export default authSlice.reducer