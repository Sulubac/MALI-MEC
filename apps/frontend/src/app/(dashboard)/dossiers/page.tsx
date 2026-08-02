'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dossiersApi } from '@/lib/api';
import { Header } from '@/components/layout/Header';
import { Loader2, Plus, Search, FolderOpen, AlertCircle } from 'lucide-react';
import { formatDate, DOSSIER_STATUS_LABELS, DOSSIER_TYPE_LABELS, STATUS_COLORS, cn } from '@/lib/utils';
import Link from 'next/link';

const PRIORITY_COLORS = {
  LOW: 'text-gray-500',
  MEDIUM: 'text-blue-500',
  HIGH: 'text-orange-500',
  URGENT: 'text-red-500',
};

export default function DossiersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['dossiers', { search, status, type, page }],
    queryFn: () => dossiersApi.getAll({ search: search || undefined, status: status || undefined, type: type || undefined, page, limit: 20 }),
  });

  return (
    <>
      <Header title="Gestion des Dossiers" subtitle="Tous les dossiers notariaux" />
      <div className="p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher par titre, numéro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(DOSSIER_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-3 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les types</option>
            {Object.entries(DOSSIER_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <Link
            href="/dashboard/dossiers/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau Dossier
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="grid gap-4">
            {(data?.data || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <FolderOpen className="w-12 h-12 mb-3 opacity-30" />
                <p>Aucun dossier trouvé</p>
              </div>
            ) : (
              (data?.data || []).map((dossier: any) => (
                <Link key={dossier.id} href={`/dashboard/dossiers/${dossier.id}`}>
                  <div className="bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-blue-300 transition-all group cursor-pointer">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs font-mono text-muted-foreground">{dossier.dossierNumber}</span>
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            STATUS_COLORS[dossier.status] || 'bg-gray-100 text-gray-600',
                          )}>
                            {DOSSIER_STATUS_LABELS[dossier.status] || dossier.status}
                          </span>
                          {dossier.riskLevel === 'HIGH' || dossier.riskLevel === 'CRITICAL' ? (
                            <span className="flex items-center gap-1 text-xs text-red-600">
                              <AlertCircle className="w-3 h-3" />
                              Risque {dossier.riskLevel}
                            </span>
                          ) : null}
                        </div>
                        <h3 className="font-semibold text-foreground group-hover:text-blue-600 transition-colors truncate">
                          {dossier.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {DOSSIER_TYPE_LABELS[dossier.type] || dossier.type}
                          {dossier.clients?.length > 0 && ` • ${dossier.clients.length} partie${dossier.clients.length > 1 ? 's' : ''}`}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {dossier.assignedNotary && (
                          <p className="text-xs text-muted-foreground">
                            {dossier.assignedNotary.firstName} {dossier.assignedNotary.lastName}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">{formatDate(dossier.openedAt)}</p>
                        {dossier.deadlineAt && (
                          <p className={cn(
                            'text-xs mt-1',
                            new Date(dossier.deadlineAt) < new Date() ? 'text-red-500' : 'text-muted-foreground',
                          )}>
                            Délai: {formatDate(dossier.deadlineAt)}
                          </p>
                        )}
                        <div className="flex gap-3 mt-2 text-xs text-muted-foreground justify-end">
                          <span>{dossier._count?.documents || 0} docs</span>
                          <span>{dossier._count?.tasks || 0} tâches</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{data.total} dossiers • Page {page}/{data.totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1.5 rounded border border-border text-sm disabled:opacity-50 hover:bg-muted transition-colors">
                Précédent
              </button>
              <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages}
                className="px-3 py-1.5 rounded border border-border text-sm disabled:opacity-50 hover:bg-muted transition-colors">
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
