import React from 'react';
import { Printer, X, ChefHat } from 'lucide-react';
import { KOT } from '../types/pos';
import { usePOS } from '../context/POSContext';

interface KOTModalProps {
  kot: KOT;
  onClose: () => void;
}

export const KOTModal: React.FC<KOTModalProps> = ({ kot, onClose }) => {
  const { settings, tables } = usePOS();
  const currentTable = tables.find((t) => t.id === kot.tableId);
  const tableName = currentTable?.name || `Table #${kot.tableId}`;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(kot.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const formattedTime = new Date(kot.createdAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl border border-neutral-200 overflow-hidden">
        {/* Header toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-neutral-900 text-white print:hidden">
          <div className="flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold tracking-wide">KOT Ticket #{kot.kotNumber}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable KOT Area - Standard Thermal Printer Layout */}
        <div className="p-5 bg-white text-neutral-900 font-mono-numbers text-xs leading-relaxed" id="printable-receipt">
          {/* Header */}
          <div className="text-center pb-2 border-b-2 border-neutral-900">
            <h2 className="text-base font-black tracking-wider uppercase">*** KITCHEN ORDER TICKET ***</h2>
            <p className="text-xs font-bold text-neutral-800">{settings.name}</p>
          </div>

          {/* Meta Details */}
          <div className="py-2.5 border-b-2 border-dashed border-neutral-900 text-xs space-y-1">
            <div className="flex justify-between items-center">
              <span className="font-black text-xl text-neutral-900">{tableName.toUpperCase()}</span>
              <span className="font-black text-sm bg-neutral-100 border border-neutral-900 px-2 py-0.5 rounded">
                KOT #{kot.kotNumber}
              </span>
            </div>
            <div className="flex justify-between text-neutral-800 font-semibold text-xs pt-1">
              <span>Order #: {kot.orderId}</span>
              <span>Type: Dine-In</span>
            </div>
            <div className="flex justify-between text-neutral-700 text-[11px]">
              <span>Date: {formattedDate}</span>
              <span>Time: {formattedTime}</span>
            </div>
            <div className="text-neutral-700 text-[11px]">
              Server / Waiter: <span className="font-bold text-neutral-900">{kot.waiterName}</span>
            </div>
          </div>

          {/* Items */}
          <div className="py-3 border-b-2 border-neutral-900">
            <div className="flex justify-between font-black text-xs pb-1 mb-2 border-b border-neutral-900 uppercase">
              <span>ITEM NAME</span>
              <span className="text-right">QTY</span>
            </div>
            <div className="space-y-2.5 pt-1">
              {kot.items.map((item, idx) => (
                <div key={idx} className="pb-2 border-b border-dashed border-neutral-200 last:border-0 last:pb-0">
                  <div className="flex justify-between items-start text-xs">
                    <div className="font-black text-sm text-neutral-900 leading-snug flex-1 pr-2">
                      {item.name}
                    </div>
                    <span className="font-black text-base text-neutral-900 px-2 py-0.5 bg-neutral-100 border border-neutral-900 rounded shrink-0">
                      x{item.quantity}
                    </span>
                  </div>
                  {item.notes && (
                    <div className="mt-1 text-[11px] font-bold text-neutral-900 bg-neutral-100 p-1.5 rounded border border-neutral-400">
                      *** NOTE: {item.notes} ***
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-2 text-center text-xs text-neutral-700 space-y-0.5">
            <div className="font-bold">Total Items: {kot.items.reduce((s, it) => s + it.quantity, 0)}</div>
            <div className="text-[10px] uppercase font-semibold text-neutral-500">
              KOT #{kot.kotNumber} · Status: <span className="font-bold text-neutral-900">{kot.status.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 p-4 bg-neutral-50 border-t border-neutral-200 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print KOT
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
