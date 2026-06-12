import { useState, useEffect } from 'react'

const ALGOLIA_APP_ID = 'GCPVDXOBQY';
const ALGOLIA_SEARCH_KEY = 'f42b7bf1b7c16fde1491f4149f638a87';
const ALGOLIA_INDEX = 'products';

export default function AutocompleteVariantSelect({ value, displayLabel, onChange, placeholder = "Search variant by brand/name/SKU..." }) {
    const [searchVal, setSearchVal] = useState('')
    const [suggestions, setSuggestions] = useState([])
    const [loading, setLoading] = useState(false)
    const [focused, setFocused] = useState(false)

    useEffect(() => {
        const q = searchVal.trim()
        if (!q || q.length < 2) {
            setSuggestions([])
            return
        }

        const timer = setTimeout(async () => {
            setLoading(true)
            try {
                const url = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'X-Algolia-Application-Id': ALGOLIA_APP_ID,
                        'X-Algolia-API-Key': ALGOLIA_SEARCH_KEY,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        params: `query=${encodeURIComponent(q)}&hitsPerPage=20`
                    })
                });

                const data = await response.json();
                const hits = data.hits || [];

                // Flatten hits into individual variant suggestions
                const variantSuggestions = [];
                hits.forEach(prod => {
                    const brand = prod.brand || 'Generic';
                    const variantsList = prod.variants || [];
                    variantsList.forEach(v => {
                        variantSuggestions.push({
                            variantId: v.variant_id || v.variantId || v.sku,
                            variantName: v.variant_name,
                            sku: v.sku,
                            productName: prod.name,
                            brandName: brand,
                            productId: prod.objectID || prod.product_id,
                            productCode: prod.product_code,
                            stockUnit: v.stock_unit || 'pcs',
                            displayLabel: `[${brand}] ${prod.name} - ${v.variant_name || v.sku}`
                        });
                    });
                });

                // Filter suggestions locally
                const queryLower = q.toLowerCase();
                const filtered = variantSuggestions.filter(v =>
                    v.brandName.toLowerCase().includes(queryLower) ||
                    v.productName.toLowerCase().includes(queryLower) ||
                    v.variantName?.toLowerCase().includes(queryLower) ||
                    v.sku.toLowerCase().includes(queryLower)
                );

                setSuggestions(filtered.slice(0, 30));
            } catch (err) {
                console.error('[Algolia Variant Autocomplete] Failed:', err);
            } finally {
                setLoading(false);
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [searchVal])

    return (
        <div className="relative">
            <div className="relative">
                <input
                    type="text"
                    className="input text-xs w-full font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg p-2.5 focus:border-primary-500 focus:ring-0 outline-none pr-8"
                    placeholder={displayLabel || placeholder}
                    value={searchVal}
                    onFocus={() => { setFocused(true); setSearchVal(''); }}
                    onBlur={() => setTimeout(() => setFocused(false), 200)}
                    onChange={e => setSearchVal(e.target.value)}
                />
                {loading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-3.5 h-3.5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
            </div>
            {focused && (
                <div className="absolute left-0 right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto mt-1 border-t-0 p-1">
                    {suggestions.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 font-bold text-center">
                            {searchVal.trim().length < 2 ? 'Type at least 2 chars to search...' : 'No catalog variants found.'}
                        </div>
                    ) : (
                        suggestions.map(v => (
                            <button
                                key={v.variantId}
                                type="button"
                                onClick={() => {
                                    onChange(v.variantId, v.displayLabel, v);
                                    setSearchVal('');
                                }}
                                className="w-full text-left text-xs font-semibold text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors duration-150 border-b border-slate-100 flex flex-col gap-0.5"
                            >
                                <span className="text-slate-800 font-bold">{v.displayLabel}</span>
                                <span className="text-[10px] text-slate-400 font-mono">SKU: {v.sku} | Prod: {v.productCode}</span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}
