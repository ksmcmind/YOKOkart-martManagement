// src/components/Table.jsx
export default function Table({ columns, data, loading, emptyText = 'No data found' }) {
    if (loading) return (
        <div className="py-16 text-center">
            <div className="inline-block animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            <p className="text-gray-400 text-sm mt-3">Loading...</p>
        </div>
    )
    if (!data?.length) return (
        <div className="py-16 text-center">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-gray-400 text-sm">{emptyText}</p>
        </div>
    )
    return (
        <div className="table-wrapper">
            <table className="table">
                <thead><tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr></thead>
                <tbody>
                    {data.map((row, i) => (
                        <tr key={row.id || row._id || i}>
                            {columns.map(c => <td key={c.key}>{c.render ? c.render(row) : row[c.key] ?? '—'}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}