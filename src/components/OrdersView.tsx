import React, { useState } from 'react';
import { Search, Package, ShieldCheck, Clock, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Order } from '../types.ts';

interface OrdersViewProps {
  orders: Order[];
  onSelectOrderForResolution: (order: Order) => void;
  loading: boolean;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  onSelectOrderForResolution,
  loading,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const categories = ['all', ...Array.from(new Set(orders.map(o => o.productCategory)))];

  const filteredOrders = orders.filter(o => {
    const matchesCategory = selectedCategory === 'all' || o.productCategory === selectedCategory;
    const matchesSearch =
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.productName.toLowerCase().includes(search.toLowerCase()) ||
      o.productSku.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Title & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Simulated Customer Orders</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Demonstration customer account (Alex Morgan) · All orders and policies are simulated demo data
          </p>
        </div>

        {/* Search & Category Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter orders..."
              className="bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-cyan-500 w-44 sm:w-56"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-cyan-500"
          >
            {categories.map(c => (
              <option key={c} value={c}>
                {c === 'all' ? 'All Categories' : c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          Loading simulated orders from SQLite database...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
          <Package className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-300">No Orders Found</h3>
          <p className="text-xs text-slate-500 mt-1 mb-3">No orders match the current search or category filter.</p>
          <button
            onClick={() => {
              setSearch('');
              setSelectedCategory('all');
            }}
            className="px-3.5 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-800/60 rounded-lg transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOrders.map(order => {
            const isExpanded = expandedId === order.id;

            // Compute policy window status relative to demo date (2026-10-22)
            const delivery = new Date(order.deliveryDate + 'T00:00:00Z');
            const demoRef = new Date('2026-10-22T00:00:00Z');
            const daysSinceDelivery = Math.floor((demoRef.getTime() - delivery.getTime()) / (1000 * 60 * 60 * 24));

            const isReturnActive = daysSinceDelivery <= order.returnWindowDays;
            const isWarrantyActive = daysSinceDelivery <= order.warrantyWindowDays;

            return (
              <div
                key={order.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition-all shadow-sm flex flex-col justify-between"
              >
                <div>
                  {/* Top line metadata */}
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="font-mono text-cyan-400 font-semibold">{order.id}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">{order.productCategory}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums text-slate-200">
                        ${(order.priceCents / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Product title */}
                  <h3 className="text-base font-semibold text-white tracking-tight mb-2">
                    {order.productName}
                  </h3>

                  {/* Dates & Timeline strip */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mb-4 pb-3 border-b border-slate-800/80">
                    <div>
                      <span className="text-slate-400 font-medium">Purchased: </span>
                      <span className="text-slate-300 font-mono tabular-nums">{order.purchaseDate}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Delivered: </span>
                      <span className="text-slate-300 font-mono tabular-nums">
                        {order.deliveryDate} ({daysSinceDelivery} days ago)
                      </span>
                    </div>
                  </div>

                  {/* Policy Eligibility Snapshot */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                      <div className="flex items-center gap-1.5 text-slate-400 font-medium mb-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Return Window</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isReturnActive ? (
                          <span className="text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Eligible ({order.returnWindowDays - daysSinceDelivery}d left)
                          </span>
                        ) : (
                          <span className="text-slate-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-500" /> Closed ({daysSinceDelivery - order.returnWindowDays}d ago)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                      <div className="flex items-center gap-1.5 text-slate-400 font-medium mb-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Warranty Coverage</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isWarrantyActive ? (
                          <span className="text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Active ({order.warrantyWindowDays - daysSinceDelivery}d left)
                          </span>
                        ) : (
                          <span className="text-slate-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-500" /> Expired
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expandable Policy Notes */}
                  {isExpanded && (
                    <div className="text-xs bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300 mb-3 space-y-1">
                      <span className="text-slate-400 block font-medium">Demonstration Policy Notes:</span>
                      <p>{order.policyNotes}</p>
                      <div className="text-[11px] text-slate-500 pt-1 font-mono">SKU: {order.productSku}</div>
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                    className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {isExpanded ? 'Hide Policy Details' : 'View Policy Rules'}
                  </button>

                  <button
                    onClick={() => onSelectOrderForResolution(order)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:text-white bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-800/60 rounded-lg transition-colors"
                  >
                    <span>Resolve with Alexa+</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
