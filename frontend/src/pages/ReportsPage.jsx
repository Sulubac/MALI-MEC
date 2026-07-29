import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, ShoppingBag, DollarSign, Calendar } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, CartesianGrid
} from 'recharts';
import { api } from '../api/client';

function fmtDJF(n) { return `${Math.round(n || 0).toLocaleString('fr-FR')} DJF`; }
function today() { return new Date().toISOString().split('T')[0]; }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; }

const COLORS = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#f97316'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm shadow-xl">
      <div className="text-slate-400 text-xs mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>{fmtDJF(p.value)}</div>
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const [period, setPeriod] = useState('today');
  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState([]);
  const [loading, setLoading] = useState(false);

  const PERIODS = [
    { id: 'today',   label: "Aujourd'hui", from: today(),          to: today() },
    { id: 'week',    label: '7 derniers jours', from: daysAgo(7),  to: today() },
    { id: 'month',   label: '30 derniers jours', from: daysAgo(30), to: today() },
  ];

  const selected = PERIODS.find(p => p.id === period);

  const load = async () => {
    setLoading(true);
    try {
      const [s, d] = await Promise.all([
        api.getReportSummary({ from: selected.from, to: selected.to }),
        api.getDailyReport({ days: period === 'today' ? 1 : period === 'week' ? 7 : 30 }),
      ]);
      setSummary(s);
      setDaily(d);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [period]);

  const methodColors = { cash: '#10b981', card: '#06b6d4', mobile: '#8b5cf6' };
  const methodLabels = { cash: 'Espèces', card: 'Carte', mobile: 'Mobile' };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <BarChart3 size={20} className="text-brand-500" />
          Rapports & Analyses
        </h1>
        <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                period === p.id ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-center py-10 text-slate-500">Chargement...</div>}

      {summary && !loading && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Chiffre d\'affaires', value: fmtDJF(summary.sales.revenue), icon: DollarSign, color: 'text-brand-400', bg: 'bg-brand-500/10' },
              { label: 'Commandes', value: summary.sales.order_count, icon: ShoppingBag, color: 'text-blue-400', bg: 'bg-blue-500/10' },
              { label: 'Panier moyen', value: fmtDJF(summary.sales.avg_order), icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/10' },
              { label: 'Pourboires', value: fmtDJF(summary.sales.tip_sum), icon: Calendar, color: 'text-amber-400', bg: 'bg-amber-500/10' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="card p-4">
                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                  <Icon size={18} className={color} />
                </div>
                <div className={`text-2xl font-bold ${color} mb-1`}>{value}</div>
                <div className="text-slate-400 text-xs">{label}</div>
              </div>
            ))}
          </div>

          {/* Revenue chart */}
          {daily.length > 1 && (
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Évolution du Chiffre d'Affaires</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            {/* Top products */}
            {summary.topProducts.length > 0 && (
              <div className="card p-4">
                <h2 className="text-sm font-semibold text-slate-300 mb-4">Top 10 Plats Vendus</h2>
                <div className="space-y-2">
                  {summary.topProducts.map((p, i) => {
                    const maxRev = summary.topProducts[0].revenue;
                    return (
                      <div key={p.product_name} className="flex items-center gap-3">
                        <span className="text-slate-500 text-xs w-4 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="text-sm text-white truncate">{p.product_name}</span>
                            <span className="text-xs text-slate-400 shrink-0 ml-2">{p.qty_sold} ventes</span>
                          </div>
                          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-500 rounded-full transition-all"
                              style={{ width: `${(p.revenue / maxRev) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-slate-300 shrink-0 w-28 text-right">{fmtDJF(p.revenue)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Payment methods */}
            {summary.byMethod.length > 0 && (
              <div className="card p-4">
                <h2 className="text-sm font-semibold text-slate-300 mb-4">Modes de Paiement</h2>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie data={summary.byMethod} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                        dataKey="total" nameKey="method" paddingAngle={2}>
                        {summary.byMethod.map((entry, i) => (
                          <Cell key={entry.method} fill={methodColors[entry.method] || COLORS[i]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={v => fmtDJF(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3">
                    {summary.byMethod.map((m, i) => (
                      <div key={m.method} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: methodColors[m.method] || COLORS[i] }} />
                        <div>
                          <div className="text-sm text-white">{methodLabels[m.method] || m.method}</div>
                          <div className="text-xs text-slate-400">{m.count} · {fmtDJF(m.total)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Hourly heatmap */}
            {summary.hourly.length > 0 && (
              <div className="card p-4 md:col-span-2">
                <h2 className="text-sm font-semibold text-slate-300 mb-4">Activité par Heure</h2>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={summary.hourly} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="hour" tickFormatter={h => `${h}h`} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip formatter={v => [`${v} commandes`, 'Commandes']} labelFormatter={h => `${h}h00`} />
                    <Bar dataKey="orders" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {summary.sales.order_count === 0 && (
            <div className="text-center py-12 text-slate-500">
              <BarChart3 size={48} className="mx-auto mb-4 opacity-30" />
              <p>Aucune vente sur cette période</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
