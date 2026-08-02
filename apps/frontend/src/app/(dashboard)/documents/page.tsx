'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { documentsApi } from '@/lib/api';
import { Header } from '@/components/layout/Header';
import { Loader2, Plus, Search, FileText, File } from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';

const DOC_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  SIGNED: 'bg-green-100 text-green-700',
  CERTIFIED: 'bg-purple-100 text-purple-700',
  ARCHIVED: 'bg-gray-100 text-gray-500',
  REJECTED: 'bg-red-100 text-red-700',
};

const DOC_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  UNDER_REVIEW: 'En révision',
  APPROVED: 'Approuvé',
  SIGNED: 'Signé',
  CERTIFIED: 'Certifié',
  ARCHIVED: 'Archivé',
  REJECTED: 'Rejeté',
};

export default function DocumentsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['documents', { search, status, type, page }],
    queryFn: () => documentsApi.getAll({ search: search || undefined, status: status || undefined, type: type || undefined, page, limit: 20 }),
  });

  return (
    <>
      <Header title="Documents" subtitle="Gestion des actes et documents notariaux" />
      <div className="p-6 space-y-4">
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
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none">
            <option value="">Tous les statuts</option>
            {Object.entries(DOC_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" />
            Nouveau Document
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Document</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Dossier</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Version</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Créé le</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(data?.data || []).map((doc: any) => (
                    <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                            <FileText className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{doc.title}</p>
                            <p className="text-xs text-muted-foreground">{doc.documentNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{doc.type}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {doc.dossier ? `${doc.dossier.dossierNumber}` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', DOC_STATUS_COLORS[doc.status] || 'bg-gray-100 text-gray-600')}>
                          {DOC_STATUS_LABELS[doc.status] || doc.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">v{doc.version}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(doc.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data?.data || []).length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <File className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm">Aucun document trouvé</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
