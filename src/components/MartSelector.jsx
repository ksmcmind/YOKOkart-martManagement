// src/components/MartSelector.jsx
// Shown ONLY to super admin
// All other roles get their mart from JWT token — no selector needed
export default function MartSelector({ show, value, onChange, marts }) {
  if (!show) return null

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 whitespace-nowrap">Select Mart:</span>
      <select
        className="input w-52 text-sm"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {marts.length === 0 && <option value="">No Marts Available</option>}
        {marts.map(m => (
          <option key={m.id} value={m.id}>
            {m.status === 'open' ? '🟢' : '🔴'} {m.name}
          </option>
        ))}
      </select>
    </div>
  )
}