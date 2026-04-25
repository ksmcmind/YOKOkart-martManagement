// src/pages/BulkUpload.jsx
//
// Central bulk-upload page with tiles for each data type.
// Inventory upload passes mongo_mart_id as a separate FormData field
// (the mart admin's own mart, from their session).

import { useState } from 'react'
import { useDispatch } from 'react-redux'
import * as XLSX from 'xlsx'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import BulkUploadModal from '../components/BulkUploadModal'
import { bulkUploadProducts } from '../store/slices/productSlice'
import { bulkUploadCategories } from '../store/slices/categorySlice'
import { bulkUploadInventory } from '../store/slices/inventorySlice'
import useAuth from '../hooks/useAuth'

// ── Inventory schema (matches PG `inventory` table) ─────────────────────────
// DB-generated columns excluded: id, created_at, updated_at, last_restocked_at
// Tenant-scoped column excluded from CSV: mongo_mart_id (passed separately)
const INVENTORY_FIELDS = [
  'product_id',
  'variant_id',
  'sale_price',
  'mrp',
  'stock_qty',
  'stock_unit',
  'low_stock_alert',
  'expiry_date',
  'batch_number',
  'aisle_location',
  'is_active',
]

const INVENTORY_OPTIONAL = new Set(['expiry_date', 'batch_number', 'aisle_location'])

const UPLOAD_TYPES = [
  // ── Products ───────────────────────────────────────────────────────────
  {
    id: 'products',
    name: 'Products',
    description: 'Bulk upload global product catalog with variants',
    icon: '📦',
    needsMartId: false,
    schemaFields: [
      'name', 'brand', 'description', 'category_slug', 'subcategory_slug',
      'search_keywords', 'tags', 'is_active', 'is_veg', 'return_policy',
      'hsn_code', 'gst_percentage', 'variant_id', 'variant_name',
      'display_size', 'sku', 'barcode', 'plu_code', 'details', 'images',
      'is_active_variant',
    ],
    onUpload: async (dispatch, file /* , martId */) => {
      const action = await dispatch(bulkUploadProducts(file))
      return action.payload
    },
    downloadCSV: (fields) => {
      const comments = [
        '# Super Admin Product Catalog — CSV Template',
        '# Each row = ONE VARIANT. Multiple variants of the same product:',
        '# repeat rows with the same name+brand.',
        '',
      ]
      const exampleRow = [
        'Amul Taaza Milk', 'Amul', 'Fresh milk', 'dairy', 'milk-curd',
        'amul|milk', 'daily', 'true', 'true', 'No return', '0401', '5',
        'VID-AMUL-500', 'Amul Taaza 500ml', '500ml', 'SKU-AMUL-500', '', '',
        '{"fat":"3%"}', 'https://example.com/img.jpg', 'true',
      ].join(',')
      const blob = new Blob([[...comments, fields.join(','), exampleRow].join('\n')], { type: 'text/csv' })
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'products_template.csv'; a.click()
    },
    downloadXLSX: (fields) => {
      const rows = [fields, [
        'Amul Taaza Milk', 'Amul', 'Fresh milk', 'dairy', 'milk-curd',
        'amul|milk', 'daily', 'true', 'true', 'No return', '0401', '5',
        'VID-AMUL-500', 'Amul Taaza 500ml', '500ml', 'SKU-AMUL-500', '', '',
        '{"fat":"3%"}', 'https://example.com/img.jpg', 'true',
      ]]
      const ws = XLSX.utils.aoa_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Products')
      XLSX.writeFile(wb, 'products_template.xlsx')
    },
  },

  // ── Categories ─────────────────────────────────────────────────────────
  {
    id: 'categories',
    name: 'Categories',
    description: 'Bulk upload categories and subcategories',
    icon: '📁',
    needsMartId: false,
    schemaFields: [
      'category_code', 'category_name', 'category_slug', 'category_title',
      'category_icon', 'category_image_url', 'type', 'sort_order',
      'subcategory_code', 'subcategory_name', 'subcategory_slug', 'subcategory_title',
      'subcategory_icon', 'subcategory_image_url',
    ],
    onUpload: async (dispatch, file) => {
      const action = await dispatch(bulkUploadCategories(file))
      return action.payload
    },
    downloadCSV: (fields) => {
      const exampleRow = 'C001,Dairy,dairy,Fresh Dairy,📦,https://img.jpg,product,1,S001,Milk,milk,Fresh Milk,🥛,https://img.jpg'
      const blob = new Blob([[fields.join(','), exampleRow].join('\n')], { type: 'text/csv' })
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'categories_template.csv'; a.click()
    },
    downloadXLSX: (fields) => {
      const rows = [fields, ['C001', 'Dairy', 'dairy', 'Fresh Dairy', '📦', 'https://img.jpg', 'product', 1, 'S001', 'Milk', 'milk', 'Fresh Milk', '🥛', 'https://img.jpg']]
      const ws = XLSX.utils.aoa_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Categories')
      XLSX.writeFile(wb, 'categories_template.xlsx')
    },
  },

  // ── Inventory ──────────────────────────────────────────────────────────
  {
    id: 'inventory',
    name: 'Inventory',
    description: 'Bulk upload stock, prices & availability for your mart',
    icon: '📊',
    needsMartId: true,   // ← martId auto-passed to the backend alongside the file
    schemaFields: INVENTORY_FIELDS,
    optionalFields: INVENTORY_OPTIONAL,
    onUpload: async (dispatch, file, martId) => {
      const action = await dispatch(bulkUploadInventory({ file, martId }))
      return action.payload
    },
    downloadCSV: (fields) => {
      const comments = [
        '# Mart Admin Inventory — CSV Template',
        '# mart_id is NOT in this CSV. Backend fills it from your session.',
        '# product_id must be a 24-char hex ObjectId of an existing product.',
        '# variant_id must match a variant of that product.',
        '# stock_unit: kg | g | l | ml | pcs | dozen',
        '# Dates: YYYY-MM-DD. Leave blank for expiry_date / batch_number / aisle_location.',
        '# sale_price must be <= mrp. All numeric values must be non-negative.',
        '',
      ]
      const row1 = [
        '64f1a2b3c4d5e6f7a8b9c0d1', 'VID-AMUL-500', '49.00', '55.00',
        '100', 'pcs', '10', '2026-12-31', 'BATCH-001', 'A3-Shelf2', 'true',
      ].join(',')
      const row2 = [
        '64f1a2b3c4d5e6f7a8b9c0d2', 'VID-TATA-1KG', '22.00', '24.00',
        '50', 'kg', '5', '', '', 'B1-Shelf1', 'true',
      ].join(',')
      const blob = new Blob([[...comments, fields.join(','), row1, row2].join('\n')], { type: 'text/csv' })
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'inventory_template.csv'; a.click()
    },
    downloadXLSX: (fields) => {
      const rows = [
        fields,
        ['64f1a2b3c4d5e6f7a8b9c0d1', 'VID-AMUL-500', 49.00, 55.00, 100, 'pcs', 10, '2026-12-31', 'BATCH-001', 'A3-Shelf2', 'true'],
        ['64f1a2b3c4d5e6f7a8b9c0d2', 'VID-TATA-1KG', 22.00, 24.00, 50, 'kg', 5, '', '', 'B1-Shelf1', 'true'],
      ]
      const ws = XLSX.utils.aoa_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Inventory')
      XLSX.writeFile(wb, 'inventory_template.xlsx')
    },
  },
]

