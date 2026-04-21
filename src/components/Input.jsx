// src/components/Input.jsx
export default function Input({ label, error, type = 'text', className = '', required, ...props }) {
    return (
        <div className="form-group">
            {label && <label className="label">{label} {required && <span className="text-red-500">*</span>}</label>}
            <input type={type} className={`input ${error ? 'border-red-400' : ''} ${className}`} {...props} />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
    )
}

export function Select({ label, error, children, required, className = '', ...props }) {
    return (
        <div className="form-group">
            {label && <label className="label">{label} {required && <span className="text-red-500">*</span>}</label>}
            <select className={`input ${error ? 'border-red-400' : ''} ${className}`} {...props}>{children}</select>
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
    )
}