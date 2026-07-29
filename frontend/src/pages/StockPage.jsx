import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, Plus, Minus, RefreshCw, History, TrendingDown, TrendingUp, Edit3, X } from 'lucide-react';
import { api } from '../api/client';
import useStore from '../store/useStore';

function fmtDJF(n) { return `${Math.round(n || 0).toLocaleString('fr-FR')} DJF`; }
function fmtDate(d) { return new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }); }

const MOVE_TYPES = [
  { id: 'purchase', label: 'Réception stock',  color: 'text-emerald-400' },
  { id: 'adjustment', label: 'Ajustement',     color: 'text-blue-400' },
  { id: 'waste',    label: 'Déchets / Perte',  color: 'text-red-400' },
  { id: 'return',   label: 'Retour fournisseur', color: 'text-amber-400' },
];

export default function StockPage() {
  const { fetchStockAlerts } = useStore();
  const [stock, setStock] = useState([]);
  const [movements, setMovements] = useState([]);
  const [tab, setTab] = useState('stock'); // stock | movements
  const [adjustModal, setAdjustModal] = useState(null); // product
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [filterCat, setFilterCat] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const [s, m] = await Promise.all([api.getStock(), api.getStockMovements({ limit: 200 })]);
      setStock(s);
      setMovements(m);
    } finally {
      setLoading(false);
    }
    fetchStockAlerts();
  };

  useEffect(() => { load(); }, []);

  const categories = [...new Set(stock.map(s => s.category_name))];
  const alerts = stock.filter(s => s.quantity <= s.min_quantity);

  const filtered = stock.filter(s => {
    const matchSearch = !filter || s.product_name.toLowerCase().includes(filter.toLowerCase());
    const matchCat = filterCat === 'all' || s.category_name === filterCat;
    return matchSearch && matchCat;
  });

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Package size={20} className="text-brand-500" />
            Gestion des Stocks
          </h1>
          {alerts.length > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-900/30 border border-amber-700/30 text-amber-400 text-sm px-3 py-1 rounded-full">
              <AlertTriangle size={14} />
              {alerts.length} alerte{alerts.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
        <button onClick={load} className="btn-ghost text-xs gap-1.5" disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 px-4">
        {[
          { id: 'stock', label: 'Inventaire', icon: Package },
          { id: 'movements', label: 'Mouvements', icon: History },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition-colors ${
              tab === id ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'stock' && (
        <div className="flex-1 overflow-y-auto">
          {/* Filters */}
          <div className="p-3 border-b border-slate-700/50 flex gap-2 flex-wrap">
            <input
              className="input text-sm flex-1 min-w-40"
              placeholder="Rechercher un produit..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
            <select
              className="input text-sm w-auto"
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
            >
              <option value="all">Toutes catégories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Low stock alerts */}
          {alerts.length > 0 && (
            <div className="p-3 space-y-1">
              <div className="text-xs text-amber-400 font-semibold mb-2">⚠ Stocks faibles</div>
              <div className="flex flex-wrap gap-2">
                {alerts.map(s => (
                  <div key={s.product_id} className="bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-1.5 text-xs">
                    <span className="text-amber-300 font-medium">{s.product_name}</span>
                    <span className="text-amber-500 ml-2">{s.quantity} {s.unit} (min: {s.min_quantity})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stock table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs">
                <th className="text-left px-4 py-2">Produit</th>
                <th className="text-left px-4 py-2">Catégorie</th>
                <th className="text-right px-4 py-2">En stock</th>
                <th className="text-right px-4 py-2">Minimum</th>
                <th className="text-right px-4 py-2">Unité</th>
                <th className="text-right px-4 py-2">Valeur</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map(s => {
                const isLow = s.quantity <= s.min_quantity;
                const isOut = s.quantity <= 0;
                return (
                  <tr key={s.product_id} className={`hover:bg-slate-800/50 ${isOut ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-2.5 font-medium text-white">{s.product_name}</td>
                    <td className="px-4 py-2.5">
                      <span className="badge" style={{ backgroundColor: s.category_color + '30', color: s.category_color }}>
                        {s.category_name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-bold tabular-nums ${isOut ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-white'}`}>
                        {s.quantity}
                      </span>
                      {isLow && <AlertTriangle size={12} className="inline ml-1 text-amber-400" />}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-400 tabular-nums">{s.min_quantity}</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">{s.unit}</td>
                    <td className="px-4 py-2.5 text-right text-slate-300 tabular-nums">{fmtDJF(s.quantity * s.cost)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => setAdjustModal(s)}
                        className="btn-ghost text-xs gap-1 py-1 px-2"
                      >
                        <Edit3 size={12} /> Ajuster
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'movements' && (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs">
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Produit</th>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-right px-4 py-2">Quantité</th>
                <th className="text-left px-4 py-2">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {movements.map(m => {
                const typeInfo = MOVE_TYPES.find(t => t.id === m.type);
                const isNeg = m.quantity < 0;
                return (
                  <tr key={m.id} className="hover:bg-slate-800/50">
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{fmtDate(m.created_at)}</td>
                    <td className="px-4 py-2.5 font-medium text-white">{m.product_name}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs ${typeInfo?.color || 'text-slate-400'}`}>{typeInfo?.label || m.type}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-bold tabular-nums flex items-center justify-end gap-1 ${isNeg ? 'text-red-400' : 'text-emerald-400'}`}>
                        {isNeg ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                        {isNeg ? '' : '+'}{m.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{m.notes}</td>
                  </tr>
                );
              })}
              {movements.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-slate-500">Aucun mouvement enregistré</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjustment Modal */}
      {adjustModal && (
        <AdjustModal
          stock={adjustModal}
          onClose={() => setAdjustModal(null)}
          onDone={() => { setAdjustModal(null); load(); }}
        />
      )}
    </div>
  );
}

function AdjustModal({ stock, onClose, onDone }) {
  const [type, setType] = useState('purchase');
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!qty || parseFloat(qty) <= 0) return;
    setLoading(true);
    try {
      await api.adjustStock({ product_id: stock.product_id, type, quantity: parseFloat(qty), notes });
      onDone();
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const resultQty = type === 'waste' ? stock.quantity - (parseFloat(qty) || 0) : stock.quantity + (parseFloat(qty) || 0);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div>
            <h2 className="font-bold text-white">Ajuster le stock</h2>
            <p className="text-slate-400 text-sm">{stock.product_name}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-slate-900 rounded-lg p-3 text-center">
            <div className="text-slate-400 text-xs">Stock actuel</div>
            <div className="text-2xl font-bold text-white">{stock.quantity} <span className="text-sm text-slate-400">{stock.unit}</span></div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Type de mouvement</label>
            <div className="grid grid-cols-2 gap-2">
              {MOVE_TYPES.map(t => (
                <button key={t.id} onClick={() => setType(t.id)}
                  className={`p-2.5 rounded-lg text-xs font-medium border transition-colors ${
                    type === t.id ? 'border-brand-500 bg-brand-500/20 text-brand-400' : 'border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Quantité</label>
            <input className="input" type="number" min="0" placeholder="0" value={qty} onChange={e => setQty(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Note (optionnel)</label>
            <input className="input" placeholder="Ex: Livraison fournisseur..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          {qty && parseFloat(qty) > 0 && (
            <div className="bg-slate-900 rounded-lg p-3 text-center">
              <div className="text-slate-400 text-xs">Stock après ajustement</div>
              <div className={`text-xl font-bold ${resultQty < 0 ? 'text-red-400' : 'text-brand-400'}`}>
                {Math.max(0, resultQty)} {stock.unit}
              </div>
            </div>
          )}
        </div>
        <div className="p-5 pt-0 flex gap-2">
          <button onClick={onClose} className="btn-outline flex-1">Annuler</button>
          <button onClick={handleSubmit} disabled={loading || !qty || parseFloat(qty) <= 0} className="btn-primary flex-1">
            {loading ? 'Enregistrement...' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}

