'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  FileText, Upload, Download, Eye, Trash2, Filter, Search,
  RefreshCw, ChevronLeft, ChevronRight, MoreVertical, Archive,
  Zap, CheckCircle, Clock, AlertCircle, FileSearch
} from 'lucide-react';
import { documentsApi } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  draft: { label: 'Brouillon', class: 'badge bg-slate-100 text-slate-600' },
  received: { label: 'Reçu', class: 'badge bg-blue-100 text-blue-700' },
  digitizing: { label: 'Numérisation', class: 'badge bg-cyan-100 text-cyan-700' },
  ocr_processing: { label: 'OCR', class: 'badge bg-yellow-100 text-yellow-700' },
  ai_analysis: { label: 'Analyse IA', class: 'badge bg-violet-100 text-violet-700' },
  validation: { label: 'Validation', class: 'badge bg-orange-100 text-orange-700' },
  quality_control: { label: 'Contrôle', class: 'badge bg-amber-100 text-amber-700' },
  indexing: { label: 'Indexation', class: 'badge bg-indigo-100 text-indigo-700' },
  archived: { label: 'Archivé', class: 'badge bg-green-100 text-green-700' },
  published: { label: 'Publié', class: 'badge bg-emerald-100 text-emerald-700' },
  destroyed: { label: 'Détruit', class: 'badge bg-red-100 text-red-600' },
};

const CONF_LABELS: Record<string, { label: string; class: string }> = {
  public: { label: 'Public', class: 'badge bg-green-100 text-green-700' },
  internal: { label: 'Interne', class: 'badge bg-blue-100 text-blue-700' },
  confidential: { label: 'Confidentiel', class: 'badge bg-orange-100 text-orange-700' },
  secret: { label: 'Secret', class: 'badge bg-red-100 text-red-700' },
  top_secret: { label: 'Très Secret', class: 'badge bg-purple-100 text-purple-800' },
};

const TYPE_ICONS: Record<string, string> = {
  courrier_entrant: '📥', courrier_sortant: '📤', decret: '⚖️',
  arrete: '📋', loi: '🏛️', rapport: '📊', contrat: '📝',
  decision: '✅', note: '📌', photo: '📷', video: '🎬',
  audio: '🎵', email: '📧', autre: '📄',
};

function DocumentRow({ doc, onView, onDelete, onOCR }: any) {
  const status = STATUS_LABELS[doc.status] || { label: doc.status, class: 'badge bg-slate-100 text-slate-600' };
  const conf = CONF_LABELS[doc.confidentiality] || { label: doc.confidentiality, class: 'badge bg-slate-100' };

  return (
    <tr className="hover:bg-slate-50 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{TYPE_ICONS[doc.type] || '📄'}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate max-w-xs">{doc.title}</p>
            <p className="text-xs text-slate-400 font-mono">{doc.reference}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={status.class}>{status.label}</span>
      </td>
      <td className="px-4 py-3">
        <span className={conf.class}>{conf.label}</span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-600">
        {doc.document_date ? new Date(doc.document_date).toLocaleDateString('fr-DJ') : '—'}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">{doc.author || '—'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onView(doc.id)} className="p-1.5 rounded text-slate-400 hover:text-primary-600 hover:bg-primary-50">
            <Eye className="w-4 h-4" />
          </button>
          {!doc.is_ocr_processed && doc.file_path && (
            <button onClick={() => onOCR(doc.id)} className="p-1.5 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50" title="Lancer OCR">
              <FileSearch className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => onDelete(doc.id)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function DocumentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterConf, setFilterConf] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['documents', page, search, filterStatus, filterType, filterConf],
    queryFn: () => documentsApi.list({
      page,
      size: 20,
      search: search || undefined,
      status: filterStatus || undefined,
      document_type: filterType || undefined,
      confidentiality: filterConf || undefined,
    }).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => {
      toast.success('Document supprimé');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  const ocrMutation = useMutation({
    mutationFn: (id: string) => documentsApi.processOCR(id),
    onSuccess: () => toast.success('Traitement OCR lancé'),
    onError: () => toast.error('Erreur lors du lancement de l\'OCR'),
  });

  const stats = {
    total: data?.total || 0,
    archived: data?.items?.filter((d: any) => d.status === 'archived').length || 0,
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Gestion Documentaire</h1>
            <p className="text-slate-500 text-sm mt-1">
              {data?.total?.toLocaleString() || 0} document(s) au total
            </p>
          </div>
          <button
            onClick={() => router.push('/documents/upload')}
            className="btn-primary"
          >
            <Upload className="w-4 h-4" />
            Importer un document
          </button>
        </div>

        {/* Stats mini */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: data?.total || 0, icon: FileText, color: 'text-primary-600 bg-primary-50' },
            { label: 'Archivés', value: data?.items?.filter((d: any) => d.status === 'archived').length || 0, icon: Archive, color: 'text-green-600 bg-green-50' },
            { label: 'En traitement', value: data?.items?.filter((d: any) => ['ocr_processing', 'validation'].includes(d.status)).length || 0, icon: Clock, color: 'text-amber-600 bg-amber-50' },
            { label: 'Publiés', value: data?.items?.filter((d: any) => d.status === 'published').length || 0, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
          ].map(s => (
            <div key={s.label} className="card p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{s.value.toLocaleString()}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher titre, référence, auteur..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="input pl-9"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="input w-40"
            >
              <option value="">Tous statuts</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select
              value={filterConf}
              onChange={(e) => { setFilterConf(e.target.value); setPage(1); }}
              className="input w-44"
            >
              <option value="">Confidentialité</option>
              {Object.entries(CONF_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <button onClick={() => refetch()} className="btn-secondary">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left table-header">Document</th>
                  <th className="px-4 py-3 text-left table-header">Statut</th>
                  <th className="px-4 py-3 text-left table-header">Confidentialité</th>
                  <th className="px-4 py-3 text-left table-header">Date</th>
                  <th className="px-4 py-3 text-left table-header">Auteur</th>
                  <th className="px-4 py-3 text-left table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : data?.items?.length ? (
                  data.items.map((doc: any) => (
                    <DocumentRow
                      key={doc.id}
                      doc={doc}
                      onView={(id: string) => router.push(`/documents/${id}`)}
                      onDelete={(id: string) => {
                        if (confirm('Supprimer ce document ?')) deleteMutation.mutate(id);
                      }}
                      onOCR={(id: string) => ocrMutation.mutate(id)}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p>Aucun document trouvé</p>
                      <p className="text-xs mt-1">Modifiez les filtres ou importez un premier document</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Page {page} sur {data.pages} ({data.total?.toLocaleString()} résultats)
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                  disabled={page === data.pages}
                  className="p-1.5 rounded border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
