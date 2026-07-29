import React, { useState } from 'react';
import { X, Banknote, CreditCard, Smartphone, CheckCircle } from 'lucide-react';
import useStore from '../store/useStore';

function fmtDJF(n) {
  return `${Math.round(n || 0).toLocaleString('fr-FR')} DJF`;
}

const QUICK_AMOUNTS = [5000, 10000, 15000, 20000, 25000, 50000];

const METHODS = [
  { id: 'cash',   label: 'Espèces',  icon: Banknote },
  { id: 'card',   label: 'Carte',    icon: CreditCard },
  { id: 'mobile', label: 'Mobile',   icon: Smartphone },
];

export default function PaymentModal({ order, onClose, onSuccess }) {
  const { checkout } = useStore();
  const [method, setMethod] = useState('cash');
  const [cashGiven, setCashGiven] = useState('');
  const [tip, setTip] = useState('');
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [changeGiven, setChangeGiven] = useState(0);

  const total = order.total || 0;
  const tipAmt = parseFloat(tip) || 0;
  const grandTotal = total + tipAmt;
  const cash = parseFloat(cashGiven) || 0;
  const change = method === 'cash' ? Math.max(0, cash - grandTotal) : 0;

  const canPay = method !== 'cash' || cash >= grandTotal;

  const handlePay = async () => {
    setProcessing(true);
    try {
      await checkout({ method, cash_given: cash, tip: tipAmt });
      setChangeGiven(change);
      setDone(true);
      setTimeout(() => onSuccess(), change > 0 ? 3000 : 1500);
    } catch {
      // error shown by store
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl">
        {done ? (
          <div className="p-10 text-center">
            <CheckCircle size={64} className="text-brand-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Paiement reçu !</h2>
            {changeGiven > 0 && (
              <div className="bg-brand-500/20 border border-brand-500/30 rounded-xl p-4 mt-4">
                <div className="text-slate-400 text-sm">Monnaie à rendre</div>
                <div className="text-3xl font-bold text-brand-400">{fmtDJF(changeGiven)}</div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <div>
                <h2 className="text-lg font-bold text-white">Encaissement</h2>
                <p className="text-slate-400 text-sm">{order.table_name} · Commande #{order.id}</p>
              </div>
              <button onClick={onClose} className="btn-ghost p-2"><X size={18} /></button>
            </div>

            <div className="p-5 space-y-5">
              {/* Total */}
              <div className="bg-slate-900 rounded-xl p-4 text-center">
                <div className="text-slate-400 text-sm">Montant dû</div>
                <div className="text-3xl font-bold text-brand-400">{fmtDJF(grandTotal)}</div>
                {order.discount > 0 && (
                  <div className="text-xs text-red-400">Remise: -{fmtDJF(order.discount)}</div>
                )}
              </div>

              {/* Tip */}
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Pourboire (optionnel)</label>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    type="number"
                    placeholder="0 DJF"
                    value={tip}
                    onChange={e => setTip(e.target.value)}
                    min="0"
                  />
                  {[500, 1000, 2000].map(t => (
                    <button key={t} onClick={() => setTip(String(t))}
                      className="btn-outline text-xs px-3 shrink-0">{t > 999 ? `${t/1000}k` : t}</button>
                  ))}
                </div>
              </div>

              {/* Payment method */}
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Mode de paiement</label>
                <div className="grid grid-cols-3 gap-2">
                  {METHODS.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setMethod(id)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                        method === id
                          ? 'border-brand-500 bg-brand-500/20 text-brand-400'
                          : 'border-slate-600 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      <Icon size={20} />
                      <span className="text-xs font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash amount */}
              {method === 'cash' && (
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Montant remis</label>
                  <input
                    className="input text-lg font-bold"
                    type="number"
                    placeholder={`${Math.round(grandTotal)} DJF`}
                    value={cashGiven}
                    onChange={e => setCashGiven(e.target.value)}
                    autoFocus
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {QUICK_AMOUNTS.map(a => (
                      <button key={a} onClick={() => setCashGiven(String(a))}
                        className="btn-outline text-xs px-2.5 py-1">
                        {a.toLocaleString('fr-FR')}
                      </button>
                    ))}
                    <button onClick={() => setCashGiven(String(Math.ceil(grandTotal / 1000) * 1000))}
                      className="btn-outline text-xs px-2.5 py-1 text-brand-400 border-brand-500/50">
                      Exact
                    </button>
                  </div>
                  {cash > 0 && cash >= grandTotal && (
                    <div className="mt-2 bg-emerald-900/30 border border-emerald-700/30 rounded-lg p-2 text-center">
                      <div className="text-xs text-slate-400">Monnaie</div>
                      <div className="text-xl font-bold text-emerald-400">{fmtDJF(change)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-5 pt-0">
              <button
                onClick={handlePay}
                disabled={!canPay || processing}
                className="w-full btn-primary py-3.5 text-base font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {processing ? 'Traitement...' : `Valider le paiement · ${fmtDJF(grandTotal)}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
