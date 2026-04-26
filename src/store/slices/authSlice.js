// src/store/slices/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/index'

const KEY = 'ksmcm_mart_user'

const MART_ROLES = [
    'mart_admin', 'manager', 'dispatcher', 'stock_manager',
    'cashier', 'packing_staff', 'accountant', 'support',
]

const loadUser = () => {
    try {
        const raw = localStorage.getItem(KEY)
        if (!raw || raw === 'null' || raw === 'undefined') return null
        return JSON.parse(raw)
    } catch {
        localStorage.removeItem(KEY)
        return null
    }
}

export const sendOtp = createAsyncThunk('auth/sendOtp', async (phone, { rejectWithValue }) => {
    const res = await api.post('/auth/send-otp', { phone, userType: 'staff' })
    if (!res.success) return rejectWithValue(res.message)
    return res.data
})

export const verifyOtp = createAsyncThunk('auth/verifyOtp', async ({ phone, otp }, { rejectWithValue }) => {
    const res = await api.post('/auth/verify-otp', { phone, otp, userType: 'staff' })
    if (!res.success) return rejectWithValue(res.message)

    const user = res.data.user
    if (user.role === 'super_admin') return rejectWithValue('Use Super Admin panel')
    if (!MART_ROLES.includes(user.role)) return rejectWithValue('Access denied. Mart staff only.')
    if (!user.id) return rejectWithValue('No mart assigned. Contact admin.')

    localStorage.setItem(KEY, JSON.stringify(user))
    return res.data
})

export const logout = createAsyncThunk('auth/logout', async () => {
    try { await api.post('/auth/logout') } catch { }
    localStorage.removeItem(KEY)
})

const cached = loadUser()

const authSlice = createSlice({
    name: 'auth',
    initialState: {
        user: cached,
        isLoggedIn: !!cached,
        otpSent: false,
        loading: false,
        error: null,
    },
    reducers: {
        clearError: (s) => { s.error = null },
        // Call this from axios interceptor on 401
        forceLogout: (s) => {
            s.user = null
            s.isLoggedIn = false
            localStorage.removeItem(KEY)
        },
    },
    extraReducers: (b) => {
        b.addCase(sendOtp.pending, (s) => { s.loading = true; s.error = null })
            .addCase(sendOtp.fulfilled, (s) => { s.loading = false; s.otpSent = true })
            .addCase(sendOtp.rejected, (s, a) => { s.loading = false; s.error = a.payload })

            .addCase(verifyOtp.pending, (s) => { s.loading = true; s.error = null })
            .addCase(verifyOtp.fulfilled, (s, a) => { s.loading = false; s.user = a.payload.user; s.isLoggedIn = true })
            .addCase(verifyOtp.rejected, (s, a) => { s.loading = false; s.error = a.payload })

            .addCase(logout.fulfilled, (s) => { s.user = null; s.isLoggedIn = false; s.otpSent = false })
    },
})

export const { clearError, forceLogout } = authSlice.actions
export default authSlice.reducer

// One selector. Destructure what you need.
export const selectAuth = (s) => s.auth
export const selectUser = (s) => s.auth.user
export const selectIsLoggedIn = (s) => s.auth.isLoggedIn
export const selectAuthLoading = (s) => s.auth.loading
export const selectAuthError = (s) => s.auth.error
export const selectOtpSent = (s) => s.auth.otpSent