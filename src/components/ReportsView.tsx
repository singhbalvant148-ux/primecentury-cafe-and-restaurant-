import React, { useState } from 'react';
import {
  BarChart3,
  IndianRupee,
  Receipt,
  CreditCard,
  QrCode,
  Banknote,
  Printer,
  Calendar,
  Eye,
  TrendingUp,
  Download,
} from 'lucide-react';
import { usePOS } from '../context/POSContext';
import { Bill } from '../types/pos';
import { ReceiptModal } from './ReceiptModal';

export const ReportsView: React.FC = () => {
  const { bills, settings } = usePOS();
  const [selectedReceipt, setSelectedReceipt] = useState<Bill | null>(null);
  const [dateFilter, setDateFilter] = useState<'today' | 'all'>('today');

  // Compute metrics
  const totalSales = bills.reduce((sum, b) => sum + b.grandTotal, 0);
  const totalOrders = bills.length;
  const avgOrderValue = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;
  const totalDiscount = bills.reduce((sum, b) => sum + b.discountAmount, 0);
  const totalCGST = bills.reduce((sum, b) => sum + b.cgstAmount, 0);
  const totalSGST = bills.reduce((sum, b) => sum + b.sgstAmount, 0);
  const totalTax = totalCGST + totalSGST;

  // Payment method totals
  const cashBills = bills.filter((b) => b.paymentMethod === 'cash');
  const upiBills = bills.filter((b) => b.paymentMethod === 'upi');
  const cardBills = bills.filter((b) => b.paymentMethod === 'card');

  const cashTotal = cashBills.reduce((s, b) => s + b.grandTotal, 0);
  const upiTotal = upiBills.reduce((s, b) => s + b.grandTotal, 0);
  const cardTotal = cardBills.reduce((s, b) => s + b.grandTotal, 0);

  // Top selling items
  const itemCounts: { [name: string]: { qty: number; total: number; isVeg: boolean } } = {};
  bills.forEach((b) => {
    b.items.forEach((it) => {
      if (!itemCounts[it.name]) {
        itemCounts[it.name] = { qty: 0, total: 0, isVeg: it.isVeg };
      }
      itemCounts[it.name].qty += it.quantity;
      itemCounts[it.name].total += it.price * it.quantity;
    });
  });

  const topItems = Object.entries(itemCounts)
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 6);

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-neutral-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">
            Sales & Financial Reports
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Daily register summary, revenue breakdowns, and payment method audit
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintReport}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg transition-colors shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Total Sales</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-neutral-900 font-mono-numbers">
              ₹{totalSales.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-neutral-500 mt-1">
              Net Taxable: ₹{(totalSales - totalTax).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        {/* Number of Orders */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Paid Invoices</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-neutral-900 font-mono-numbers">
              {totalOrders}
            </div>
            <div className="text-[11px] text-neutral-500 mt-1">
              Avg Ticket: ₹{avgOrderValue.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* GST / Taxes Collected */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">GST Collected</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-neutral-900 font-mono-numbers">
              ₹{totalTax.toFixed(2)}
            </div>
            <div className="text-[11px] text-neutral-500 mt-1">
              CGST: ₹{totalCGST.toFixed(2)} · SGST: ₹{totalSGST.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Discounts Given */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Discounts Given</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-neutral-900 font-mono-numbers">
              ₹{totalDiscount.toFixed(2)}
            </div>
            <div className="text-[11px] text-neutral-500 mt-1">
              Promotional savings allowed
            </div>
          </div>
        </div>
      </div>

      {/* Payment Methods Breakdown & Top Dishes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Payment Method Totals */}
        <div className="lg:col-span-6 bg-white p-5 rounded-xl border border-neutral-200 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-neutral-100">
            <h2 className="text-sm font-bold text-neutral-900">Payment Method Totals</h2>
            <p className="text-[11px] text-neutral-500">Breakdown of collections across all registers</p>
          </div>

          <div className="space-y-3">
            {/* Cash */}
            <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-neutral-900">Cash Payments</div>
                  <div className="text-[11px] text-neutral-500">{cashBills.length} transactions</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-bold text-neutral-900 font-mono-numbers">
                  ₹{cashTotal.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-neutral-500">
                  {totalSales > 0 ? Math.round((cashTotal / totalSales) * 100) : 0}% of revenue
                </div>
              </div>
            </div>

            {/* UPI */}
            <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-neutral-900">UPI / QR Scan</div>
                  <div className="text-[11px] text-neutral-500">{upiBills.length} transactions</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-bold text-neutral-900 font-mono-numbers">
                  ₹{upiTotal.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-neutral-500">
                  {totalSales > 0 ? Math.round((upiTotal / totalSales) * 100) : 0}% of revenue
                </div>
              </div>
            </div>

            {/* Card */}
            <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-neutral-900">Card / POS Terminal</div>
                  <div className="text-[11px] text-neutral-500">{cardBills.length} transactions</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-bold text-neutral-900 font-mono-numbers">
                  ₹{cardTotal.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-neutral-500">
                  {totalSales > 0 ? Math.round((cardTotal / totalSales) * 100) : 0}% of revenue
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Selling Items */}
        <div className="lg:col-span-6 bg-white p-5 rounded-xl border border-neutral-200 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-neutral-100">
            <h2 className="text-sm font-bold text-neutral-900">Top Selling Dishes</h2>
            <p className="text-[11px] text-neutral-500">Highest volume items sold today</p>
          </div>

          <div className="space-y-2.5">
            {topItems.length === 0 ? (
              <p className="text-xs text-neutral-400 py-6 text-center">No dishes sold yet.</p>
            ) : (
              topItems.map(([name, data], idx) => (
                <div
                  key={name}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-neutral-50 border border-neutral-100 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-100 text-neutral-600 font-bold text-[10px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        data.isVeg ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}
                    ></span>
                    <span className="font-semibold text-neutral-900">{name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-neutral-500 font-mono-numbers">
                      {data.qty} sold
                    </span>
                    <span className="font-bold text-neutral-900 font-mono-numbers">
                      ₹{data.total.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Completed Bills Ledger (Reprint receipts) */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-neutral-900">Settled Bills Ledger</h2>
            <p className="text-[11px] text-neutral-500">
              Audit trail of all paid receipts. Click View/Print to reprint 80mm receipt.
            </p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 bg-neutral-100 rounded text-neutral-700">
            {bills.length} Bills
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase text-[10px] font-semibold tracking-wider">
                <th className="px-4 py-3">Bill Number</th>
                <th className="px-4 py-3">Table</th>
                <th className="px-4 py-3">Cashier</th>
                <th className="px-4 py-3">Payment Mode</th>
                <th className="px-4 py-3 text-right">Tax (₹)</th>
                <th className="px-4 py-3 text-right">Grand Total (₹)</th>
                <th className="px-4 py-3 text-right">Time Paid</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {bills.map((bill) => (
                <tr key={bill.id} className="hover:bg-neutral-50/70 transition-colors">
                  <td className="px-4 py-3 font-bold text-neutral-900 font-mono-numbers">
                    {bill.billNumber}
                  </td>
                  <td className="px-4 py-3 font-medium text-neutral-800">
                    Table {bill.tableId}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{bill.cashierName}</td>
                  <td className="px-4 py-3">
                    <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-100 text-neutral-800">
                      {bill.paymentMethod}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-600 font-mono-numbers">
                    ₹{(bill.cgstAmount + bill.sgstAmount).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-neutral-900 font-mono-numbers text-sm">
                    ₹{bill.grandTotal.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-500 font-mono-numbers text-[11px]">
                    {new Date(bill.paidAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedReceipt(bill)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Receipt</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Modal */}
      {selectedReceipt && (
        <ReceiptModal bill={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
      )}
    </div>
  );
};
