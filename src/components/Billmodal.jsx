// src/components/BillModal.jsx
//
// Thermal bill modal with USB printer support.
//
// USAGE in Orders.jsx:
//   import BillModal from '../components/BillModal'
//   <BillModal open={!!billOrder} order={billOrder} onClose={() => setBillOrder(null)} />
//
// PRINTER FLOW:
//   1. User clicks "🖨 Print Bill" on a packed order
//   2. Modal fetches /api/bills/:orderId
//   3. Shows bill preview
//   4. "Connect Printer" — opens USB device picker (Web USB API)
//   5. "Print" — sends ESC/POS commands to thermal printer
//   6. Falls back to browser window.print() if USB not available
//
// ESC/POS commands work with most 58mm/80mm thermal printers:
//   Epson TM series, Star Micronics, GOOJPRT, Xprinter, etc.

import { useEffect, useState, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { showToast } from '../store/slices/uiSlice'
import Modal from './Modal'
import Button from './Button'
import api from '../api/index'

// ── ESC/POS helpers ───────────────────────────────────────────
const ESC = 0x1b
const GS = 0x1d

const cmd = (...bytes) => new Uint8Array(bytes)

const INIT = cmd(ESC, 0x40)                   // Initialize printer
const ALIGN_CENTER = cmd(ESC, 0x61, 0x01)
const ALIGN_LEFT = cmd(ESC, 0x61, 0x00)
const ALIGN_RIGHT = cmd(ESC, 0x61, 0x02)
const BOLD_ON = cmd(ESC, 0x45, 0x01)
const BOLD_OFF = cmd(ESC, 0x45, 0x00)
const DOUBLE_ON = cmd(GS, 0x21, 0x11)             // Double width+height
const DOUBLE_OFF = cmd(GS, 0x21, 0x00)
const CUT = cmd(GS, 0x56, 0x42, 0x00)       // Full cut
const LF = cmd(0x0a)                         // Line feed
const LF2 = cmd(0x0a, 0x0a)

const encoder = new TextEncoder()
const text = (str) => encoder.encode(str + '\n')

// Pad/truncate to fixed width for table columns
const col = (str, width, align = 'left') => {
    const s = String(str ?? '').slice(0, width)
    if (align === 'right') return s.padStart(width)
    if (align === 'center') {
        const pad = Math.floor((width - s.length) / 2)
        return s.padStart(s.length + pad).padEnd(width)
    }
    return s.padEnd(width)
}

const divider = (char = '-', width = 32) => text(char.repeat(width))

// Build full ESC/POS byte array for the bill
const buildEscPos = (bill, printerWidth = 32) => {
    const W = printerWidth
    const chunks = []
    const add = (...parts) => parts.forEach(p => chunks.push(p))

    const fmt = (n) => `Rs.${parseFloat(n).toFixed(2)}`

    add(INIT, LF)

    // ── Header ───────────────────────────────────────────────
    add(ALIGN_CENTER, DOUBLE_ON, BOLD_ON)
    add(text(bill.mart.name))
    add(DOUBLE_OFF, BOLD_OFF)

    if (bill.mart.address) add(text(bill.mart.address))
    if (bill.mart.city) add(text(`${bill.mart.city}${bill.mart.pincode ? ' - ' + bill.mart.pincode : ''}`))
    if (bill.mart.phone) add(text(`Ph: ${bill.mart.phone}`))
    if (bill.mart.gstin) add(text(`GSTIN: ${bill.mart.gstin}`))

    add(divider('=', W), ALIGN_LEFT)

    // ── Order info ───────────────────────────────────────────
    add(BOLD_ON)
    add(text(`Order  : #${bill.orderId.slice(-8)}`))
    add(BOLD_OFF)
    add(text(`Date   : ${new Date(bill.orderDate).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
    })}`))
    add(text(`Payment: ${bill.paymentMethod.toUpperCase()}`))
    add(text(`Type   : ${bill.orderType.toUpperCase()}`))

    if (bill.customer?.name || bill.customer?.phone) {
        add(divider('-', W))
        add(text('CUSTOMER'))
        if (bill.customer.name) add(text(bill.customer.name))
        if (bill.customer.line1) add(text(bill.customer.line1))
        if (bill.customer.city) add(text(bill.customer.city))
        if (bill.customer.phone) add(text(`Ph: ${bill.customer.phone}`))
    }

    add(divider('=', W))

    // ── Items header ─────────────────────────────────────────
    add(BOLD_ON)
    const itemW = W - 14   // leave space for qty + price cols
    add(text(`${col('ITEM', itemW)}${col('QTY', 5, 'right')}${col('AMT', 9, 'right')}`))
    add(BOLD_OFF)
    add(divider('-', W))

    // ── Items ────────────────────────────────────────────────
    bill.items.forEach(item => {
        const name = `${item.productName}${item.variantId ? ` (${item.variantId})` : ''}`
        const nameLines = []
        // Word-wrap name to itemW chars
        let line = ''
        name.split(' ').forEach(word => {
            if ((line + word).length > itemW) { nameLines.push(line.trimEnd()); line = '' }
            line += word + ' '
        })
        if (line.trim()) nameLines.push(line.trimEnd())

        // First line has qty and amount
        const qty = `x${item.quantity}`
        const amt = fmt(item.totalPrice)
        add(text(`${col(nameLines[0], itemW)}${col(qty, 5, 'right')}${col(amt, 9, 'right')}`))
        // Continuation lines (name overflow)
        nameLines.slice(1).forEach(l => add(text(`  ${l}`)))
        // Unit price if different from total (i.e. qty > 1)
        if (item.quantity > 1) {
            add(text(`  @ ${fmt(item.unitPrice)} each`))
        }
    })

    add(divider('=', W))

    // ── Totals ───────────────────────────────────────────────
    const totRow = (label, value, bold = false) => {
        const line = `${col(label, W - 10)}${col(value, 10, 'right')}`
        if (bold) { add(BOLD_ON); add(text(line)); add(BOLD_OFF) }
        else add(text(line))
    }

    totRow('Subtotal', fmt(bill.totals.subtotal))
    if (bill.totals.deliveryFee > 0) totRow('Delivery', fmt(bill.totals.deliveryFee))
    if (bill.totals.discount > 0) totRow('Discount', `-${fmt(bill.totals.discount)}`)
    if (bill.totals.tax > 0) totRow('Tax', fmt(bill.totals.tax))

    add(divider('=', W))
    totRow('TOTAL', fmt(bill.totals.total), true)
    add(divider('=', W))

    // ── Footer ───────────────────────────────────────────────
    add(ALIGN_CENTER, LF)
    add(text('Thank you for shopping!'))
    add(text('Visit again'))
    add(LF2, CUT)

    // Merge all Uint8Arrays into one
    const totalLen = chunks.reduce((s, c) => s + c.length, 0)
    const merged = new Uint8Array(totalLen)
    let offset = 0
    chunks.forEach(c => { merged.set(c, offset); offset += c.length })
    return merged
}

// ── HTML bill for browser print fallback ─────────────────────
const buildHtmlBill = (bill) => `
  <html><head><title>Bill #${bill.orderId.slice(-8)}</title>
  <style>
    body { font-family: monospace; font-size: 12px; width: 300px; margin: 0 auto; }
    h2   { text-align: center; margin: 4px 0; }
    .center { text-align: center; }
    .right  { text-align: right; }
    table { width: 100%; border-collapse: collapse; }
    td    { padding: 2px 0; vertical-align: top; }
    .divider { border-top: 1px dashed #000; margin: 4px 0; }
    .total-row td { font-weight: bold; font-size: 14px; }
    @media print { body { width: 100%; } }
  </style></head><body>
  <h2>${bill.mart.name}</h2>
  <p class="center">${bill.mart.address || ''}<br/>
    ${bill.mart.city || ''}${bill.mart.pincode ? ' - ' + bill.mart.pincode : ''}<br/>
    ${bill.mart.phone ? 'Ph: ' + bill.mart.phone : ''}
    ${bill.mart.gstin ? '<br/>GSTIN: ' + bill.mart.gstin : ''}</p>
  <div class="divider"></div>
  <p>Order : <b>#${bill.orderId.slice(-8)}</b><br/>
     Date  : ${new Date(bill.orderDate).toLocaleString('en-IN')}<br/>
     Pay   : ${bill.paymentMethod.toUpperCase()}<br/>
     Type  : ${bill.orderType.toUpperCase()}</p>
  ${bill.customer?.name ? `<div class="divider"></div>
  <p>To: <b>${bill.customer.name}</b><br/>
     ${bill.customer.line1 || ''} ${bill.customer.city || ''}<br/>
     ${bill.customer.phone ? 'Ph: ' + bill.customer.phone : ''}</p>` : ''}
  <div class="divider"></div>
  <table>
    <tr><td><b>Item</b></td><td class="right"><b>Qty</b></td><td class="right"><b>Amt</b></td></tr>
    <tr><td colspan="3"><div class="divider"></div></td></tr>
    ${bill.items.map(i => `
      <tr>
        <td>${i.productName}${i.variantId ? ` (${i.variantId})` : ''}</td>
        <td class="right">x${i.quantity}</td>
        <td class="right">₹${parseFloat(i.totalPrice).toFixed(2)}</td>
      </tr>
      ${i.quantity > 1 ? `<tr><td colspan="3" style="color:#666;font-size:10px">  @ ₹${parseFloat(i.unitPrice).toFixed(2)} each</td></tr>` : ''}
    `).join('')}
    <tr><td colspan="3"><div class="divider"></div></td></tr>
    <tr><td>Subtotal</td><td></td><td class="right">₹${parseFloat(bill.totals.subtotal).toFixed(2)}</td></tr>
    ${bill.totals.deliveryFee > 0 ? `<tr><td>Delivery</td><td></td><td class="right">₹${parseFloat(bill.totals.deliveryFee).toFixed(2)}</td></tr>` : ''}
    ${bill.totals.discount > 0 ? `<tr><td>Discount</td><td></td><td class="right">-₹${parseFloat(bill.totals.discount).toFixed(2)}</td></tr>` : ''}
    <tr><td colspan="3"><div class="divider"></div></td></tr>
    <tr class="total-row"><td>TOTAL</td><td></td><td class="right">₹${parseFloat(bill.totals.total).toFixed(2)}</td></tr>
  </table>
  <div class="divider"></div>
  <p class="center">Thank you for shopping!<br/>Visit again</p>
  <script>window.onload = () => { window.print(); window.onafterprint = () => window.close() }</script>
  </body></html>
`

// ── BillModal ─────────────────────────────────────────────────
export default function BillModal({ open, order, onClose }) {
    const dispatch = useDispatch()
    const [bill, setBill] = useState(null)
    const [loading, setLoading] = useState(false)
    const [printing, setPrinting] = useState(false)
    const [printer, setPrinter] = useState(null)  // USB device
    const [printerName, setPrinterName] = useState(null)
    const [connecting, setConnecting] = useState(false)
    const usbSupported = typeof navigator !== 'undefined' && !!navigator.usb

    // Fetch bill data when modal opens
    useEffect(() => {
        if (!open || !order?.id) return
        setBill(null)
        setLoading(true)
        api.get(`/bills/${order.id}`)
            .then(res => { if (res.success) setBill(res.data) })
            .catch(err => dispatch(showToast({ message: err.message || 'Failed to load bill', type: 'error' })))
            .finally(() => setLoading(false))
    }, [open, order?.id])

    // Connect USB printer
    const handleConnectPrinter = async () => {
        if (!usbSupported) {
            dispatch(showToast({ message: 'Web USB not supported in this browser. Use Chrome/Edge.', type: 'error' }))
            return
        }
        setConnecting(true)
        try {
            // Prompt user to select USB device
            // Common thermal printer USB filters:
            const device = await navigator.usb.requestDevice({
                filters: [
                    { classCode: 7 },                           // Printer class
                    { vendorId: 0x04b8 },                       // Epson
                    { vendorId: 0x0519 },                       // Star Micronics
                    { vendorId: 0x0525 },                       // Xprinter / GOOJPRT
                    { vendorId: 0x28e9 },                       // Generic thermal
                ],
            })

            await device.open()

            // Select configuration 1 (default for most thermal printers)
            if (device.configuration === null) {
                await device.selectConfiguration(1)
            }

            // Claim the first interface
            const iface = device.configuration.interfaces[0]
            await device.claimInterface(iface.interfaceNumber)

            setPrinter(device)
            setPrinterName(device.productName || device.manufacturerName || 'USB Printer')
            console.log('[BillPrinter] Connected:', device.productName, device)
            dispatch(showToast({ message: `Printer connected: ${device.productName || 'USB Printer'}`, type: 'success' }))
        } catch (err) {
            if (err.name !== 'NotFoundError') {   // User cancelled — not an error
                console.error('[BillPrinter] Connect failed:', err)
                dispatch(showToast({ message: `Printer connect failed: ${err.message}`, type: 'error' }))
            }
        } finally {
            setConnecting(false)
        }
    }

    // Disconnect printer
    const handleDisconnect = async () => {
        if (!printer) return
        try {
            await printer.close()
        } catch { }
        setPrinter(null)
        setPrinterName(null)
    }

    // Print via USB ESC/POS
    const handleUsbPrint = async () => {
        if (!printer || !bill) return
        setPrinting(true)
        try {
            const data = buildEscPos(bill, 32)

            // Find bulk OUT endpoint
            const iface = printer.configuration.interfaces[0]
            const altIface = iface.alternates[0]
            const endpoint = altIface.endpoints.find(e => e.direction === 'out' && e.type === 'bulk')

            if (!endpoint) throw new Error('No bulk OUT endpoint found on printer')

            await printer.transferOut(endpoint.endpointNumber, data)
            console.log('[BillPrinter] Printed bill for order', bill.orderId, '| bytes sent:', data.length)
            dispatch(showToast({ message: 'Bill printed successfully', type: 'success' }))
        } catch (err) {
            console.error('[BillPrinter] Print failed:', err)
            dispatch(showToast({ message: `Print failed: ${err.message}`, type: 'error' }))
        } finally {
            setPrinting(false)
        }
    }

    // Browser window.print() fallback
    const handleBrowserPrint = () => {
        if (!bill) return
        const win = window.open('', '_blank', 'width=400,height=600')
        win.document.write(buildHtmlBill(bill))
        win.document.close()
    }

    return (
        <Modal
            title={`Bill — Order #${order?.id?.slice(-8)}`}
            open={open}
            onClose={onClose}
            size="md"
            footer={
                <div className="flex items-center gap-2 w-full">
                    {/* Printer connection */}
                    {usbSupported && (
                        printer ? (
                            <button onClick={handleDisconnect}
                                className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors">
                                🖨 {printerName} ✓
                            </button>
                        ) : (
                            <Button variant="secondary" loading={connecting} onClick={handleConnectPrinter}>
                                🔌 Connect Printer
                            </Button>
                        )
                    )}

                    <div className="flex gap-2 ml-auto">
                        <Button variant="secondary" onClick={onClose}>Close</Button>
                        {/* Browser print fallback */}
                        <Button variant="secondary" onClick={handleBrowserPrint} disabled={!bill}>
                            🖥 Browser Print
                        </Button>
                        {/* USB print — only if printer connected */}
                        {printer && (
                            <Button variant="primary" loading={printing} onClick={handleUsbPrint} disabled={!bill}>
                                🖨 Print
                            </Button>
                        )}
                    </div>
                </div>
            }
        >
            {loading ? (
                <div className="py-12 text-center text-sm text-gray-400">Loading bill…</div>
            ) : !bill ? (
                <div className="py-12 text-center text-sm text-red-400">Failed to load bill</div>
            ) : (
                // ── Bill preview ─────────────────────────────────────
                <div className="font-mono text-xs bg-white border border-gray-200 rounded-xl p-4 space-y-2 max-h-[60vh] overflow-y-auto">

                    {/* Mart header */}
                    <div className="text-center space-y-0.5">
                        <p className="font-black text-sm">{bill.mart.name}</p>
                        {bill.mart.address && <p className="text-gray-500">{bill.mart.address}</p>}
                        {bill.mart.city && <p className="text-gray-500">{bill.mart.city}{bill.mart.pincode ? ` - ${bill.mart.pincode}` : ''}</p>}
                        {bill.mart.phone && <p className="text-gray-500">Ph: {bill.mart.phone}</p>}
                        {bill.mart.gstin && <p className="text-gray-400 text-[10px]">GSTIN: {bill.mart.gstin}</p>}
                    </div>

                    <div className="border-t border-dashed border-gray-300" />

                    {/* Order info */}
                    <div className="space-y-0.5 text-[11px]">
                        <p>Order  : <span className="font-bold">#{bill.orderId.slice(-8)}</span></p>
                        <p>Date   : {new Date(bill.orderDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                        <p>Payment: {bill.paymentMethod.toUpperCase()}</p>
                        <p>Type   : {bill.orderType.toUpperCase()}</p>
                    </div>

                    {/* Customer */}
                    {(bill.customer?.name || bill.customer?.phone) && (
                        <>
                            <div className="border-t border-dashed border-gray-300" />
                            <div className="text-[11px] space-y-0.5">
                                {bill.customer.name && <p className="font-bold">{bill.customer.name}</p>}
                                {bill.customer.line1 && <p className="text-gray-500">{bill.customer.line1}</p>}
                                {bill.customer.city && <p className="text-gray-500">{bill.customer.city}</p>}
                                {bill.customer.phone && <p className="text-gray-500">Ph: {bill.customer.phone}</p>}
                            </div>
                        </>
                    )}

                    <div className="border-t border-dashed border-gray-300" />

                    {/* Items */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase">
                            <span>Item</span>
                            <div className="flex gap-4">
                                <span>Qty</span>
                                <span className="w-16 text-right">Amt</span>
                            </div>
                        </div>
                        <div className="border-t border-dashed border-gray-200" />
                        {bill.items.map((item, i) => (
                            <div key={i} className="space-y-0.5">
                                <div className="flex justify-between gap-2">
                                    <span className="flex-1 leading-tight">
                                        {item.productName}
                                        {item.variantId ? <span className="text-gray-400"> ({item.variantId})</span> : ''}
                                    </span>
                                    <div className="flex gap-4 shrink-0">
                                        <span className="text-gray-600">x{item.quantity}</span>
                                        <span className="w-16 text-right font-medium">₹{parseFloat(item.totalPrice).toFixed(2)}</span>
                                    </div>
                                </div>
                                {item.quantity > 1 && (
                                    <p className="text-[10px] text-gray-400 pl-2">@ ₹{parseFloat(item.unitPrice).toFixed(2)} each</p>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-dashed border-gray-300" />

                    {/* Totals */}
                    <div className="space-y-0.5 text-[11px]">
                        <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>₹{parseFloat(bill.totals.subtotal).toFixed(2)}</span>
                        </div>
                        {bill.totals.deliveryFee > 0 && (
                            <div className="flex justify-between">
                                <span>Delivery</span>
                                <span>₹{parseFloat(bill.totals.deliveryFee).toFixed(2)}</span>
                            </div>
                        )}
                        {bill.totals.discount > 0 && (
                            <div className="flex justify-between text-green-600">
                                <span>Discount</span>
                                <span>-₹{parseFloat(bill.totals.discount).toFixed(2)}</span>
                            </div>
                        )}
                        {bill.totals.tax > 0 && (
                            <div className="flex justify-between">
                                <span>Tax</span>
                                <span>₹{parseFloat(bill.totals.tax).toFixed(2)}</span>
                            </div>
                        )}
                    </div>

                    <div className="border-t-2 border-gray-800" />
                    <div className="flex justify-between font-black text-sm">
                        <span>TOTAL</span>
                        <span>₹{parseFloat(bill.totals.total).toFixed(2)}</span>
                    </div>
                    <div className="border-t-2 border-gray-800" />

                    <p className="text-center text-gray-400 text-[10px] pt-1">Thank you for shopping! Visit again.</p>
                </div>
            )}
        </Modal>
    )
}