import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { UtensilsCrossed, LayoutGrid, Package, BarChart3, Settings, Bell, ArrowLeft } from 'lucide-react';
import useStore from '../store/useStore';

const nav = [
  { to: '/tables', label: 'Tables', icon: LayoutGrid },
  { to: '/stock', label: 'Stock', icon: Package },
  { to: '/reports', label: 'Rapports', icon: BarChart3 },
  { to: '/settings', label: 'Paramètres', icon: Settings },
];

export default function Header() {
  const { stockAlerts, currentTable, closeSession } = useStore();
  const navigate = useNavigate();

  return (
    <header className="bg-slate-900 border-b border-slate-700 px-4 flex items-center gap-4 h-14 shrink-0 z-50">
      {/* Brand */}
      <div className="flex items-center gap-2 shrink-0">
        <UtensilsCrossed size={20} className="text-brand-500" />
        <span className="font-bold text-white text-sm">Urban Beach</span>
        <span className="text-slate-500 text-xs">POS</span>
      </div>

      <div className="w-px h-6 bg-slate-700" />

      {/* Back button when in POS screen */}
      {currentTable && (
        <button
          onClick={() => { closeSession(); navigate('/tables'); }}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Retour aux tables</span>
        </button>
      )}

      {/* Nav */}
      <nav className="flex items-center gap-1">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-brand-500/20 text-brand-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`
            }
          >
            <Icon size={15} />
            <span className="hidden sm:inline">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Stock alerts badge */}
      {stockAlerts.length > 0 && (
        <NavLink to="/stock" className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-sm">
          <Bell size={16} className="animate-pulse" />
          <span className="hidden sm:inline">{stockAlerts.length} alerte{stockAlerts.length > 1 ? 's' : ''}</span>
        </NavLink>
      )}

      {/* Current table indicator */}
      {currentTable && (
        <div className="bg-brand-500/20 border border-brand-500/30 text-brand-400 text-xs px-3 py-1 rounded-full">
          {currentTable.name}
        </div>
      )}

      {/* Clock */}
      <Clock />
    </header>
  );
}

function Clock() {
  const [time, setTime] = React.useState(new Date());
  React.useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="text-slate-400 text-xs font-mono tabular-nums">
      {time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}
