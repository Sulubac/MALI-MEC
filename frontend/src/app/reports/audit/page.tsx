'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import { Shield, Search, Calendar, User, FileText, Activity, Hash, ChevronDown, ChevronUp } from 'lucide-react';

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  login: 'bg-purple-100 text-purple-700',
  logout: 'bg-gray-100 text-gray-600',
  download: 'bg-cyan-100 text-cyan-700',
  validate: 'bg-emerald-100 text-emerald-700',
  reject: 'bg-orange-100 text-orange-700',
  view: 'bg-indigo-100 text-indigo-700',
  ocr: 'bg-yellow-100 text-yellow-700',
};

function AuditRow({ log }: { log: any }) {
  const [expanded, setExpanded] = useState(false);
  const actionColor = ACTION_COLORS[log.action?.toLowerCase()] || 'bg-gray-100 text-gray-600';

  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap font-mono">
          {new Date(log.created_at).toLocaleString('fr-FR')}
        </td>
        <td className="px-4 py-3">
          <span className={`badge text-xs font-medium ${actionColor}`}>{log.action}</span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">{log.resource_type || '—'}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <User size={13} className="text-gray-400" />
            <span className="text-sm text-gray-700">{log.username || '—'}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-gray-500">{log.ip_address || '—'}</td>
        <td className="px-4 py-3">
          {log.hash_chain && (
            <code className="text-xs text-gray-400 font-mono">{log.hash_chain.slice(0, 12)}...</code>
          )}
        </td>
        <td className="px-4 py-3 text-center">
          {expanded ? <ChevronUp size={14} className="text-gray-400 mx-auto" /> : <ChevronDown size={14} className="text-gray-400 mx-auto" />}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={7} className="px-6 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-medium text-gray-500 mb-1">Resource ID</p>
                <code className="text-gray-700">{log.resource_id || '—'}</code>
              </div>
              <div>
                <p className="font-medium text-gray-500 mb-1">User Agent</p>
                <p className="text-gray-600 truncate">{log.user_agent || '—'}</p>
              </div>
              {log.changes && (
                <div className="sm:col-span-2">
                  <p className="font-medium text-gray-500 mb-1">Changements</p>
                  <pre className="bg-white border border-gray-200 rounded p-3 text-xs overflow-x-auto text-gray-700">
                    {JSON.stringify(log.changes, null, 2)}
                  </pre>
                </div>
              )}
              {log.hash_chain && (
                <div className="sm:col-span-2">
                  <p className="font-medium text-gray-500 mb-1 flex items-center gap-1">
                    <Hash size={12} /> Hash de la chaîne (inviolable)
                  </p>
                  <code className="bg-white border border-gray-200 rounded px-3 py-2 block text-gray-700 break-all">
                    {log.hash_chain}
                  </code>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AuditPage() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');

  const { data: activityData, isLoading } = useQuery({
    queryKey: ['audit-activity'],
    queryFn: () => dashboardApi.getRecentActivity(),
  });

  const logs = activityData?.data || activityData?.activities || activityData || [];

  const filtered = (Array.isArray(logs) ? logs : []).filter((log: any) => {
    const matchSearch = !search ||
      log.username?.toLowerCase().includes(search.toLowerCase()) ||
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.resource_type?.toLowerCase().includes(search.toLowerCase());
    const matchAction = !actionFilter || log.action?.toLowerCase() === actionFilter;
    const matchDate = !dateFrom || new Date(log.created_at) >= new Date(dateFrom);
    return matchSearch && matchAction && matchDate;
  });

  const actionCounts = (Array.isArray(logs) ? logs : []).reduce((acc: Record<string, number>, log: any) => {
    const a = log.action || 'unknown';
    acc[a] = (acc[a] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="gradient-header rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Journal d'Audit</h1>
            <p className="text-white/80 text-sm">Traçabilité complète et inviolable de toutes les actions</p>
          </div>
        </div>
        {/* Action counts */}
        <div className="flex flex-wrap gap-3 mt-4">
          {Object.entries(actionCounts).slice(0, 6).map(([action, count]) => (
            <div key={action} className="bg-white/10 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <span className="text-white/70 text-xs capitalize">{action}</span>
              <span className="font-bold text-sm">{count as number}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <Hash size={18} className="text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-blue-800 font-semibold text-sm">Chaîne de hachage inviolable</p>
          <p className="text-blue-700 text-xs mt-1">
            Chaque entrée du journal est liée à la précédente par un hash SHA-256, garantissant l'intégrité et la non-répudiation de toutes les actions (conforme ISO 27001).
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-48 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher utilisateur, action..."
            className="input w-full pl-9"
          />
        </div>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="input">
          <option value="">Toutes les actions</option>
          {Object.keys(actionCounts).map(a => (
            <option key={a} value={a}>{a} ({actionCounts[a]})</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-400" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input" />
        </div>
        <div className="text-sm text-gray-500 flex items-center">
          {filtered.length} entrée{filtered.length > 1 ? 's' : ''}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Chargement du journal...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 card">
          <Activity size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Aucune entrée dans le journal</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Date/Heure</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Ressource</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Utilisateur</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">IP</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Hash</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((log: any, i: number) => (
                  <AuditRow key={log.id || i} log={log} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
