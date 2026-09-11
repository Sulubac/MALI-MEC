'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { FileText, Building2, Users, HardDrive, TrendingUp, Award } from 'lucide-react';

const COLORS = ['#0057e6', '#3dba4e', '#ffd700', '#ef4444', '#8b5cf6', '#f97316', '#06b6d4', '#ec4899'];

const TYPE_LABELS: Record<string, string> = {
  decree: 'Décrets', law: 'Lois', decision: 'Décisions', report: 'Rapports',
  letter: 'Courriers', contract: 'Contrats', certificate: 'Certificats', other: 'Autres',
};

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={`rounded-xl p-5 text-white ${color}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/70 text-sm">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {sub && <p className="text-white/60 text-xs mt-1">{sub}</p>}
        </div>
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">{icon}</div>
      </div>
    </div>
  );
}

export default function KPIsPage() {
  const { data: kpisData, isLoading } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: () => dashboardApi.getKPIs(),
  });

  const { data: topInstitutionsData } = useQuery({
    queryKey: ['dashboard-top-institutions'],
    queryFn: () => dashboardApi.getTopInstitutions(),
  });

  const kpis = kpisData?.data || kpisData || {};
  const topInstitutions = topInstitutionsData?.data || topInstitutionsData?.institutions || topInstitutionsData || [];

  const byTypeData = Object.entries(kpis.by_type || {}).map(([key, value]) => ({
    name: TYPE_LABELS[key] || key,
    value: value as number,
  })).sort((a, b) => b.value - a.value);

  const monthlyData = (kpis.monthly_trend || []).map((m: any) => ({
    month: m.month,
    total: m.count,
    archived: m.archived || 0,
  }));

  const formatBytes = (gb: number) => {
    if (!gb) return '0 GB';
    if (gb < 1) return `${Math.round(gb * 1024)} MB`;
    if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`;
    return `${gb.toFixed(1)} GB`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="gradient-header rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Tableau de Bord KPI</h1>
            <p className="text-white/80 text-sm">Indicateurs clés de performance — République de Djibouti</p>
          </div>
        </div>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={<FileText size={20} />} label="Documents total" value={(kpis.total_documents || 0).toLocaleString()} color="bg-gradient-to-br from-blue-500 to-blue-700" />
        <StatCard icon={<Award size={20} />} label="Archivés" value={(kpis.archived_documents || 0).toLocaleString()} sub={`${kpis.total_documents > 0 ? Math.round((kpis.archived_documents / kpis.total_documents) * 100) : 0}%`} color="bg-gradient-to-br from-green-500 to-green-700" />
        <StatCard icon={<Building2 size={20} />} label="Institutions" value={kpis.total_institutions || 0} color="bg-gradient-to-br from-purple-500 to-purple-700" />
        <StatCard icon={<Users size={20} />} label="Utilisateurs" value={kpis.total_users || 0} color="bg-gradient-to-br from-orange-500 to-orange-700" />
        <StatCard icon={<HardDrive size={20} />} label="Stockage" value={formatBytes(kpis.storage_used_gb || 0)} color="bg-gradient-to-br from-cyan-500 to-cyan-700" />
        <StatCard icon={<TrendingUp size={20} />} label="Qualité OCR" value={`${(kpis.avg_ocr_quality || 0).toFixed(1)}%`} color="bg-gradient-to-br from-pink-500 to-pink-700" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Monthly trend */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Évolution mensuelle des documents</h2>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="#0057e6" strokeWidth={2} name="Total" dot={false} />
                <Line type="monotone" dataKey="archived" stroke="#3dba4e" strokeWidth={2} name="Archivés" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">Données insuffisantes</div>
          )}
        </div>

        {/* By type pie */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Répartition par type de document</h2>
          {byTypeData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={240}>
                <PieChart>
                  <Pie data={byTypeData} cx="50%" cy="50%" outerRadius={100} dataKey="value">
                    {byTypeData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => v.toLocaleString()} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {byTypeData.slice(0, 6).map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-700">{item.name}</span>
                    </div>
                    <span className="font-medium text-gray-900">{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">Aucune donnée</div>
          )}
        </div>

        {/* Top institutions bar chart */}
        <div className="card p-6 xl:col-span-2">
          <h2 className="font-semibold text-gray-900 mb-4">Top institutions par volume documentaire</h2>
          {(Array.isArray(topInstitutions) ? topInstitutions : []).length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topInstitutions.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={160} />
                <Tooltip formatter={(v: number) => v.toLocaleString()} />
                <Bar dataKey="document_count" fill="#0057e6" radius={[0, 4, 4, 0]} name="Documents" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">Aucune donnée</div>
          )}
        </div>
      </div>

      {/* Standards compliance */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Award size={18} className="text-primary-500" /> Conformité aux standards internationaux
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { std: 'ISO 15489', label: 'Records Management', pct: 95 },
            { std: 'ISO 14721', label: 'OAIS', pct: 88 },
            { std: 'ISO 27001', label: 'Sécurité', pct: 92 },
            { std: 'MoReq2010', label: 'Electronic', pct: 85 },
            { std: 'Dublin Core', label: 'Métadonnées', pct: 100 },
            { std: 'PREMIS', label: 'Préservation', pct: 82 },
          ].map(({ std, label, pct }) => (
            <div key={std} className="text-center">
              <div className="relative w-16 h-16 mx-auto">
                <svg className="transform -rotate-90 w-16 h-16" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                  <circle
                    cx="32" cy="32" r="28" fill="none"
                    stroke={pct >= 90 ? '#22c55e' : pct >= 80 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="6"
                    strokeDasharray={`${(pct / 100) * 175.9} 175.9`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-900">{pct}%</div>
              </div>
              <p className="text-xs font-bold text-gray-800 mt-2">{std}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
