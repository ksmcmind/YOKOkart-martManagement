// src/components/ImageInput.jsx
// Admin pastes GCS URL directly — no upload needed
// Image already uploaded to GCS bucket separately

export default function ImageInput({ label, value, onChange, placeholder, required }) {
    return (
        <div className="form-group">
            {label && (
                <label className="label">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}
            <div className="flex gap-2 items-start">
                {/* URL input */}
                <input
                    className="input flex-1"
                    placeholder={placeholder || 'https://storage.googleapis.com/ksmcm-media/...'}
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                />
                {/* Preview */}
                {value && value.startsWith('http') && (
                    <img
                        src={value}
                        alt="preview"
                        className="w-10 h-10 rounded-lg object-cover border border-gray-200 flex-shrink-0"
                        onError={e => e.target.style.display = 'none'}
                    />
                )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
                Upload image to GCS bucket first, then paste URL here
            </p>
        </div>
    )
}

// ── Multi image URL input ─────────────────────────────────────
export function MultiImageInput({ label = 'Product Images', values = [], onChange, max = 5 }) {
    const update = (idx, url) => {
        const updated = [...values]
        updated[idx] = url
        onChange(updated.filter(Boolean))
    }

    const addRow = () => {
        if (values.length < max) onChange([...values, ''])
    }

    const remove = (idx) => {
        onChange(values.filter((_, i) => i !== idx))
    }

    // Always show at least one input
    const rows = values.length > 0 ? values : ['']

    return (
        <div className="form-group">
            <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">{label} ({values.filter(Boolean).length}/{max})</label>
                {values.length < max && (
                    <button
                        type="button"
                        onClick={addRow}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                    >
                        + Add Image URL
                    </button>
                )}
            </div>

            <div className="space-y-2">
                {rows.map((url, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                        <input
                            className="input flex-1"
                            placeholder={`Image ${idx + 1} URL — https://storage.googleapis.com/ksmcm-media/products/...`}
                            value={url || ''}
                            onChange={e => update(idx, e.target.value)}
                        />
                        {/* Preview */}
                        {url && url.startsWith('http') && (
                            <img
                                src={url}
                                alt={`img${idx + 1}`}
                                className="w-9 h-9 rounded-lg object-cover border border-gray-200 flex-shrink-0"
                                onError={e => e.target.style.display = 'none'}
                            />
                        )}
                        {/* Remove */}
                        {rows.length > 1 && (
                            <button
                                type="button"
                                onClick={() => remove(idx)}
                                className="text-red-400 hover:text-red-600 font-bold text-lg leading-none px-1"
                            >×</button>
                        )}
                    </div>
                ))}
            </div>

            <p className="text-xs text-gray-400 mt-1">
                Upload images to GCS first, then paste URLs here
            </p>
        </div>
    )
}