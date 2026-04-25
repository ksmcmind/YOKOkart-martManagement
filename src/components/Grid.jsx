import { useState, useMemo } from 'react'
import Table from './Table'
import Input from './Input'
import Button from './Button'

/**
 * Reusable Grid Component
 * Wraps Table with Search and Pagination
 */
export default function Grid({
  columns,
  data = [],
  loading,
  emptyText,
  searchPlaceholder = "Search...",
  // If search is handled externally (e.g. via Redux), pass these:
  externalSearchValue,
  onSearchChange,
  // If search is handled internally:
  searchKey, // key to search on, or function
  pageSize = 10,
  actions, // Extra buttons/filters next to search
  showSearch = true,
  pagination = true,
  renderExpanded,
}) {
  const [internalSearch, setInternalSearch] = useState('')
  const [page, setPage] = useState(1)

  const isExternalSearch = onSearchChange !== undefined
  const searchValue = isExternalSearch ? externalSearchValue : internalSearch

  // Filtering (only if not external)
  const filteredData = useMemo(() => {
    if (isExternalSearch || !searchValue || !searchKey) return data
    const query = searchValue.toLowerCase()
    return data.filter(item => {
      if (typeof searchKey === 'function') return searchKey(item, query)
      const val = item[searchKey]
      return String(val || '').toLowerCase().includes(query)
    })
  }, [data, searchValue, searchKey, isExternalSearch])

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize)
  const paginatedData = useMemo(() => {
    if (!pagination) return filteredData
    const start = (page - 1) * pageSize
    return filteredData.slice(start, start + pageSize)
  }, [filteredData, page, pageSize, pagination])

  const handleSearch = (val) => {
    if (isExternalSearch) {
      onSearchChange(val)
    } else {
      setInternalSearch(val)
    }
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* Grid Header */}
      <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
        <div className="flex-1 flex gap-2 w-full">
          {showSearch && (
            <div className="w-full md:w-80">
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={e => handleSearch(e.target.value)}
                className="mb-0"
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2 items-center">
            {actions}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <Table
          columns={columns}
          data={paginatedData}
          loading={loading}
          emptyText={emptyText}
          renderExpanded={renderExpanded}
        />
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border border-gray-100 rounded-xl">
          <p className="text-sm text-gray-500">
            Showing <span className="font-medium">{(page - 1) * pageSize + 1}</span> to <span className="font-medium">{Math.min(page * pageSize, filteredData.length)}</span> of <span className="font-medium">{filteredData.length}</span> results
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
