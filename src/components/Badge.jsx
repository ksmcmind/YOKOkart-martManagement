// src/components/Badge.jsx
const autoColor = (v) => {
    const val = v?.toLowerCase()
    if (['active', 'open', 'delivered', 'paid', 'available', 'confirmed'].includes(val)) return 'green'
    if (['pending', 'preparing', 'partial', 'on_trip', 'assigned'].includes(val)) return 'yellow'
    if (['inactive', 'closed', 'cancelled', 'failed', 'offline'].includes(val)) return 'red'
    if (['picked_up', 'packing', 'ready'].includes(val)) return 'blue'
    return 'gray'
}
const colors = { green: 'badge-green', yellow: 'badge-yellow', red: 'badge-red', gray: 'badge-gray', blue: 'badge-blue' }

export default function Badge({ children, variant }) {
    return <span className={colors[variant || autoColor(children)] || 'badge-gray'}>{children}</span>
}