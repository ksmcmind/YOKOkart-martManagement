// src/components/ImageUpload.jsx
// Does NOT upload immediately.
// onChange(file) returns the raw File object to the parent.
// Preview is shown via a local object URL.
// Parent is responsible for uploading on submit.

import { useState, useRef, useEffect } from 'react'

export default function ImageUpload({
    label = 'Upload Image',
    value = null,       // File object | existing URL string | null
    onChange,               // callback(File | null)
    accept = 'image/*',
    maxSizeMB = 2,
}) {
    const [preview, setPreview] = useState(null)
    const [error, setError] = useState('')
    const fileRef = useRef()

    // Generate/revoke preview URL whenever value changes
    useEffect(() => {
        if (!value) {
            setPreview(null)
            return
        }
        // Already a remote URL (e.g. existing staff record)
        if (typeof value === 'string') {
            setPreview(value)
            return
        }
        // File object — create a local preview
        const url = URL.createObjectURL(value)
        setPreview(url)
        return () => URL.revokeObjectURL(url)
    }, [value])

    const handleFile = (file) => {
        if (!file) return
        setError('')

        if (file.size > maxSizeMB * 1024 * 1024) {
            setError(`File too large. Max ${maxSizeMB}MB allowed`)
            return
        }

        // Just pass the File up — no upload here
        onChange(file)
    }

    const handleRemove = () => {
        onChange(null)
        // Reset the input so the same file can be re-selected
        if (fileRef.current) fileRef.current.value = ''
    }

    return (
        <div className="form-group">
            {label && <label className="label">{label}</label>}

            <div className="flex items-center gap-3">
                {/* Preview */}
                {preview ? (
                    <div className="relative">
                        <img
                            src={preview}
                            alt="preview"
                            className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                            type="button"
                            onClick={handleRemove}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                        >×</button>
                    </div>
                ) : (
                    <div
                        onClick={() => fileRef.current.click()}
                        className="w-16 h-16 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:border-primary-400 transition-colors"
                    >
                        <span className="text-gray-400 text-xl">+</span>
                    </div>
                )}

                <div>
                    <button
                        type="button"
                        onClick={() => fileRef.current.click()}
                        className="btn btn-secondary btn-sm"
                    >
                        {preview ? 'Change' : 'Choose'}
                    </button>
                    <p className="text-xs text-gray-400 mt-1">Max {maxSizeMB}MB</p>
                </div>
            </div>

            <input
                ref={fileRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={e => handleFile(e.target.files[0])}
            />

            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
    )
}

// ── Multi image upload ─────────────────────────────────────────────────────
// Also deferred: returns File[] to parent, parent uploads on submit.
export function MultiImageUpload({
    label = 'Product Images',
    values = [],           // Array of File | URL string
    onChange,
    max = 5,
    maxSizeMB = 2,
}) {
    const [error, setError] = useState('')
    const fileRef = useRef()

    const handleFiles = (files) => {
        if (!files.length) return
        setError('')

        if (values.length + files.length > max) {
            setError(`Maximum ${max} images allowed`)
            return
        }

        const oversized = Array.from(files).find(f => f.size > maxSizeMB * 1024 * 1024)
        if (oversized) {
            setError(`Each file must be under ${maxSizeMB}MB`)
            return
        }

        onChange([...values, ...Array.from(files)])
    }

    const removeImage = (idx) => onChange(values.filter((_, i) => i !== idx))

    return (
        <div className="form-group">
            {label && <label className="label">{label} ({values.length}/{max})</label>}
            <div className="flex gap-2 flex-wrap">
                {values.map((file, idx) => (
                    <FilePreviewThumb key={idx} file={file} onRemove={() => removeImage(idx)} />
                ))}
                {values.length < max && (
                    <div
                        onClick={() => fileRef.current.click()}
                        className="w-16 h-16 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:border-primary-400 transition-colors"
                    >
                        <span className="text-gray-400 text-xl">+</span>
                    </div>
                )}
            </div>
            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => handleFiles(e.target.files)}
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
    )
}

// Helper: preview thumbnail for a single File or URL string
function FilePreviewThumb({ file, onRemove }) {
    const [src, setSrc] = useState(null)

    useEffect(() => {
        if (!file) return
        if (typeof file === 'string') { setSrc(file); return }
        const url = URL.createObjectURL(file)
        setSrc(url)
        return () => URL.revokeObjectURL(url)
    }, [file])

    return (
        <div className="relative">
            {src && (
                <img src={src} alt="preview" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
            )}
            <button
                type="button"
                onClick={onRemove}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
            >×</button>
        </div>
    )
}