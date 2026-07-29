import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, Minus, Plus, Trash2, CreditCard, Tag, StickyNote, X, ChefHat, AlertTriangle } from 'lucide-react';
import useStore from '../store/useStore';
import PaymentModal from '../components/PaymentModal';

function fmtDJF(n) {
  return `${Math.round(n || 0).toLocaleString('fr-FR')} DJF`;
}

export default function POSScreen() {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { tables, categories, products, currentTable, currentOrder,
    openTableSession, addItem, updateItemQty, removeItem, voidOrder } = useStore();

  const [search, setSearch] = useState('');
  const [selCat, setSelCat] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [orderNote, setOrderNote] = useState('');
  const [showNote, setShowNote] = useState(false);

  // Open session if not already open for this table
  useEffect(() => {
    const table = tables.find(t => t.id === parseInt(tableId));
    if (table && (!currentTable || currentTable.id !== table.id)) {
      openTableSession(table);
    }
  }, [tableId, tables]);

  const filteredProducts = products.filter(p => {
    const matchCat = !selCat || p.category_id === selCat;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch && p.active;
  });

  const items = currentOrder?.items || [];
  const hasItems = items.length > 0;

  if (!currentOrder) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        <div className="text-center">
          <ChefHat size={48} className="mx-auto mb-4 opacity-30" />
          <p>Chargement de la commande...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* ── Left: Products ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-700">
        {/* Search + categories */}
        <div className="p-3 border-b border-slate-700 space-y-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9 text-sm"
              placeholder="Rechercher un plat..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelCat(null)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                !selCat ? 'bg-brand-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Tout
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelCat(cat.id === selCat ? null : cat.id)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selCat === cat.id ? 'text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                style={selCat === cat.id ? { backgroundColor: cat.color } : {}}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {filteredProducts.map(product => {
              const inOrder = items.find(i => i.product_id === product.id);
              const isLowStock = product.track_stock && product.stock_qty !== null && product.stock_qty <= (product.min_quantity || 5);
              const isOutOfStock = product.track_stock && product.stock_qty !== null && product.stock_qty <= 0;
              return (
                <button
                  key={product.id}
                  onClick={() => !isOutOfStock && addItem(product)}
                  disabled={isOutOfStock}
                  className={`card p-3 text-left transition-all hover:border-brand-500/50 active:scale-95 relative ${
                    isOutOfStock ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:brightness-110'
                  } ${inOrder ? 'ring-1 ring-brand-500' : ''}`}
                >
                  {inOrder && (
                    <span className="absolute top-2 right-2 bg-brand-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                      {inOrder.quantity}
                    </span>
                  )}
                  <div className="text-sm font-medium text-white leading-tight mb-1">{product.name}</div>
                  {product.description && (
                    <div className="text-xs text-slate-400 leading-tight mb-2 line-clamp-2">{product.description}</div>
                  )}
                  <div className="flex items-end justify-between">
                    <span className="text-brand-400 font-bold text-sm">{fmtDJF(product.price)}</span>
                    {isLowStock && !isOutOfStock && (
                      <span className="flex items-center gap-0.5 text-amber-400 text-xs">
                        <AlertTriangle size={10} /> {product.stock_qty}
                      </span>
                    )}
                    {isOutOfStock && <span className="text-red-400 text-xs">Épuisé</span>}
                  </div>
                </button>
              );
            })}
            {filteredProducts.length === 0 && (
              <div className="col-span-full text-center py-12 text-slate-500">
                <p>Aucun produit trouvé</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: Order Panel ──────────────────────────────────────────── */}
      <div className="w-80 xl:w-96 flex flex-col bg-slate-900">
        {/* Order header */}
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-white">{currentTable?.name}</div>
              <div className="text-xs text-slate-400">
                Commande #{currentOrder.id}
                {!currentOrder.is_new && ' · Existante'}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowNote(!showNote)} className="btn-ghost p-2" title="Note">
                <StickyNote size={15} />
              </button>
              {hasItems && (
                <button onClick={() => { if (confirm('Annuler cette commande ?')) { voidOrder(); navigate('/tables'); } }}
                  className="btn-ghost p-2 text-red-400 hover:text-red-300" title="Annuler">
                  <X size={15} />
                </button>
              )}
            </div>
          </div>
          {showNote && (
            <textarea
              className="input mt-2 text-xs resize-none"
              rows={2}
              placeholder="Note pour la cuisine..."
              value={orderNote}
              onChange={e => setOrderNote(e.target.value)}
            />
          )}
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm">
              <ChefHat size={40} className="mb-3 opacity-30" />
              <p>Sélectionnez des articles</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {items.map(item => (
                <div key={item.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-800/50 group">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{item.product_name}</div>
                    {item.notes && <div className="text-xs text-slate-500 truncate">{item.notes}</div>}
                    <div className="text-xs text-slate-400">{fmtDJF(item.unit_price)} / u</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => updateItemQty(item.id, item.quantity - 1)}
                      className="w-6 h-6 rounded-md bg-slate-700 hover:bg-slate-600 flex items-center justify-center"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-7 text-center text-sm font-bold text-white">{item.quantity}</span>
                    <button
                      onClick={() => updateItemQty(item.id, item.quantity + 1)}
                      className="w-6 h-6 rounded-md bg-slate-700 hover:bg-slate-600 flex items-center justify-center"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <div className="text-sm font-medium text-white w-24 text-right shrink-0">
                    {fmtDJF(item.quantity * item.unit_price)}
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity p-1"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals & checkout */}
        <div className="border-t border-slate-700 p-4 space-y-2">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Sous-total</span>
              <span>{fmtDJF(currentOrder.subtotal)}</span>
            </div>
            {currentOrder.discount > 0 && (
              <div className="flex justify-between text-red-400">
                <span>Remise</span>
                <span>- {fmtDJF(currentOrder.discount)}</span>
              </div>
            )}
            {currentOrder.tax > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>TVA ({currentOrder.tax_rate}%)</span>
                <span>{fmtDJF(currentOrder.tax)}</span>
              </div>
            )}
            {currentOrder.tip > 0 && (
              <div className="flex justify-between text-brand-400">
                <span>Pourboire</span>
                <span>{fmtDJF(currentOrder.tip)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg text-white pt-1 border-t border-slate-700">
              <span>TOTAL</span>
              <span className="text-brand-400">{fmtDJF(currentOrder.total)}</span>
            </div>
          </div>

          <button
            onClick={() => setShowPayment(true)}
            disabled={!hasItems}
            className="w-full btn-primary py-3 text-base font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CreditCard size={18} />
            Encaisser
          </button>
        </div>
      </div>

      {showPayment && (
        <PaymentModal
          order={currentOrder}
          onClose={() => setShowPayment(false)}
          onSuccess={() => { setShowPayment(false); navigate('/tables'); }}
        />
      )}
    </div>
  );
}
