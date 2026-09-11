'use client';

import { useQuery } from '@tanstack/react-query';
import {
  FileText, Building2, Users, HardDrive, TrendingUp,
  CheckCircle, Clock, AlertTriangle, Archive,
  BarChart3, Activity, Zap, Globe
} from 'lucide-react';
import { dashboardApi } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const COLORS = ['#0057e6', '#3dba4e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

function StatCard({
  title, value, subtitle, icon: Icon, color = 'primary', trend
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color?: string;
  trend?: number;
}) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary-50 text-primary-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    cyan: 'bg-cyan-50 text-cyan-600',
  };

  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium flex items-center gap-0.5 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            <TrendingUp className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
        <p className="text-sm font-medium text-slate-600 mt-0.5">{title}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function AlertBanner({ alert }: { alert: any }) {
  const typeMap: Record<string, string> = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    danger: 'bg-red-50 border-red-200 text-red-800',
  };

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${typeMap[alert.type] || typeMap.info}`}>
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{alert.title}</p>
        <p className="text-xs opacity-80">{alert.message}</p>
      </div>
      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/50">
        {alert.count}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const { data: kpis, isLoading } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: () => dashboardApi.getKPIs({ period_days: 30 }).then(r => r.data),
  });

  const { data: topInstitutions } = useQuery({
    queryKey: ['top-institutions'],
    queryFn: () => dashboardApi.getTopInstitutions('documents', 8).then(r => r.data),
  });

  const { data: alerts } = useQuery({
    queryKey: ['dashboard-alerts'],
    queryFn: () => dashboardApi.getAlerts().then(r => r.data),
  });

  const { data: activity } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: () => dashboardApi.getRecentActivity(10).then(r => r.data),
  });

  const pieData = kpis ? Object.entries(kpis.by_type || {}).map(([key, value]) => ({
    name: key.replace('_', ' '),
    value: value as number,
  })) : [];

  const trendData = kpis?.monthly_trend || [];

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="gradient-header rounded-2xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Tableau de bord national</h1>
              <p className="text-white/70 mt-1">Vue d'ensemble de la mémoire numérique nationale</p>
              <p className="text-white/50 text-sm mt-1">منصة الأرشيف الوطني - جمهورية جيبوتي</p>
            </div>
            <div className="flex items-center gap-2 bg-white/20 rounded-xl px-4 py-2">
              <Globe className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-medium">Djibouti</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'ISO 15489', icon: '✓' },
              { label: 'ISO 14721', icon: '✓' },
              { label: 'ISO 27001', icon: '✓' },
              { label: 'MoReq2010', icon: '✓' },
            ].map(s => (
              <div key={s.label} className="bg-white/15 rounded-xl p-3 text-center">
                <div className="text-lg text-white">{s.icon}</div>
                <div className="text-xs text-white/80 font-medium mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        {alerts?.alerts?.length > 0 && (
          <div className="space-y-2">
            {alerts.alerts.map((alert: any, i: number) => (
              <AlertBanner key={i} alert={alert} />
            ))}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            title="Documents Total"
            value={kpis?.totals?.documents?.toLocaleString() || '—'}
            subtitle="Dans toutes institutions"
            icon={FileText}
            color="primary"
            trend={12}
          />
          <StatCard
            title="Archivés"
            value={kpis?.totals?.archived?.toLocaleString() || '—'}
            subtitle={`${kpis?.quality?.archiving_rate || 0}% du total`}
            icon={Archive}
            color="green"
            trend={8}
          />
          <StatCard
            title="Institutions"
            value={kpis?.totals?.institutions || '—'}
            subtitle="Actives"
            icon={Building2}
            color="purple"
          />
          <StatCard
            title="Utilisateurs"
            value={kpis?.totals?.active_users || '—'}
            subtitle="Actifs"
            icon={Users}
            color="cyan"
          />
          <StatCard
            title="Stockage"
            value={`${kpis?.totals?.storage_tb?.toFixed(2) || 0} TB`}
            subtitle="Utilisé"
            icon={HardDrive}
            color="amber"
          />
          <StatCard
            title="OCR Qualité"
            value={`${kpis?.quality?.avg_ocr_confidence || 0}%`}
            subtitle={`${kpis?.quality?.ocr_processed || 0} traités`}
            icon={Zap}
            color="green"
            trend={3}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trend */}
          <div className="lg:col-span-2 card p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold text-slate-800">Évolution mensuelle</h3>
                <p className="text-xs text-slate-500">Nouveaux documents archivés</p>
              </div>
              <div className="badge bg-green-100 text-green-700">+12% ce mois</div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorDocs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0057e6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0057e6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#0057e6"
                  strokeWidth={2}
                  fill="url(#colorDocs)"
                  name="Documents"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Pie */}
          <div className="card p-5">
            <div className="mb-5">
              <h3 className="font-semibold text-slate-800">Types de documents</h3>
              <p className="text-xs text-slate-500">Répartition par type</p>
            </div>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend
                    formatter={(value) => <span className="text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">
                Aucune donnée disponible
              </div>
            )}
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top institutions */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Top Institutions</h3>
            <div className="space-y-3">
              {topInstitutions?.data?.slice(0, 6).map((inst: any, i: number) => (
                <div key={inst.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 w-5 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 truncate">{inst.name}</span>
                      <span className="text-xs font-semibold text-slate-600 ml-2">{inst.value.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary-500"
                        style={{
                          width: `${Math.round((inst.value / (topInstitutions.data[0]?.value || 1)) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {!topInstitutions?.data?.length && (
                <p className="text-slate-400 text-sm text-center py-4">Aucune donnée</p>
              )}
            </div>
          </div>

          {/* Recent activity */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Activité récente</h3>
              <Activity className="w-4 h-4 text-slate-400" />
            </div>
            <div className="space-y-3">
              {activity?.activities?.slice(0, 8).map((act: any) => (
                <div key={act.id} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary-400 shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700 truncate">
                      <span className="font-medium">{act.username}</span>
                      {' '}{act.action} {act.resource_type}
                      {act.resource_id && <span className="font-mono text-slate-500"> #{act.resource_id?.slice(0, 8)}</span>}
                    </p>
                    <p className="text-xs text-slate-400">
                      {act.created_at ? new Date(act.created_at).toLocaleString('fr-DJ') : ''}
                    </p>
                  </div>
                </div>
              ))}
              {!activity?.activities?.length && (
                <p className="text-slate-400 text-sm text-center py-4">Aucune activité récente</p>
              )}
            </div>
          </div>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(kpis?.by_status || {}).filter(([_, v]) => (v as number) > 0).map(([status, count]) => (
            <div key={status} className="card p-4">
              <div className={`doc-status-${status} w-fit mb-2`}>{status.replace(/_/g, ' ')}</div>
              <p className="text-xl font-bold text-slate-900">{(count as number).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
