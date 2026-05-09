// src/store/slices/uiSlice.js
import { createSlice } from '@reduxjs/toolkit'

const uiSlice = createSlice({
    name: 'ui',
    initialState: {
        toast: null,    // { message, type: 'success' | 'error' | 'warning' }
        modal: null,    // { id, data }
        sidebarOpen: true,
    },
    reducers: {
        showToast: (state, action) => {
            state.toast = action.payload  // { message, type }
        },
        hideToast: (state) => {
            state.toast = null
        },
        openModal: (state, action) => {
            state.modal = action.payload  // { id, data }
        },
        closeModal: (state) => {
            state.modal = null
        },
        toggleSidebar: (state) => {
            state.sidebarOpen = !state.sidebarOpen
        },
    },
})

// ── Selectors ─────────────────────────────────────────────────
export const selectToast = (state) => state.ui.toast
export const selectModal = (state) => state.ui.modal
export const selectSidebarOpen = (state) => state.ui.sidebarOpen

export const { showToast, hideToast, openModal, closeModal, toggleSidebar } = uiSlice.actions
export default uiSlice.reducer