'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Upload, File, X, CheckCircle, Loader2, AlertCircle,
  Zap, Brain, Eye, ArrowLeft
} from 'lucide-react';
import { documentsApi, institutionsApi } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

interface UploadFile {
  id: string;
  file: File;
  title: string;
  type: string;
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'error';
  progress: number;
  error?: string;
  docId?: string;
}

const DOC_TYPES = [
  { value: 'courrier_entrant', label: '📥 Courrier Entrant' },
  { value: 'courrier_sortant', label: '📤 Courrier Sortant' },
  { value: 'decret', label: '⚖️ Décret' },
  { value: 'arrete', label: '📋 Arrêté' },
  { value: 'loi', label: '🏛️ Loi' },
  { value: 'rapport', label: '📊 Rapport' },
  { value: 'contrat', label: '📝 Contrat' },
  { value: 'decision', label: '✅ Décision' },
  { value: 'note', label: '📌 Note de service' },
  { value: 'circulaire', label: '📣 Circulaire' },
  { value: 'photo', label: '📷 Photo' },
  { value: 'video', label: '🎬 Vidéo' },
  { value: 'audio', label: '🎵 Audio' },
  { value: 'email', label: '📧 Email' },
  { value: 'autre', label: '📄 Autre' },
];

const CONF_LEVELS = [
  { value: 'public', label: '🟢 Public' },
  { value: 'internal', label: '🔵 Interne' },
  { value: 'confidential', label: '🟠 Confidentiel' },
  { value: 'secret', label: '🔴 Secret' },
  { value: 'top_secret', label: '🟣 Très Secret' },
];

