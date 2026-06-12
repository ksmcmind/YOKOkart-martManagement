/**
 * AlgoliaProductSearch — reusable Algolia-powered autocomplete for Products / Variants.
 *
 * Props:
 *   mode        – 'variant' (default) | 'product'
 *                  'variant' → flattens hits into variant-level suggestions and calls
 *                              onSelect({ variantId, variantName, sku, productName, brandName,
 *                                         productId, productCode, stockUnit, displayLabel })
 *                  'product' → returns product-level suggestions and calls
 *                              onSelect({ productId, productCode, productName, brandName, variants[] })
 *
 *   value       – currently selected display label (shown when input is blurred)
 *   placeholder – input placeholder text
 *   onSelect    – callback fired when user picks a suggestion
 *   onClear     – optional callback fired when user clears the selection
 *   className   – extra className for the wrapper div
 *   label       – optional field label rendered above input
 *   disabled    – disable the input
 */

import { useState, useEffect, useRef } from 'react'

const ALGOLIA_APP_ID = 'GCPVDXOBQY'
const ALGOLIA_SEARCH_KEY = 'f42b7bf1b7c16fde1491f4149f638a87'
const ALGOLIA_INDEX = 'products'

async function algoliaSearch(query) {
  const url = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Algolia-Application-Id': ALGOLIA_APP_ID,
      'X-Algolia-API-Key': ALGOLIA_SEARCH_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ params: `query=${encodeURIComponent(query)}&hitsPerPage=20` }),
  })
  const data = await response.json()
  return data.hits || []
}

export default function AlgoliaProductSearch({
  mode = 'variant',
  value = '',
  placeholder,
  onSelect,
  onClear,
  className = '',
  label,
  disabled = false,
}) {
  const [inputVal, setInputVal] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  const defaultPlaceholder = mode === 'variant'
    ? 'Search variant by brand / name / SKU…'
    : 'Search product by name or brand…'

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Debounced Algolia search
  useEffect(() => {
    const q = inputVal.trim()
    if (!q || q.length < 2) { setSuggestions([]); return }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const hits = await algoliaSearch(q)
        if (mode === 'variant') {
          const items = []
          const qLower = q.toLowerCase()
          hits.forEach(prod => {
            const brand = prod.brand || 'Generic'
              ; (prod.variants || []).forEach(v => {
                const label = `[${brand}] ${prod.name} — ${v.variant_name || v.sku}`
                // local filter so off-topic variants don't show
                if (
                  brand.toLowerCase().includes(qLower) ||
                  prod.name.toLowerCase().includes(qLower) ||
                  (v.variant_name || '').toLowerCase().includes(qLower) ||
                  (v.sku || '').toLowerCase().includes(qLower)
                ) {
                  items.push({
                    variantId: v.variant_id || v.variantId || prod.objectID || prod.product_id,
                    variantName: v.variant_name,
                    sku: v.sku,
                    productName: prod.name,
                    brandName: brand,
                    productId: prod.objectID || prod.product_id,
                    productCode: prod.product_code,
                    stockUnit: v.stock_unit || 'pcs',
                    displayLabel: label,
                  })
                }
              })
          })
          setSuggestions(items.slice(0, 30))
        } else {
          // product mode
          setSuggestions(hits.map(prod => ({
            productId: prod.product_id || prod.objectID,
            productCode: prod.product_code,
            productName: prod.name,
            brandName: prod.brand || 'Generic',
            variants: prod.variants || [],
          })).slice(0, 20))
        }
        setOpen(true)
      } catch (err) {
        console.error('[AlgoliaProductSearch]', err)
      } finally {
        setLoading(false)
      }
    }, 320)

    return () => clearTimeout(timer)
  }, [inputVal, mode])

  const handleSelect = (item) => {
    onSelect(item)
    setInputVal('')
    setOpen(false)
    setSuggestions([])
  }

  const handleClear = () => {
    setInputVal('')
    setSuggestions([])
    setOpen(false)
    onClear?.()
  }

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      {label && (
        <label className="block text-xs font-bold text-slate-700 mb-1">{label}</label>
      )}
      <div className="relative">
        <input
          type="text"
          disabled={disabled}
          placeholder={value || placeholder || defaultPlaceholder}
          value={inputVal}
          onChange={e => { setInputVal(e.target.value); setOpen(true) }}
          onFocus={() => { setInputVal(''); setOpen(suggestions.length > 0) }}
          className="w-full text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2.5 focus:border-primary-500 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        />

        {/* Search icon */}
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        {/* Spinner / Clear */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && (
            <div className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          )}
          {(value || inputVal) && !loading && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-rose-500 transition-colors text-xs font-bold leading-none"
            >✕</button>
          )}
        </div>
      </div>

      {/* Currently selected badge */}
      {value && !inputVal && (
        <div className="mt-1.5 inline-flex items-center gap-1.5 bg-primary-50 border border-primary-200 text-primary-700 text-[10px] font-bold px-2.5 py-1 rounded-full max-w-full truncate">
          ✔ {value}
        </div>
      )}

      {/* Dropdown */}
      {open && (suggestions.length > 0 || (inputVal.length >= 2 && !loading)) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
          {suggestions.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-400 italic text-center">No results found for "{inputVal}"</div>
          ) : mode === 'variant' ? (
            suggestions.map((s, i) => (
              <button
                key={`${s.variantId}-${i}`}
                type="button"
                onMouseDown={e => { e.preventDefault(); handleSelect(s) }}
                className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-primary-50 border-b border-slate-50 last:border-none transition-colors flex items-start justify-between gap-2 group"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 truncate group-hover:text-primary-700">{s.productName}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-mono truncate">{s.variantName || s.sku} · SKU: {s.sku}</p>
                </div>
                <span className="shrink-0 text-[9px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full uppercase tracking-wide mt-0.5">
                  {s.brandName}
                </span>
              </button>
            ))
          ) : (
            suggestions.map((s, i) => (
              <button
                key={`${s.productId}-${i}`}
                type="button"
                onMouseDown={e => { e.preventDefault(); handleSelect(s) }}
                className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-primary-50 border-b border-slate-50 last:border-none transition-colors flex items-start justify-between gap-2 group"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 truncate group-hover:text-primary-700">{s.productName}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{s.productCode} · {s.variants.length} variants</p>
                </div>
                <span className="shrink-0 text-[9px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full uppercase tracking-wide mt-0.5">
                  {s.brandName}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
