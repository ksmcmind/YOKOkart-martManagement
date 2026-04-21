// src/components/StatCard.jsx
export default function StatCard({ label, value, icon, color = 'green', sub }) {
    const colors = { green: 'bg-primary-50 text-primary-600', yellow: 'bg-accent-50 text-accent-600', red: 'bg-red-50 text-red-600', blue: 'bg-blue-50 text-blue-600', gray: 'bg-gray-100 text-gray-600' }
    return (
        <div className="card p-5">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
                </div>
                {icon && <div className={`text-2xl p-2 rounded-lg ${colors[color]}`}>{icon}</div>}
            </div>
        </div>
    )
}