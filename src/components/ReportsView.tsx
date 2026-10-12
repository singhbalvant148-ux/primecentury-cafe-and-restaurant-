import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  IndianRupee,
  Receipt,
  CreditCard,
  QrCode,
  Banknote,
  Printer,
  Calendar as CalendarIcon,
  Eye,
  TrendingUp,
  Trash2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  CheckCircle2,
  Clock,
  UtensilsCrossed,
  X,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { usePOS } from '../context/POSContext';
import { Bill } from '../types/pos';
import { ReceiptModal } from './ReceiptModal';

// Timezone-safe local date string (YYYY-MM-DD)
function getLocalDateString(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getBillDateString(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDisplayDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const ReportsView: React.FC = () => {
  const { bills, currentUser, deleteBill, settings } = usePOS();

  // -------------------------------------------------------------
  // Owner Authorization Check (Server & Client Guard)
  // -------------------------------------------------------------
  const isOwner = currentUser?.role === 'owner';

  // Date selection state: defaults to today
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateString());
  const [selectedReceipt, setSelectedReceipt] = useState<Bill | null>(null);

  // Deletion modal state
  const [billToDelete, setBillToDelete] = useState<Bill | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteNotification, setDeleteNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Access restriction guard
  if (!isOwner) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-10 text-center max-w-lg mx-auto shadow-2xs my-12">
        <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center mx-auto mb-3">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-neutral-900">Access Restricted</h2>
        <p className="text-xs text-neutral-600 mt-1.5 leading-relaxed">
          Daily Sales revenue reports, totals, and bill auditing are restricted strictly to authenticated{' '}
          <strong className="text-neutral-900 font-semibold">Owner</strong> accounts.
        </p>
        <p className="text-xs text-neutral-500 mt-2">
          Your current authenticated role:{' '}
          <span className="font-mono font-semibold uppercase px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-800">
            {currentUser?.role || 'Guest'}
          </span>
        </p>
      </div>
    );
  }

  // Quick date navigation helpers
  const handleQuickDate = (offsetDays: number) => {
    const target = new Date();
    target.setDate(target.getDate() + offsetDays);
    setSelectedDate(getLocalDateString(target));
  };

  const handleStepDay = (step: number) => {
    const parts = selectedDate.split('-');
    if (parts.length === 3) {
      const current = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      current.setDate(current.getDate() + step);
      setSelectedDate(getLocalDateString(current));
    }
  };

  const isToday = selectedDate === getLocalDateString();
  const isYesterday =
    selectedDate === getLocalDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));

  // -------------------------------------------------------------
  // Filter Bills for Selected Date & Compute Totals
  // -------------------------------------------------------------
  const dateBills = useMemo(() => {
    return bills.filter((b) => getBillDateString(b.paidAt) === selectedDate);
  }, [bills, selectedDate]);

  // Aggregate Metrics
  const totalSales = useMemo(
    () => dateBills.reduce((sum, b) => sum + b.grandTotal, 0),
    [dateBills]
  );
  const totalOrders = dateBills.length;
  const avgOrderValue = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;
  const totalDiscount = useMemo(
    () => dateBills.reduce((sum, b) => sum + b.discountAmount, 0),
    [dateBills]
  );
  const totalCGST = useMemo(
    () => dateBills.reduce((sum, b) => sum + b.cgstAmount, 0),
    [dateBills]
  );
  const totalSGST = useMemo(
    () => dateBills.reduce((sum, b) => sum + b.sgstAmount, 0),
    [dateBills]
  );
  const totalTax = totalCGST + totalSGST;
  const netTaxable = totalSales - totalTax;

  // Payment method breakdowns
  const cashBills = dateBills.filter((b) => b.paymentMethod === 'cash');
  const upiBills = dateBills.filter((b) => b.paymentMethod === 'upi');
  const cardBills = dateBills.filter((b) => b.paymentMethod === 'card');

  const cashTotal = cashBills.reduce((s, b) => s + b.grandTotal, 0);
  const upiTotal = upiBills.reduce((s, b) => s + b.grandTotal, 0);
  const cardTotal = cardBills.reduce((s, b) => s + b.grandTotal, 0);

  // Top selling items on this date
  const topItems = useMemo(() => {
    const itemCounts: Record<string, { qty: number; total: number; isVeg: boolean }> = {};
    dateBills.forEach((b) => {
      b.items.forEach((it) => {
        if (!itemCounts[it.name]) {
          itemCounts[it.name] = { qty: 0, total: 0, isVeg: it.isVeg };
        }
        itemCounts[it.name].qty += it.quantity;
        itemCounts[it.name].total += it.price * it.quantity;
      });
    });
    return Object.entries(itemCounts)
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 6);
  }, [dateBills]);

  // -------------------------------------------------------------
  // Delete Bill Handler
  // -------------------------------------------------------------
  const handleConfirmDelete = async () => {
    if (!billToDelete) return;
    setIsDeleting(true);
    setDeleteNotification(null);

    try {
      const res = await deleteBill(billToDelete.id);
      if (res.success) {
        setDeleteNotification({
          type: 'success',
          message: res.message || `Bill ${billToDelete.billNumber} successfully deleted.`,
        });
        setBillToDelete(null);
      } else {
        setDeleteNotification({
          type: 'error',
          message: res.message || 'Failed to delete bill. Owner authorization required.',
        });
      }
    } catch (err: any) {
      setDeleteNotification({
        type: 'error',
        message: err.message || 'An unexpected error occurred during bill deletion.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">
              Daily Sales &amp; Financial Register
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 uppercase tracking-wide">
              Owner Only
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Full audit ledger, daily revenue analytics, and authenticated invoice management
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintReport}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg transition-colors shadow-2xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Day Report</span>
          </button>
        </div>
      </div>

      {/* Toast Notification Banner */}
      {deleteNotification && (
        <div
          className={`p-3 text-xs rounded-xl flex items-center justify-between border shadow-2xs animate-in fade-in ${
            deleteNotification.type === 'success'
              ? 'text-emerald-900 bg-emerald-50 border-emerald-200'
              : 'text-rose-900 bg-rose-50 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {deleteNotification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{deleteNotification.message}</span>
          </div>
          <button
            onClick={() => setDeleteNotification(null)}
            className="p-1 hover:bg-black/5 rounded text-neutral-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DAILY SALES CALENDAR & DATE PICKER CONTROLS                   */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Active Date Label */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5 text-neutral-500" />
              <span>Viewing Register For</span>
            </div>
            <div className="text-base sm:text-lg font-bold text-neutral-900 mt-0.5 flex items-center gap-2">
              <span>{formatDisplayDate(selectedDate)}</span>
              {isToday && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Today
                </span>
              )}
              {isYesterday && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  Yesterday
                </span>
              )}
            </div>
          </div>

          {/* Controls: Date Picker & Navigation Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Presets */}
            <div className="inline-flex rounded-lg border border-neutral-200 p-0.5 bg-neutral-50 text-xs">
              <button
                type="button"
                onClick={() => handleQuickDate(0)}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                  isToday
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleQuickDate(-1)}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                  isYesterday
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Yesterday
              </button>
            </div>

            {/* Stepper Buttons */}
            <div className="flex items-center rounded-lg border border-neutral-200 bg-white">
              <button
                type="button"
                onClick={() => handleStepDay(-1)}
                className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded-l-lg transition-colors cursor-pointer"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-neutral-200" />
              <button
                type="button"
                onClick={() => handleStepDay(1)}
                className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded-r-lg transition-colors cursor-pointer"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* HTML5 Native Calendar Date Picker */}
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value);
                  }
                }}
                className="pl-3 pr-3 py-1.5 text-xs font-semibold rounded-lg border border-neutral-300 bg-white text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 shadow-2xs cursor-pointer"
                title="Choose calendar date"
              />
            </div>
          </div>
        </div>

        {/* Date Summary Status Ribbon */}
        <div className="pt-3 border-t border-neutral-100 flex flex-wrap items-center justify-between text-xs text-neutral-500 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-800 font-mono-numbers">
              {dateBills.length}
            </span>
            <span>settled bills on this date</span>
            <span>·</span>
            <span className="font-semibold text-neutral-800 font-mono-numbers">
              ₹{totalSales.toLocaleString('en-IN')}
            </span>
            <span>collected</span>
          </div>

          {dateBills.length === 0 && (
            <span className="text-amber-700 font-medium">
              No transactions recorded for {formatDisplayDate(selectedDate)}
            </span>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* PRIMARY KPI METRICS FOR SELECTED DATE                         */}
      {/* ------------------------------------------------------------- */}
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
              ₹{totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-neutral-500 mt-1">
              Net Taxable: ₹{netTaxable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        {/* Paid Invoices */}
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

        {/* GST Collected */}
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
              Promotional savings applied
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* PAYMENT METHOD TOTALS & TOP DISHES ON SELECTED DATE           */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Payment Methods */}
        <div className="lg:col-span-6 bg-white p-5 rounded-xl border border-neutral-200 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-neutral-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">Payment Methods Breakdown</h2>
              <p className="text-[11px] text-neutral-500">Collections on {formatDisplayDate(selectedDate)}</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
              {dateBills.length} Total
            </span>
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
                  ₹{cashTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-neutral-500">
                  {totalSales > 0 ? Math.round((cashTotal / totalSales) * 100) : 0}% of day
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
                  ₹{upiTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-neutral-500">
                  {totalSales > 0 ? Math.round((upiTotal / totalSales) * 100) : 0}% of day
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
                  <div className="text-xs font-bold text-neutral-900">Card Terminal / POS</div>
                  <div className="text-[11px] text-neutral-500">{cardBills.length} transactions</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-bold text-neutral-900 font-mono-numbers">
                  ₹{cardTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-neutral-500">
                  {totalSales > 0 ? Math.round((cardTotal / totalSales) * 100) : 0}% of day
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Selling Items */}
        <div className="lg:col-span-6 bg-white p-5 rounded-xl border border-neutral-200 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-neutral-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">Top Selling Dishes</h2>
              <p className="text-[11px] text-neutral-500">Highest volume items on {formatDisplayDate(selectedDate)}</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {topItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-400">
                <UtensilsCrossed className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                <span>No dishes recorded for this date.</span>
              </div>
            ) : (
              topItems.map(([name, data], idx) => (
                <div
                  key={name}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-neutral-50 border border-neutral-100 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-5 h-5 rounded-full bg-neutral-100 text-neutral-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        data.isVeg ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}
                    />
                    <span className="font-semibold text-neutral-900 truncate">{name}</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
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

      {/* ------------------------------------------------------------- */}
      {/* SETTLED BILLS LEDGER (OWNER BILL VIEW & DELETION)            */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-neutral-900">
                Settled Bills Ledger · {formatDisplayDate(selectedDate)}
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 bg-neutral-100 rounded text-neutral-700">
                {dateBills.length} Bills
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Click &quot;Receipt&quot; to reprint. Authenticated Owners may permanently delete an erroneous bill.
            </p>
          </div>
        </div>

        {dateBills.length === 0 ? (
          <div className="p-12 text-center text-neutral-500">
            <Receipt className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-neutral-800">No Bills Found</h3>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
              There are no settled bills on {formatDisplayDate(selectedDate)}. Select another calendar date or switch to today.
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => handleQuickDate(0)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Go to Today&apos;s Bills
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase text-[10px] font-semibold tracking-wider">
                  <th className="px-4 py-3">Bill Number</th>
                  <th className="px-4 py-3">Table</th>
                  <th className="px-4 py-3">Cashier</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3 text-right">Tax (₹)</th>
                  <th className="px-4 py-3 text-right">Grand Total (₹)</th>
                  <th className="px-4 py-3 text-right">Time Paid</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {dateBills.map((bill) => (
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
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedReceipt(bill)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors cursor-pointer"
                          title="View & reprint bill receipt"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Receipt</span>
                        </button>

                        {/* Owner-Only Delete Bill Button */}
                        <button
                          type="button"
                          onClick={() => setBillToDelete(bill)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors cursor-pointer"
                          title="Delete bill permanently (Owner Only)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* OWNER BILL DELETION CONFIRMATION DIALOG MODAL                 */}
      {/* ------------------------------------------------------------- */}
      {billToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full border border-neutral-200 shadow-2xl overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 bg-rose-50 border-b border-rose-100 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-rose-950">
                  Confirm Bill Deletion
                </h3>
                <p className="text-xs text-rose-700 mt-0.5">
                  Action restricted to Owner · Changes will adjust daily revenue
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBillToDelete(null)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Detailed Bill Summary */}
            <div className="p-5 space-y-4">
              <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2.5 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
                  <span className="text-neutral-500 font-medium">Bill Number:</span>
                  <span className="font-bold text-neutral-900 font-mono text-sm">
                    {billToDelete.billNumber}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500">Table &amp; Cashier:</span>
                  <span className="font-semibold text-neutral-800">
                    Table {billToDelete.tableId} · {billToDelete.cashierName}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500">Payment Mode:</span>
                  <span className="font-semibold uppercase text-neutral-800">
                    {billToDelete.paymentMethod}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500">Time Settled:</span>
                  <span className="text-neutral-700 font-mono-numbers">
                    {new Date(billToDelete.paidAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-neutral-200">
                  <span className="font-bold text-neutral-900">Total Deduction:</span>
                  <span className="font-bold text-rose-700 font-mono-numbers text-base">
                    -₹{billToDelete.grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Itemized summary */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Items in this Bill ({billToDelete.items.length})
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1 text-xs border border-neutral-100 rounded-lg p-2 bg-white">
                  {billToDelete.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-neutral-700">
                      <span>
                        {it.quantity}x {it.name}
                      </span>
                      <span className="font-mono-numbers">₹{it.price * it.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Accounting Audit Notice */}
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>Audit Trail Notice</span>
                </div>
                <p className="leading-relaxed">
                  Deleting this bill will permanently deduct ₹{billToDelete.grandTotal.toFixed(2)} from the daily revenue, GST tax records, and invoice register for {formatDisplayDate(selectedDate)}. This event will be logged with your owner account.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setBillToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting Bill...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Bill</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Reprint Modal */}
      {selectedReceipt && (
        <ReceiptModal bill={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
      )}
    </div>
  );
};
