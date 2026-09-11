'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '@/lib/api';
import {
  ArrowLeft, Download, Eye, FileText, Clock, User, Building2,
  Shield, Tag, Globe, AlertTriangle, CheckCircle, XCircle, RefreshCw,
  Hash, Calendar, Layers, Info, ChevronDown, ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700', icon: <FileText size={14} /> },
  received: { label: 'Reçu', color: 'bg-blue-100 text-blue-700', icon: <CheckCircle size={14} /> },
  digitizing: { label: 'Numérisation', color: 'bg-yellow-100 text-yellow-700', icon: <RefreshCw size={14} /> },
  ocr_processing: { label: 'OCR en cours', color: 'bg-orange-100 text-orange-700', icon: <RefreshCw size={14} /> },
  ai_analysis: { label: 'Analyse IA', color: 'bg-purple-100 text-purple-700', icon: <RefreshCw size={14} /> },
  validation: { label: 'Validation', color: 'bg-indigo-100 text-indigo-700', icon: <Clock size={14} /> },
  archived: { label: 'Archivé', color: 'bg-green-100 text-green-700', icon: <CheckCircle size={14} /> },
  published: { label: 'Publié', color: 'bg-emerald-100 text-emerald-700', icon: <Globe size={14} /> },
  destroyed: { label: 'Détruit', color: 'bg-red-100 text-red-700', icon: <XCircle size={14} /> },
};

const CONF_CONFIG: Record<string, { label: string; color: string }> = {
  public: { label: 'Public', color: 'bg-green-100 text-green-700' },
  internal: { label: 'Interne', color: 'bg-blue-100 text-blue-700' },
  confidential: { label: 'Confidentiel', color: 'bg-yellow-100 text-yellow-700' },
  secret: { label: 'Secret', color: 'bg-orange-100 text-orange-700' },
  top_secret: { label: 'Très Secret', color: 'bg-red-100 text-red-700' },
};

