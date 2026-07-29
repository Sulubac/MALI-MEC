import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Users, Clock, ChefHat, Plus } from 'lucide-react';
import useStore from '../store/useStore';

const STATUS_CONFIG = {
  available:  { label: 'Libre',       color: 'border-emerald-500 bg-emerald-500/10', dot: 'bg-emerald-500', text: 'text-emerald-400' },
  occupied:   { label: 'Occupé',      color: 'border-red-500 bg-red-500/10',         dot: 'bg-red-500',     text: 'text-red-400' },
  reserved:   { label: 'Réservé',     color: 'border-amber-500 bg-amber-500/10',     dot: 'bg-amber-500',   text: 'text-amber-400' },
  cleaning:   { label: 'Nettoyage',   color: 'border-slate-500 bg-slate-500/10',     dot: 'bg-slate-500',   text: 'text-slate-400' },
};

function fmtDJF(n) {
  return n ? `${Math.round(n).toLocaleString('fr-FR')} DJF` : '';
}
function fmtTime(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function FloorPlan() {
  const { tables, fetchTables, openTableSession } = useStore();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  const sections = [...new Set(tables.map(t => t.section))];

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTables();
    setRefreshing(false);
  };

  const handleTableClick = async (table) => {
    await openTableSession(table);
    navigate(`/pos/${table.id}`);
  };

  const stats = {
    total: tables.length,
    available: tables.filter(t => t.status === 'available').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    reserved: tables.filter(t => t.status === 'reserved').length,
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      {/* Stats bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">Plan de Salle</h1>
          <div className="flex items-center gap-3 text-sm">
            {Object.entries({
              Libres: { count: stats.available, cls: 'text-emerald-400' },
              Occupées: { count: stats.occupied, cls: 'text-red-400' },
              Réservées: { count: stats.reserved, cls: 'text-amber-400' },
            }).map(([label, { count, cls }]) => (
              <span key={label} className={`${cls} font-medium`}>{count} {label}</span>
            ))}
          </div>
        </div>
        <button onClick={handleRefresh} className="btn-ghost text-xs gap-1.5" disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-400">
        {Object.entries(STATUS_CONFIG).map(([key, { label, dot }]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            {label}
          </div>
        ))}
      </div>

      {/* Tables by section */}
      {sections.map(section => (
        <div key={section}>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">{section}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {tables.filter(t => t.section === section).map(table => {
              const cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.available;
              return (
                <button
                  key={table.id}
                  onClick={() => handleTableClick(table)}
                  className={`card p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98] border-2 cursor-pointer ${cfg.color} hover:brightness-110`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-bold text-lg text-white">{table.name}</span>
                    <span className={`w-2.5 h-2.5 rounded-full mt-1 ${cfg.dot} shrink-0`} />
                  </div>

                  <div className="flex items-center gap-1 text-slate-400 text-xs mb-1">
                    <Users size={11} />
                    <span>{table.capacity} pers.</span>
                  </div>

                  <div className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</div>

                  {table.status === 'occupied' && table.order_id && (
                    <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-1">
                      <div className="flex items-center gap-1 text-slate-400 text-xs">
                        <ChefHat size={11} />
                        <span>{table.item_count || 0} article{table.item_count !== 1 ? 's' : ''}</span>
                      </div>
                      {table.order_started && (
                        <div className="flex items-center gap-1 text-slate-400 text-xs">
                          <Clock size={11} />
                          <span>{fmtTime(table.order_started)}</span>
                        </div>
                      )}
                      {table.order_total > 0 && (
                        <div className="text-brand-400 text-xs font-semibold">
                          {fmtDJF(table.order_total)}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {tables.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <ChefHat size={48} className="mb-4 opacity-30" />
          <p className="text-lg">Aucune table configurée</p>
          <p className="text-sm">Allez dans Paramètres pour ajouter des tables</p>
        </div>
      )}
    </div>
  );
}
