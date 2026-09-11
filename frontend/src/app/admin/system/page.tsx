'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import {
  Server, Database, Cpu, HardDrive, Activity, CheckCircle,
  XCircle, AlertTriangle, RefreshCw, Clock
} from 'lucide-react';

const SERVICES = [
  { key: 'database', label: 'PostgreSQL', icon: <Database size={18} />, color: 'text-blue-600' },
  { key: 'redis', label: 'Redis Cache', icon: <Cpu size={18} />, color: 'text-red-600' },
  { key: 'elasticsearch', label: 'Elasticsearch', icon: <Activity size={18} />, color: 'text-yellow-600' },
  { key: 'storage', label: 'MinIO Storage', icon: <HardDrive size={18} />, color: 'text-green-600' },
];

function ServiceStatus({ service, status }: { service: any; status: any }) {
  const isOk = status?.status === 'ok' || status?.status === 'connected' || status === true;
  const isDown = status === false || status?.status === 'error' || status?.status === 'disconnected';

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm ${service.color}`}>
          {service.icon}
        </div>
        <div>
          <p className="font-medium text-gray-900">{service.label}</p>
          {status?.version && <p className="text-xs text-gray-400">v{status.version}</p>}
          {status?.latency_ms && <p className="text-xs text-gray-400">{status.latency_ms}ms</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isOk ? (
          <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
            <CheckCircle size={16} /> Opérationnel
          </span>
        ) : isDown ? (
          <span className="flex items-center gap-1.5 text-red-600 text-sm font-medium">
            <XCircle size={16} /> Hors ligne
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-yellow-600 text-sm font-medium">
            <AlertTriangle size={16} /> Dégradé
          </span>
        )}
      </div>
    </div>
  );
}

export default function SystemPage() {
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const { data: healthData, isLoading, refetch } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const res = await fetch('/health');
      return res.json();
    },
    retry: 1,
    refetchInterval: 30000,
  });

  const { data: kpisData } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: () => dashboardApi.getKPIs(),
  });

  const health = healthData || {};
  const kpis = kpisData?.data || kpisData || {};

  const handleRefresh = () => {
    refetch();
    setLastRefresh(new Date());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
            <Server size={20} className="text-primary-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">État du système</h1>
            <p className="text-gray-500 text-sm flex items-center gap-1">
              <Clock size={12} /> Actualisé à {lastRefresh.toLocaleTimeString('fr-FR')}
            </p>
          </div>
        </div>
        <button onClick={handleRefresh} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {/* Overall status */}
      <div className={`rounded-2xl p-6 text-white ${
        health.status === 'healthy' ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
        health.status === 'degraded' ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
        'bg-gradient-to-r from-gray-400 to-gray-600'
      }`}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
            {health.status === 'healthy' ? <CheckCircle size={32} /> :
             health.status === 'degraded' ? <AlertTriangle size={32} /> :
             <Server size={32} />}
          </div>
          <div>
            <p className="text-white/70 text-sm">Statut global PNGA</p>
            <p className="text-3xl font-bold capitalize">{
              health.status === 'healthy' ? 'Opérationnel' :
              health.status === 'degraded' ? 'Dégradé' :
              isLoading ? 'Vérification...' : 'Inconnu'
            }</p>
            {health.version && <p className="text-white/60 text-sm mt-1">Version {health.version}</p>}
          </div>
        </div>
      </div>

      {/* Services status */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Services</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SERVICES.map(service => (
            <ServiceStatus
              key={service.key}
              service={service}
              status={health.services?.[service.key] || health[service.key]}
            />
          ))}
        </div>
      </div>

      {/* System metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Documents', value: (kpis.total_documents || 0).toLocaleString(), icon: <Activity size={18} />, color: 'bg-blue-50 text-blue-600' },
          { label: 'Stockage utilisé', value: `${(kpis.storage_used_gb || 0).toFixed(1)} GB`, icon: <HardDrive size={18} />, color: 'bg-green-50 text-green-600' },
          { label: 'Utilisateurs actifs', value: kpis.total_users || 0, icon: <Server size={18} />, color: 'bg-purple-50 text-purple-600' },
          { label: 'OCR en attente', value: kpis.pending_ocr || 0, icon: <Clock size={18} />, color: 'bg-orange-50 text-orange-600' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="card p-5">
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>
              {icon}
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-gray-500 text-sm mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Configuration */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Configuration système</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {[
            { label: 'Environnement', value: process.env.NODE_ENV || 'production' },
            { label: 'Version API', value: health.version || '1.0.0' },
            { label: 'Langues OCR', value: 'fra + ara + eng + som' },
            { label: 'Standards', value: 'ISO 15489, ISO 14721, ISO 27001' },
            { label: 'Taille max upload', value: '512 MB' },
            { label: 'Rétention logs', value: '10 ans' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-gray-500">{label}</span>
              <span className="font-medium text-gray-900">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
