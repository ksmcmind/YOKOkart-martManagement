// src/components/Modal.jsx
import { useEffect } from 'react'

export default function Modal({ title, open, onClose, children, size = 'md', footer }) {
    useEffect(() => {
        const h = (e) => { if (e.key === 'Escape') onClose() }
        if (open) window.addEventListener('keydown', h)
        return () => window.removeEventListener('keydown', h)
    }, [open, onClose])

    if (!open) return null

    const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className={`relative bg-white rounded-xl shadow-xl w-full ${sizes[size]} max-h-[90vh] flex flex-col`}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                </div>
                <div className="overflow-y-auto flex-1 p-5">{children}</div>
                {footer && <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">{footer}</div>}
            </div>
        </div>
    )
}