export default function UploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [defaultType, setDefaultType] = useState('courrier_entrant');
  const [defaultConf, setDefaultConf] = useState('internal');
  const [defaultInstitution, setDefaultInstitution] = useState('');
  const [runOCR, setRunOCR] = useState(true);
  const [runAI, setRunAI] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const { data: institutions } = useQuery({
    queryKey: ['institutions-list'],
    queryFn: () => institutionsApi.list({ size: 100 }).then(r => r.data),
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).slice(2),
      file,
      title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
      type: defaultType,
      status: 'pending',
      progress: 0,
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, [defaultType]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png', '.tiff', '.tif'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'video/*': ['.mp4', '.avi'],
      'audio/*': ['.mp3', '.wav'],
      'application/zip': ['.zip'],
    },
    maxSize: 500 * 1024 * 1024,
    multiple: true,
  });

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateFile = (id: string, updates: Partial<UploadFile>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const uploadAll = async () => {
    if (files.filter(f => f.status === 'pending').length === 0) {
      toast.error('Aucun fichier à importer');
      return;
    }
    if (!defaultInstitution) {
      toast.error('Veuillez sélectionner une institution');
      return;
    }

    setIsUploading(true);
    for (const f of files.filter(f => f.status === 'pending')) {
      updateFile(f.id, { status: 'uploading', progress: 20 });
      try {
        const formData = new FormData();
        formData.append('file', f.file);
        formData.append('title', f.title);
        formData.append('document_type', f.type);
        formData.append('institution_id', defaultInstitution);
        formData.append('confidentiality', defaultConf);
        formData.append('run_ocr', runOCR.toString());
        formData.append('run_ai', runAI.toString());

        updateFile(f.id, { progress: 50 });
        const res = await documentsApi.upload(formData);
        updateFile(f.id, {
          status: 'done',
          progress: 100,
          docId: res.data.id,
        });
      } catch (err: any) {
        const msg = err.response?.data?.detail || 'Erreur d\'upload';
        updateFile(f.id, { status: 'error', error: msg, progress: 0 });
      }
    }
    setIsUploading(false);
    const doneCount = files.filter(f => f.status === 'done').length;
    if (doneCount > 0) {
      toast.success(`${doneCount} document(s) importé(s) avec succès`);
    }
  };

  const doneCount = files.filter(f => f.status === 'done').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const pendingCount = files.filter(f => f.status === 'pending').length;

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Importer des documents</h1>
            <p className="text-slate-500 text-sm mt-1">
              Glissez-déposez vos fichiers pour les archiver automatiquement
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings */}
          <div className="space-y-4">
            <div className="card p-5">
              <h3 className="font-semibold text-slate-800 mb-4">Paramètres d'import</h3>
              <div className="space-y-4">
                <div>
                  <label className="label">Institution *</label>
                  <select
                    value={defaultInstitution}
                    onChange={(e) => setDefaultInstitution(e.target.value)}
                    className="input"
                  >
                    <option value="">Sélectionner...</option>
                    {institutions?.items?.map((i: any) => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Type par défaut</label>
                  <select value={defaultType} onChange={(e) => setDefaultType(e.target.value)} className="input">
                    {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Confidentialité par défaut</label>
                  <select value={defaultConf} onChange={(e) => setDefaultConf(e.target.value)} className="input">
                    {CONF_LEVELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-semibold text-slate-800 mb-4">Traitement automatique</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={runOCR}
                    onChange={(e) => setRunOCR(e.target.checked)}
                    className="rounded border-slate-300 text-primary-600 w-4 h-4"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <Eye className="w-4 h-4 text-amber-500" />
                      OCR Multilingue
                    </p>
                    <p className="text-xs text-slate-400">Français, Arabe, Anglais, Somali</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={runAI}
                    onChange={(e) => setRunAI(e.target.checked)}
                    className="rounded border-slate-300 text-primary-600 w-4 h-4"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <Brain className="w-4 h-4 text-violet-500" />
                      Analyse IA
                    </p>
                    <p className="text-xs text-slate-400">Extraction auto métadonnées</p>
                  </div>
                </label>
              </div>
            </div>

            {files.length > 0 && (
              <div className="card p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">En attente</span>
                  <span className="font-semibold text-slate-800">{pendingCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Importés</span>
                  <span className="font-semibold text-green-700">{doneCount}</span>
                </div>
                {errorCount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-red-600">Erreurs</span>
                    <span className="font-semibold text-red-700">{errorCount}</span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={uploadAll}
              disabled={isUploading || pendingCount === 0}
              className="btn-primary w-full justify-center py-3"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Import en cours...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Importer {pendingCount > 0 ? `(${pendingCount})` : ''}
                </>
              )}
            </button>
          </div>

          {/* Upload zone + files */}
          <div className="lg:col-span-2 space-y-4">
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={clsx(
                'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all',
                isDragActive
                  ? 'border-primary-400 bg-primary-50'
                  : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50'
              )}
            >
              <input {...getInputProps()} />
              <Upload className={clsx('w-12 h-12 mx-auto mb-4', isDragActive ? 'text-primary-500' : 'text-slate-400')} />
              {isDragActive ? (
                <p className="text-primary-600 font-semibold">Déposez vos fichiers ici !</p>
              ) : (
                <>
                  <p className="text-slate-700 font-semibold">Glissez-déposez vos fichiers</p>
                  <p className="text-slate-500 text-sm mt-1">ou cliquez pour sélectionner</p>
                  <p className="text-slate-400 text-xs mt-3">
                    PDF, Images (TIFF, JPEG, PNG), Word, Excel, Vidéo, Audio, ZIP · Max 500 MB
                  </p>
                </>
              )}
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">{files.length} fichier(s)</h3>
                  <button
                    onClick={() => setFiles([])}
                    className="text-xs text-slate-400 hover:text-red-500"
                  >
                    Tout supprimer
                  </button>
                </div>
                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto scrollbar-thin">
                  {files.map((f) => (
                    <div key={f.id} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <File className="w-8 h-8 text-slate-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            value={f.title}
                            onChange={(e) => updateFile(f.id, { title: e.target.value })}
                            className="text-sm font-medium text-slate-800 w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary-300 rounded px-1"
                            disabled={f.status !== 'pending'}
                          />
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-slate-400">{formatSize(f.file.size)}</span>
                            {f.status === 'pending' && (
                              <select
                                value={f.type}
                                onChange={(e) => updateFile(f.id, { type: e.target.value })}
                                className="text-xs border border-slate-200 rounded px-1.5 py-0.5 bg-white"
                              >
                                {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                            )}
                            {f.status === 'done' && (
                              <span className="badge bg-green-100 text-green-700">
                                <CheckCircle className="w-3 h-3 mr-1" /> Importé
                              </span>
                            )}
                            {f.status === 'uploading' && (
                              <span className="badge bg-blue-100 text-blue-700">
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" /> En cours...
                              </span>
                            )}
                            {f.status === 'error' && (
                              <span className="badge bg-red-100 text-red-700">
                                <AlertCircle className="w-3 h-3 mr-1" /> {f.error}
                              </span>
                            )}
                          </div>
                          {f.status === 'uploading' && (
                            <div className="mt-2 h-1.5 bg-slate-100 rounded-full">
                              <div
                                className="h-full bg-primary-500 rounded-full transition-all"
                                style={{ width: `${f.progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                        {f.status === 'pending' && (
                          <button onClick={() => removeFile(f.id)} className="p-1 text-slate-400 hover:text-red-500">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        {f.status === 'done' && f.docId && (
                          <button
                            onClick={() => router.push(`/documents/${f.docId}`)}
                            className="p-1 text-primary-500 hover:text-primary-700"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
