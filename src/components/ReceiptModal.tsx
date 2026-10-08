import React, { useState } from 'react';
import { Printer, X, CheckCircle2 } from 'lucide-react';
import { Bill } from '../types/pos';
import { usePOS } from '../context/POSContext';

interface ReceiptModalProps {
  bill: Bill;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ bill, onClose }) => {
  const { settings, tables } = usePOS();
  const currentTable = tables.find((t) => t.id === bill.tableId);
  const tableName = currentTable?.name || `Table ${bill.tableId}`;
  const [receiptWidth, setReceiptWidth] = useState<'80mm' | '58mm'>('80mm');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-neutral-200 overflow-hidden my-8">
        {/* Header toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-neutral-900 text-white print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold tracking-wide">
              Thermal Receipt ({receiptWidth})
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* 58mm / 80mm Paper Width Toggle */}
            <div className="flex items-center p-0.5 bg-neutral-800 rounded-md text-[11px]">
              <button
                type="button"
                onClick={() => setReceiptWidth('80mm')}
                className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                  receiptWidth === '80mm'
                    ? 'bg-white text-neutral-900'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                80mm
              </button>
              <button
                type="button"
                onClick={() => setReceiptWidth('58mm')}
                className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                  receiptWidth === '58mm'
                    ? 'bg-white text-neutral-900'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                58mm
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Thermal Receipt Area */}
        <div
          className={`mx-auto p-5 bg-white text-neutral-950 font-mono-numbers text-xs leading-relaxed transition-all ${
            receiptWidth === '58mm' ? 'max-w-[58mm] text-[10px]' : 'max-w-[80mm]'
          }`}
          id="printable-receipt"
          data-width={receiptWidth}
        >
          {/* 1. Restaurant Header */}
          <div className="text-center pb-3 border-b border-dashed border-neutral-400">
            <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-neutral-900">
              {settings.name || 'PRIMECENTURY RESTAURANT & CAFE'}
            </h2>
            {settings.tagline && (
              <p className="text-[10px] text-neutral-600 mt-0.5">{settings.tagline}</p>
            )}
            <p className="text-[10px] text-neutral-600 mt-1 max-w-xs mx-auto leading-tight">
              {settings.address}
            </p>
            <p className="text-[10px] text-neutral-600 mt-0.5">Ph: {settings.phone}</p>
            <div className="flex justify-center gap-2 text-[10px] text-neutral-700 mt-1 font-semibold">
              <span>GSTIN: {settings.gstin}</span>
              <span>·</span>
              <span>FSSAI: {settings.fssai}</span>
            </div>
          </div>

          {/* 2. Bill Meta Information */}
          <div className="py-2.5 border-b border-dashed border-neutral-400 space-y-1 text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-neutral-600">Bill No:</span>
              <span className="font-bold text-neutral-900">{bill.billNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-600">Table:</span>
              <span className="font-bold text-neutral-900">{tableName}</span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-neutral-600">Date & Time:</span>
              <span>
                {new Date(bill.paidAt).toLocaleString('en-IN', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-neutral-600">Cashier:</span>
              <span>{bill.cashierName}</span>
            </div>
          </div>

          {/* 3. Items, Quantity, Item Price & Line Total */}
          <div className="py-2.5 border-b border-dashed border-neutral-400">
            <div className="grid grid-cols-12 text-[10px] font-bold text-neutral-800 uppercase pb-1 mb-1 border-b border-neutral-300">
              <span className="col-span-6">Item</span>
              <span className="col-span-2 text-center">Qty</span>
              <span className="col-span-2 text-right">Price</span>
              <span className="col-span-2 text-right">Total</span>
            </div>
            <div className="space-y-1.5 pt-0.5">
              {bill.items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 text-[11px] items-center">
                  <div className="col-span-6 truncate font-medium text-neutral-900 pr-1">
                    {item.name}
                  </div>
                  <div className="col-span-2 text-center text-neutral-700">{item.quantity}</div>
                  <div className="col-span-2 text-right text-neutral-700">₹{item.price}</div>
                  <div className="col-span-2 text-right font-bold text-neutral-950">
                    ₹{item.price * item.quantity}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Subtotal, Discount, Tax Breakdown & Grand Total */}
          <div className="py-2.5 border-b border-dashed border-neutral-400 text-[11px] space-y-1">
            <div className="flex justify-between text-neutral-700">
              <span>Subtotal:</span>
              <span>₹{bill.subtotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-neutral-700">
              <span>
                Discount {bill.discountAmount > 0 && bill.discountType === 'percentage' ? `(${bill.discountValue}%)` : ''}:
              </span>
              <span className={bill.discountAmount > 0 ? 'text-neutral-900 font-semibold' : ''}>
                {bill.discountAmount > 0 ? `- ₹${bill.discountAmount.toFixed(2)}` : '₹0.00'}
              </span>
            </div>

            <div className="flex justify-between text-neutral-700">
              <span>CGST ({bill.cgstRate}%):</span>
              <span>₹{bill.cgstAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-neutral-700">
              <span>SGST ({bill.sgstRate}%):</span>
              <span>₹{bill.sgstAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-xs sm:text-sm font-black text-neutral-950 pt-2 border-t-2 border-neutral-900">
              <span>GRAND TOTAL:</span>
              <span className="text-sm sm:text-base font-black">₹{bill.grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* 5. Payment Method & PAID Status */}
          <div className="py-2.5 border-b border-dashed border-neutral-400 text-[11px] space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-neutral-600">Payment Mode:</span>
              <span className="font-bold uppercase px-1.5 py-0.5 bg-neutral-100 rounded text-neutral-900">
                {bill.paymentMethod}
              </span>
            </div>

            {bill.paymentMethod === 'cash' && bill.cashReceived && (
              <>
                <div className="flex justify-between text-neutral-700">
                  <span>Cash Received:</span>
                  <span>₹{bill.cashReceived.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-neutral-700">
                  <span>Change Returned:</span>
                  <span>₹{(bill.changeGiven || 0).toFixed(2)}</span>
                </div>
              </>
            )}

            <div className="flex justify-between items-center pt-0.5">
              <span className="text-neutral-600">Payment Status:</span>
              <span className="font-black text-emerald-800 uppercase flex items-center gap-1 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                PAID
              </span>
            </div>
          </div>

          {/* 6. Thank You Message */}
          <div className="pt-3 pb-1 text-center text-[10px] text-neutral-600 space-y-1">
            <p className="font-black text-neutral-900 text-[11px] uppercase tracking-wide">
              Thank You for Dining With Us!
            </p>
            <p>Please Visit Again</p>
            <p className="text-[9px] text-neutral-400 pt-1">
              *** Thermal POS Receipt ***
            </p>
          </div>
        </div>

        {/* Action Buttons (Hidden during printing) */}
        <div className="flex items-center gap-3 p-4 bg-neutral-50 border-t border-neutral-200 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-colors shadow-sm uppercase tracking-wide"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>Print Receipt</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-3 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-100 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
