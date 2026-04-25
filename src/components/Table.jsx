import React, { useState } from 'react'

export default function Table({ columns, data, loading, emptyText = 'No data found', renderExpanded }) {
  const [expandedRows, setExpandedRows] = useState(new Set())

  const toggleRow = (id) => {
    const next = new Set(expandedRows)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedRows(next)
  }

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="inline-block animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"/>
        <p className="text-gray-400 text-sm mt-3">Loading...</p>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="text-4xl mb-2">📭</div>
        <p className="text-gray-400 text-sm">{emptyText}</p>
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            {renderExpanded && <th style={{ width: '40px' }} />}
            {columns.map(col => (
              <th key={col.key} style={{ width: col.width }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const id = row.id || row._id || i
            const isExpanded = expandedRows.has(id)
            return (
              <React.Fragment key={id}>
                <tr className={renderExpanded ? 'cursor-pointer hover:bg-gray-50' : ''} onClick={() => renderExpanded && toggleRow(id)}>
                  {renderExpanded && (
                    <td className="text-center text-gray-400">
                      {isExpanded ? '▼' : '▶'}
                    </td>
                  )}
                  {columns.map(col => (
                    <td key={col.key}>
                      {col.render ? col.render(row) : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
                {isExpanded && renderExpanded && (
                  <tr className="bg-gray-50/50">
                    <td colSpan={columns.length + 1} className="p-0 border-t-0">
                      <div className="p-4 border-b border-gray-100">
                        {renderExpanded(row)}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}