function SectionHeader({ title, icon, expanded, onToggle }: {
  title: string; icon: React.ReactNode; expanded: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <div className="flex items-center gap-2 font-semibold text-gray-700">
        {icon}
        {title}
      </div>
      {expanded ? <ChevronUp size={18} className="text-gray-500" /> : <ChevronDown size={18} className="text-gray-500" />}
    </button>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1">
      <span className="text-sm font-medium text-gray-500 min-w-[180px]">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const docId = params.id as string;

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    metadata: true,
    ai: true,
    security: false,
    technical: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['document', docId],
    queryFn: () => documentsApi.get(docId),
  });

  const ocrMutation = useMutation({
    mutationFn: () => documentsApi.processOcr(docId),
    onSuccess: () => {
      toast.success('OCR lancé en arrière-plan');
      queryClient.invalidateQueries({ queryKey: ['document', docId] });
    },
    onError: () => toast.error('Erreur lors du lancement OCR'),
  });

  const validateMutation = useMutation({
    mutationFn: (decision: 'approve' | 'reject') =>
      documentsApi.validate(docId, decision, ''),
    onSuccess: (_, decision) => {
      toast.success(decision === 'approve' ? 'Document approuvé' : 'Document rejeté');
      queryClient.invalidateQueries({ queryKey: ['document', docId] });
    },
    onError: () => toast.error('Erreur lors de la validation'),
  });

  const downloadMutation = useMutation({
    mutationFn: () => documentsApi.download(docId),
    onSuccess: (blob: Blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc?.title || 'document';
      a.click();
      window.URL.revokeObjectURL(url);
    },
    onError: () => toast.error('Erreur lors du téléchargement'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Chargement du document...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
          <p className="text-gray-700 font-semibold">Document introuvable</p>
          <button onClick={() => router.back()} className="btn-secondary mt-4">
            Retour
          </button>
        </div>
      </div>
    );
  }

  const doc = data.data || data;
  const status = STATUS_CONFIG[doc.status] || { label: doc.status, color: 'bg-gray-100 text-gray-700', icon: null };
  const conf = CONF_CONFIG[doc.confidentiality] || { label: doc.confidentiality, color: 'bg-gray-100 text-gray-700' };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{doc.title}</h1>
          {doc.title_ar && (
            <p className="text-gray-500 text-sm font-arabic" dir="rtl">{doc.title_ar}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`badge ${status.color} flex items-center gap-1`}>
            {status.icon} {status.label}
          </span>
          <span className={`badge ${conf.color}`}>{conf.label}</span>
        </div>
      </div>

      {/* Actions toolbar */}
      <div className="card p-4 flex flex-wrap gap-3">
        <button
          onClick={() => downloadMutation.mutate()}
          disabled={downloadMutation.isPending}
          className="btn-primary flex items-center gap-2"
        >
          <Download size={16} />
          {downloadMutation.isPending ? 'Téléchargement...' : 'Télécharger'}
        </button>
        {!doc.is_ocr_processed && (
          <button
            onClick={() => ocrMutation.mutate()}
            disabled={ocrMutation.isPending}
            className="btn-secondary flex items-center gap-2"
          >
            <Eye size={16} />
            {ocrMutation.isPending ? 'En cours...' : 'Lancer OCR'}
          </button>
        )}
        {doc.status === 'validation' && (
          <>
            <button
              onClick={() => validateMutation.mutate('approve')}
              disabled={validateMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              <CheckCircle size={16} /> Approuver
            </button>
            <button
              onClick={() => validateMutation.mutate('reject')}
              disabled={validateMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              <XCircle size={16} /> Rejeter
            </button>
          </>
        )}
        <div className="ml-auto flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1"><Eye size={14} /> {doc.view_count || 0} vues</span>
          <span className="flex items-center gap-1"><Download size={14} /> {doc.download_count || 0} télécharg.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary */}
          {doc.content_summary && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Info size={16} className="text-primary-500" /> Résumé
              </h2>
              <p className="text-gray-700 text-sm leading-relaxed">{doc.content_summary}</p>
            </div>
          )}

          {/* Full text content */}
          {doc.content_text && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText size={16} className="text-primary-500" /> Contenu OCR
              </h2>
              <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{doc.content_text}</pre>
              </div>
              {doc.ocr_confidence && (
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${doc.ocr_confidence}%` }}
                    />
                  </div>
                  <span>Confiance OCR: {doc.ocr_confidence?.toFixed(1)}%</span>
                </div>
              )}
            </div>
          )}

          {/* Metadata section */}
          <div className="card overflow-hidden">
            <SectionHeader
              title="Métadonnées"
              icon={<Layers size={16} className="text-primary-500" />}
              expanded={expandedSections.metadata}
              onToggle={() => toggleSection('metadata')}
            />
            {expandedSections.metadata && (
              <div className="p-6 space-y-3">
                <MetaRow label="Référence" value={doc.reference} />
                <MetaRow label="Numéro de document" value={doc.document_number} />
                <MetaRow label="Auteur" value={doc.author} />
                <MetaRow label="Institution émettrice" value={doc.institution_name} />
                <MetaRow label="Destinataire" value={doc.recipient} />
                <MetaRow label="Objet" value={doc.subject} />
                <MetaRow label="Date du document" value={doc.document_date ? new Date(doc.document_date).toLocaleDateString('fr-FR') : null} />
                <MetaRow label="Date de réception" value={doc.received_date ? new Date(doc.received_date).toLocaleDateString('fr-FR') : null} />
                <MetaRow label="Langue" value={doc.language} />
                <MetaRow label="Durée de conservation" value={doc.retention_years ? `${doc.retention_years} ans` : null} />
                <MetaRow label="Pages" value={doc.page_count} />
              </div>
            )}
          </div>

          {/* AI Analysis */}
          {doc.is_ai_analyzed && (
            <div className="card overflow-hidden">
              <SectionHeader
                title="Analyse IA"
                icon={<Globe size={16} className="text-primary-500" />}
                expanded={expandedSections.ai}
                onToggle={() => toggleSection('ai')}
              />
              {expandedSections.ai && (
                <div className="p-6 space-y-4">
                  {doc.keywords?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">Mots-clés</p>
                      <div className="flex flex-wrap gap-2">
                        {doc.keywords.map((kw: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-medium">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {doc.entities_persons?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                        <User size={14} /> Personnes mentionnées
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {doc.entities_persons.map((p: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {doc.entities_organizations?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                        <Building2 size={14} /> Organisations
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {doc.entities_organizations.map((o: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">{o}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {doc.tags?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                        <Tag size={14} /> Tags
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {doc.tags.map((tag: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">#{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Security & Integrity */}
          <div className="card overflow-hidden">
            <SectionHeader
              title="Sécurité & Intégrité"
              icon={<Shield size={16} className="text-primary-500" />}
              expanded={expandedSections.security}
              onToggle={() => toggleSection('security')}
            />
            {expandedSections.security && (
              <div className="p-6 space-y-3">
                <MetaRow label="SHA-256" value={
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all">{doc.checksum_sha256}</code>
                } />
                <MetaRow label="MD5" value={
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all">{doc.checksum_md5}</code>
                } />
                {doc.blockchain_hash && (
                  <MetaRow label="Hash Blockchain" value={
                    <code className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded break-all">{doc.blockchain_hash}</code>
                  } />
                )}
              </div>
            )}
          </div>

          {/* Technical info */}
          <div className="card overflow-hidden">
            <SectionHeader
              title="Informations techniques"
              icon={<Hash size={16} className="text-primary-500" />}
              expanded={expandedSections.technical}
              onToggle={() => toggleSection('technical')}
            />
            {expandedSections.technical && (
              <div className="p-6 space-y-3">
                <MetaRow label="ID" value={<code className="text-xs">{doc.id}</code>} />
                <MetaRow label="Format" value={doc.file_type} />
                <MetaRow label="Taille" value={formatBytes(doc.file_size)} />
                <MetaRow label="Version" value={doc.version} />
                <MetaRow label="OCR traité" value={doc.is_ocr_processed ? '✅ Oui' : '❌ Non'} />
                <MetaRow label="IA analysé" value={doc.is_ai_analyzed ? '✅ Oui' : '❌ Non'} />
                <MetaRow label="Numérisé" value={doc.is_digitized ? '✅ Oui' : '❌ Non'} />
                <MetaRow label="Créé le" value={doc.created_at ? new Date(doc.created_at).toLocaleString('fr-FR') : null} />
                <MetaRow label="Mis à jour le" value={doc.updated_at ? new Date(doc.updated_at).toLocaleString('fr-FR') : null} />
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick info card */}
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Informations rapides</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <FileText size={16} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Type</p>
                  <p className="text-sm font-medium capitalize">{doc.type?.replace(/_/g, ' ')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Building2 size={16} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Institution</p>
                  <p className="text-sm font-medium">{doc.institution_name || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User size={16} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Créé par</p>
                  <p className="text-sm font-medium">{doc.created_by_name || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Date de création</p>
                  <p className="text-sm font-medium">
                    {doc.created_at ? new Date(doc.created_at).toLocaleDateString('fr-FR') : '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Rétention</p>
                  <p className="text-sm font-medium">{doc.retention_years ? `${doc.retention_years} ans` : '—'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Processing status */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">État du traitement</h3>
            <div className="space-y-3">
              {[
                { label: 'Numérisé', done: doc.is_digitized },
                { label: 'OCR', done: doc.is_ocr_processed },
                { label: 'Analyse IA', done: doc.is_ai_analyzed },
              ].map(({ label, done }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{label}</span>
                  {done ? (
                    <CheckCircle size={18} className="text-green-500" />
                  ) : (
                    <XCircle size={18} className="text-gray-300" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Barcode / QR */}
          {(doc.reference || doc.barcode) && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Identifiants</h3>
              <div className="space-y-2">
                {doc.reference && (
                  <div>
                    <p className="text-xs text-gray-500">Référence</p>
                    <code className="text-sm font-mono text-primary-600 font-bold">{doc.reference}</code>
                  </div>
                )}
                {doc.barcode && (
                  <div>
                    <p className="text-xs text-gray-500">Code-barres</p>
                    <code className="text-sm font-mono">{doc.barcode}</code>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
