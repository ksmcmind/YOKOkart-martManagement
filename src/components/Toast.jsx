// src/components/Toast.jsx
import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { selectToast, hideToast } from '../store/slices/uiSlice'

export default function Toast() {
    const dispatch = useDispatch()
    const toast = useSelector(selectToast)

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => dispatch(hideToast()), 3000)
        return () => clearTimeout(t)
    }, [toast, dispatch])

    if (!toast) return null

    const styles = {
        success: 'bg-primary-500 text-white',
        error: 'bg-red-500 text-white',
        warning: 'bg-accent-500 text-white',
        info: 'bg-blue-500 text-white',
    }
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' }

    return (
        <div className="fixed bottom-6 right-6 z-50">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${styles[toast.type] || styles.info}`}>
                <span>{icons[toast.type] || icons.info}</span>
                {toast.message}
            </div>
        </div>
    )
}