export default function BulkUpload() {
  const dispatch = useDispatch()
  const { martId } = useAuth()
  const resolvedMartId = typeof martId === 'object' ? (martId?.mongoMartId || martId?.id) : martId

  const [activeType, setActiveType] = useState(null)

  return (
    <div className="space-y-6">
      <PageHeader title="Bulk Data Management" subtitle="Upload large volumes of data using CSV or Excel templates" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {UPLOAD_TYPES.map(type => {
          const disabled = type.needsMartId && !resolvedMartId
          return (
            <div key={type.id}
              className={`card transition-all ${disabled ? 'opacity-50' : 'hover:border-primary-300 cursor-pointer'}`}
              onClick={() => { if (!disabled) setActiveType(type) }}>
              <div className="p-6">
                <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center text-2xl mb-4">{type.icon}</div>
                <h3 className="text-lg font-bold text-gray-900">{type.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{type.description}</p>
                {type.needsMartId && !resolvedMartId && (
                  <p className="text-xs text-red-500 mt-2">Requires an assigned mart</p>
                )}
                <div className="mt-6">
                  <Button variant="secondary" className="w-full" disabled={disabled}>
                    Start Upload
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {activeType && (
        <BulkUploadModal
          open={!!activeType}
          onClose={() => setActiveType(null)}
          title={`Bulk Upload ${activeType.name}`}
          schemaFields={activeType.schemaFields}
          optionalFields={activeType.optionalFields}
          onUpload={(payload, file) =>
            activeType.onUpload(dispatch, file, activeType.needsMartId ? resolvedMartId : undefined)
          }
          downloadCSVTemplate={() => activeType.downloadCSV(activeType.schemaFields)}
          downloadXLSXTemplate={() => activeType.downloadXLSX(activeType.schemaFields)}
        />
      )}
    </div>
  )
}