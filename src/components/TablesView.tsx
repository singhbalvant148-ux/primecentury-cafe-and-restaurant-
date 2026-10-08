import React, { useState } from 'react';
import {
  UtensilsCrossed,
  Users,
  Clock,
  PlusCircle,
  Receipt,
  CheckCircle2,
  AlertCircle,
  ChefHat,
  X,
  Sparkles,
} from 'lucide-react';
import { usePOS } from '../context/POSContext';
import { TableStatus } from '../types/pos';

export const TablesView: React.FC = () => {
  const {
    tables,
    orders,
    kots,
    setActiveTableId,
    setActiveView,
    createOrGetOrderForTable,
    addTable,
    currentUser,
  } = usePOS();

  const isOwnerOrAdmin = currentUser?.role === 'owner' || (currentUser as any)?.role === 'admin';

  const [statusFilter, setStatusFilter] = useState<'all' | TableStatus>('all');
  const [sectionFilter, setSectionFilter] = useState<string>('all');

  // Add Table Modal State (Owner/Admin Only)
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  const [tableNameInput, setTableNameInput] = useState('');
  const [tableCapacityInput, setTableCapacityInput] = useState(4);
  const [tableSectionInput, setTableSectionInput] = useState('Main Hall');
  const [addTableError, setAddTableError] = useState('');
  const [addTableSuccess, setAddTableSuccess] = useState('');

  const availableCount = tables.filter((t) => t.status === 'available').length;
  const occupiedCount = tables.filter((t) => t.status === 'occupied').length;
  const billedCount = tables.filter((t) => t.status === 'billed').length;

  // Extract distinct floor sections
  const distinctSections = Array.from(new Set(tables.map((t) => t.section).filter(Boolean)));
  const defaultSections = ['Main Hall', 'Garden Terrace', 'Family AC'];
  const allSections = ['all', ...Array.from(new Set([...defaultSections, ...distinctSections]))];

  const filteredTables = tables.filter((table) => {
    if (statusFilter !== 'all' && table.status !== statusFilter) return false;
    if (sectionFilter !== 'all' && table.section !== sectionFilter) return false;
    return true;
  });

  const handleTableClick = (tableId: number) => {
    setActiveTableId(tableId);
    createOrGetOrderForTable(tableId);
    setActiveView('menu');
  };

  const handleBillingClick = (e: React.MouseEvent, tableId: number) => {
    e.stopPropagation();
    setActiveTableId(tableId);
    setActiveView('billing');
  };

  const handleOpenAddTableModal = () => {
    // Generate next recommended table number
    const numbersInNames = tables
      .map((t) => {
        const m = t.name.match(/\d+/);
        return m ? parseInt(m[0], 10) : 0;
      })
      .filter((n) => !isNaN(n) && n > 0);
    const nextNum = numbersInNames.length > 0 ? Math.max(...numbersInNames) + 1 : tables.length + 1;

    setTableNameInput(`Table ${nextNum}`);
    setTableCapacityInput(4);
    setTableSectionInput('Main Hall');
    setAddTableError('');
    setIsAddTableModalOpen(true);
  };

  const handleAddTableSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddTableError('');

    if (!isOwnerOrAdmin) {
      setAddTableError('Permission Denied: ONLY the Owner/Admin can add new tables.');
      return;
    }

    const cleanName = tableNameInput.trim();
    if (!cleanName) {
      setAddTableError('Please enter a table number or name.');
      return;
    }

    const res = addTable({
      name: cleanName,
      capacity: tableCapacityInput,
      section: tableSectionInput,
    });

    if (!res.success) {
      setAddTableError(res.message || 'Failed to add table.');
      return;
    }

    setAddTableSuccess(res.message || `Table "${cleanName}" added successfully.`);
    setTimeout(() => setAddTableSuccess(''), 4000);
    setIsAddTableModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Success Notification Banner */}
      {addTableSuccess && (
        <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{addTableSuccess}</span>
          </div>
          <button
            onClick={() => setAddTableSuccess('')}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header and Summary Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">
              Table Management ({tables.length} Tables)
            </h1>

            {/* ONLY Owner/Admin can add new tables. Hidden for Cashier, Waiter, Kitchen, etc. */}
            {isOwnerOrAdmin && (
              <button
                type="button"
                onClick={handleOpenAddTableModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-sm transition-colors cursor-pointer"
                title="Add a new table (Owner Only)"
              >
                <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Add Table</span>
              </button>
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Real-time floor map. Click any table to start or modify its order.
            {!isOwnerOrAdmin && ' (Floor configuration managed by Owner)'}
          </p>
        </div>

        {/* Status badges summary */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 p-1 bg-neutral-100 rounded-lg text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 font-semibold rounded-md transition-colors ${
                statusFilter === 'all'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              All ({tables.length})
            </button>
            <button
              onClick={() => setStatusFilter('available')}
              className={`px-3 py-1.5 font-semibold rounded-md transition-colors ${
                statusFilter === 'available'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Available ({availableCount})
            </button>
            <button
              onClick={() => setStatusFilter('occupied')}
              className={`px-3 py-1.5 font-semibold rounded-md transition-colors ${
                statusFilter === 'occupied'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Occupied ({occupiedCount})
            </button>
            <button
              onClick={() => setStatusFilter('billed')}
              className={`px-3 py-1.5 font-semibold rounded-md transition-colors ${
                statusFilter === 'billed'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Billed ({billedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Section Filters */}
      <div className="flex items-center gap-2 text-xs flex-wrap">
        <span className="text-neutral-500 font-medium">Floor Area:</span>
        {allSections.map((sec) => (
          <button
            key={sec}
            onClick={() => setSectionFilter(sec)}
            className={`px-2.5 py-1 rounded-md transition-colors text-xs font-medium ${
              sectionFilter === sec
                ? 'bg-neutral-900 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {sec === 'all' ? 'All Sections' : sec}
          </button>
        ))}
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredTables.map((table) => {
          const activeOrder = orders.find((o) => o.id === table.activeOrderId && o.status !== 'paid');
          const itemCount = activeOrder
            ? activeOrder.items.reduce((sum, it) => sum + it.quantity, 0)
            : 0;
          const orderTotal = activeOrder
            ? activeOrder.items.reduce((sum, it) => sum + it.price * it.quantity, 0)
            : 0;

          // Kitchen tickets for this table
          const tableKOTs = kots.filter((k) => k.tableId === table.id && k.status !== 'served');

          const isOccupied = table.status === 'occupied';
          const isBilled = table.status === 'billed';
          const isAvailable = table.status === 'available';

          return (
            <div
              key={table.id}
              onClick={() => handleTableClick(table.id)}
              className={`group relative rounded-xl border p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between h-56 hover:shadow-md ${
                isAvailable
                  ? 'bg-white border-neutral-200 hover:border-emerald-500/70'
                  : isOccupied
                  ? 'bg-amber-50/40 border-amber-300 hover:border-amber-500'
                  : 'bg-blue-50/40 border-blue-300 hover:border-blue-500'
              }`}
            >
              {/* Top Row: Name and Status Badge */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-neutral-900">{table.name}</span>
                    <span className="text-[10px] text-neutral-500 font-medium px-1.5 py-0.5 bg-neutral-100 rounded">
                      {table.section}
                    </span>
                  </div>

                  {/* Status Indicator */}
                  {isAvailable && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                      Available
                    </span>
                  )}
                  {isOccupied && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                      Occupied
                    </span>
                  )}
                  {isBilled && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                      <Receipt className="w-3 h-3" />
                      Billed
                    </span>
                  )}
                </div>

                {/* Capacity & Waiter */}
                <div className="flex items-center gap-2 text-xs text-neutral-500 mt-1">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {table.capacity} Seater
                  </span>
                  {activeOrder && (
                    <>
                      <span>·</span>
                      <span className="truncate max-w-[110px]">
                        Waiter: {activeOrder.waiterName}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Middle: Order details if occupied/billed */}
              <div className="my-2 py-2 border-t border-b border-neutral-100">
                {isAvailable ? (
                  <div className="text-center py-2 text-neutral-400 text-xs">
                    <p>Table is clean & ready</p>
                    <p className="text-[11px] text-neutral-500 font-medium mt-0.5 group-hover:text-neutral-800">
                      Click to start order →
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-neutral-500">
                        {itemCount} {itemCount === 1 ? 'item' : 'items'}
                      </span>
                      <span className="text-lg font-bold text-neutral-900 font-mono-numbers">
                        ₹{orderTotal.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* Active KOTs indicator */}
                    {tableKOTs.length > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-neutral-600">
                        <ChefHat className="w-3 h-3 text-purple-600" />
                        <span>KOT: {tableKOTs.map((k) => `#${k.kotNumber}`).join(', ')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center gap-2 pt-1">
                {isAvailable ? (
                  <button
                    onClick={() => handleTableClick(table.id)}
                    className="w-full py-2 px-3 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-900 hover:text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Take Order</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleTableClick(table.id)}
                      className="flex-1 py-1.5 px-2.5 text-xs font-medium text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg transition-colors text-center truncate"
                    >
                      View / Add Items
                    </button>
                    <button
                      onClick={(e) => handleBillingClick(e, table.id)}
                      className="py-1.5 px-3 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-1 shadow-2xs shrink-0"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Bill</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Owner Add Table Modal */}
      {isAddTableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-neutral-200 overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-neutral-900 text-white">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold">Add New Dining Table</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTableModalOpen(false)}
                className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddTableSubmit} className="p-5 space-y-4">
              {addTableError && (
                <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{addTableError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  Table Number or Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={tableNameInput}
                  onChange={(e) => {
                    setTableNameInput(e.target.value);
                    if (addTableError) setAddTableError('');
                  }}
                  placeholder="e.g. Table 13, T14, VIP 1, Rooftop 2"
                  className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  autoFocus
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  Unique name or number. Duplicate table numbers/names are prevented.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  Seating Capacity (Guests)
                </label>
                <div className="flex items-center gap-2 mb-2">
                  {[2, 4, 6, 8, 10].map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => setTableCapacityInput(cap)}
                      className={`px-2.5 py-1 text-xs rounded-md font-semibold border transition-colors cursor-pointer ${
                        tableCapacityInput === cap
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      {cap} Seater
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={tableCapacityInput}
                  onChange={(e) => setTableCapacityInput(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900 font-mono-numbers"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  Floor Area / Dining Section
                </label>
                <select
                  value={tableSectionInput}
                  onChange={(e) => setTableSectionInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
                >
                  <option value="Main Hall">Main Hall</option>
                  <option value="Garden Terrace">Garden Terrace</option>
                  <option value="Family AC">Family AC</option>
                </select>
              </div>

              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-[11px] text-neutral-600 space-y-1">
                <div className="font-semibold text-neutral-800">Initial Table Status:</div>
                <p>
                  Newly added tables initially appear as <strong>Available / Empty</strong> on the POS floor screen and become <strong>Occupied</strong> when an order is created.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsAddTableModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Create Table</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
