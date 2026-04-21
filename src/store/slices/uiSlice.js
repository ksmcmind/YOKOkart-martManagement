// src/store/slices/uiSlice.js
import { createSlice } from '@reduxjs/toolkit'

const uiSlice = createSlice({
    name: 'ui',
    initialState: { toast: null, modal: null },
    reducers: {
        showToast: (s, a) => { s.toast = a.payload },
        hideToast: (s) => { s.toast = null },
        openModal: (s, a) => { s.modal = a.payload },
        closeModal: (s) => { s.modal = null },
    },
})

export const selectToast = (s) => s.ui.toast
export const selectModal = (s) => s.ui.modal
export const { showToast, hideToast, openModal, closeModal } = uiSlice.actions
export default uiSlice.reducer