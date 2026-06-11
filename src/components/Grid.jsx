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
  rowClassName,
  // Server-side pagination support:
  totalItems,
  page: externalPage,
  onPageChange,
  onPageSizeChange,
}) {
  const [internalSearch, setInternalSearch] = useState('')
  const [page, setPage] = useState(1)
  const [internalPageSize, setInternalPageSize] = useState(pageSize)

  const activePageSize = onPageSizeChange ? pageSize : internalPageSize

  const isExternalSearch = onSearchChange !== undefined
  const searchValue = isExternalSearch ? externalSearchValue : internalSearch

  const isServerSide = totalItems !== undefined
  const activePage = isServerSide ? (externalPage || 1) : page

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

  // Pagination calculations
  const totalCount = isServerSide ? totalItems : filteredData.length
  const totalPages = Math.ceil(totalCount / activePageSize)

  const paginatedData = useMemo(() => {
    if (!pagination) return filteredData
    if (isServerSide) return filteredData // Server already sliced the data
    const start = (activePage - 1) * activePageSize
    return filteredData.slice(start, start + activePageSize)
  }, [filteredData, activePage, activePageSize, pagination, isServerSide])

  const handleSearch = (val) => {
    if (isExternalSearch) {
      onSearchChange(val)
    } else {
      setInternalSearch(val)
    }
    if (isServerSide && onPageChange) {
      onPageChange(1)
    } else {
      setPage(1)
    }
  }

  const handlePageChange = (newPage) => {
    if (isServerSide && onPageChange) {
      onPageChange(newPage)
    } else {
      setPage(newPage)
    }
  }

  const handlePageSizeChange = (sz) => {
    if (onPageSizeChange) {
      onPageSizeChange(sz)
    } else {
      setInternalPageSize(sz)
      setPage(1)
    }
  }

  const getPages = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [1];
    if (activePage > 3) pages.push('...');
    for (let i = Math.max(2, activePage - 1); i <= Math.min(totalPages - 1, activePage + 1); i++) pages.push(i);
    if (activePage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

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
          rowClassName={rowClassName}
        />
      </div>

      {/* Pagination */}
      {pagination && totalCount > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border border-gray-100 rounded-xl">
          <div className="flex items-center gap-4">
            <p className="text-sm text-gray-500">
              Showing <span className="font-medium">{totalCount > 0 ? (activePage - 1) * activePageSize + 1 : 0}</span> to <span className="font-medium">{Math.min(activePage * activePageSize, totalCount)}</span> of <span className="font-medium">{totalCount}</span> results
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Show:</span>
              <select
                value={activePageSize}
                onChange={e => handlePageSizeChange(Number(e.target.value))}
                className="text-xs border border-gray-200 rounded px-2 py-1 bg-white font-semibold text-gray-600 focus:outline-none cursor-pointer"
              >
                {[10, 25, 50, 100].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="flex gap-1 items-center">
              <Button
                variant="secondary"
                size="sm"
                disabled={activePage === 1}
                onClick={() => handlePageChange(activePage - 1)}
              >
                Previous
              </Button>
              {getPages().map((p, i) =>
                p === '...' ? (
                  <span key={`e${i}`} className="px-1 text-xs text-gray-400">…</span>
                ) : (
                  <Button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    variant={p === activePage ? 'primary' : 'secondary'}
                    size="sm"
                    className="w-8 h-8 p-0 flex items-center justify-center font-bold text-xs"
                  >
                    {p}
                  </Button>
                )
              )}
              <Button
                variant="secondary"
                size="sm"
                disabled={activePage === totalPages}
                onClick={() => handlePageChange(activePage + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
