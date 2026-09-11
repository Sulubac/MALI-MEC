'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Search, Sparkles, Mic, Filter, Calendar, Building2,
  FileText, ChevronRight, Brain, MessageSquare, Loader2
} from 'lucide-react';
import { searchApi } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { clsx } from 'clsx';

const EXAMPLE_QUERIES = [
  "Trouve tous les contrats signés entre 2015 et 2020 concernant le Port",
  "Quels documents expirent cette année ?",
  "Décrets du Ministère des Finances de 2023",
  "Contrats avec les entreprises chinoises",
  "Rapports sur l'éducation nationale 2022-2024",
  "Lois votées depuis 2020",
];

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [activeQuery, setActiveQuery] = useState(searchParams.get('q') || '');
  const [mode, setMode] = useState<'standard' | 'natural' | 'ai'>('standard');
  const [aiAnswer, setAiAnswer] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    institution_id: '',
    document_type: '',
  });
  const [page, setPage] = useState(1);

  const { data: results, isLoading, isFetching } = useQuery({
    queryKey: ['search', activeQuery, mode, filters, page],
    queryFn: () => {
      if (!activeQuery) return null;
      if (mode === 'natural') {
        return searchApi.naturalLanguage(activeQuery).then(r => r.data);
      }
      return searchApi.search({ q: activeQuery, page, size: 20, ...filters }).then(r => r.data);
    },
    enabled: !!activeQuery && mode !== 'ai',
  });

  const aiMutation = useMutation({
    mutationFn: (q: string) => searchApi.aiAssistant(q).then(r => r.data),
    onSuccess: (data) => setAiAnswer(data),
  });

  const handleSearch = (q?: string) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    setActiveQuery(searchQuery);
    setPage(1);
    setAiAnswer(null);
    if (mode === 'ai') {
      aiMutation.mutate(searchQuery);
    }
    router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      setActiveQuery(q);
    }
  }, [searchParams]);

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recherche avancée</h1>
          <p className="text-slate-500 text-sm mt-1">Moteur de recherche sur l'ensemble des archives nationales</p>
        </div>

        {/* Search modes */}
        <div className="card p-4">
          <div className="flex gap-2 mb-4">
            {[
              { key: 'standard', label: 'Standard', icon: Search },
              { key: 'natural', label: 'Langage naturel', icon: MessageSquare },
              { key: 'ai', label: 'Assistant IA', icon: Brain },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setMode(key as any)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  mode === key
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === 'natural'
                  ? 'Ex: "Tous les contrats signés entre 2015 et 2020 concernant le Port"'
                  : mode === 'ai'
                  ? 'Posez votre question à l\'assistant IA...'
                  : 'Rechercher dans les archives...'
              }
              className="input pl-12 pr-32 py-4 text-base"
              autoFocus
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {mode === 'standard' && (
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={clsx(
                    'p-2 rounded-lg transition-colors',
                    showFilters ? 'bg-primary-100 text-primary-600' : 'text-slate-400 hover:bg-slate-100'
                  )}
                >
                  <Filter className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => handleSearch()}
                disabled={!query.trim() || isLoading || aiMutation.isPending}
                className="btn-primary py-2 px-4"
              >
                {isLoading || aiMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Rechercher
              </button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
              <div>
                <label className="label">Date début</label>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilters(f => ({ ...f, date_from: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Date fin</label>
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters(f => ({ ...f, date_to: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Type</label>
                <select
                  value={filters.document_type}
                  onChange={(e) => setFilters(f => ({ ...f, document_type: e.target.value }))}
                  className="input"
                >
                  <option value="">Tous</option>
                  {['decret', 'arrete', 'loi', 'contrat', 'rapport', 'note', 'decision'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setFilters({ date_from: '', date_to: '', institution_id: '', document_type: '' })}
                  className="btn-secondary w-full justify-center"
                >
                  Réinitialiser
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Example queries */}
        {!activeQuery && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Exemples de recherches
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => { setQuery(q); handleSearch(q); }}
                  className="text-left p-3 rounded-lg border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition-all text-sm text-slate-600 hover:text-primary-700"
                >
                  <Sparkles className="w-3.5 h-3.5 inline mr-2 text-amber-400" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* AI Answer */}
        {mode === 'ai' && aiAnswer && (
          <div className="card p-6 border-l-4 border-primary-500">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-5 h-5 text-primary-600" />
              <h3 className="font-semibold text-slate-800">Réponse de l'Assistant IA</h3>
            </div>
            <p className="text-slate-700 leading-relaxed">{aiAnswer.answer}</p>
            {aiAnswer.sources?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 mb-2">Sources ({aiAnswer.total_found} résultats):</p>
                <div className="space-y-2">
                  {aiAnswer.sources.map((src: any) => (
                    <div
                      key={src.id}
                      className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 cursor-pointer"
                      onClick={() => router.push(`/documents/${src.id}`)}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {src.title} <span className="text-slate-400 text-xs">({src.type})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {activeQuery && results && mode !== 'ai' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{results.total?.toLocaleString()}</span> résultat(s) pour{' '}
                <span className="font-semibold text-primary-600">"{activeQuery}"</span>
              </p>
              {isFetching && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            </div>

            <div className="space-y-3">
              {results.hits?.map((hit: any) => (
                <div
                  key={hit.id}
                  className="card p-4 cursor-pointer hover:shadow-md hover:border-primary-200 transition-all"
                  onClick={() => hit.id.startsWith('mock') ? null : router.push(`/documents/${hit.id}`)}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-primary-50 rounded-lg shrink-0">
                      <FileText className="w-5 h-5 text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold text-slate-800 line-clamp-1">
                          {hit.source?.title || 'Document sans titre'}
                        </h3>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-slate-400">Score: {hit.score?.toFixed(1)}</span>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                      <div className="flex items-center flex-wrap gap-2 mt-2">
                        {hit.source?.type && (
                          <span className="badge bg-blue-100 text-blue-700">{hit.source.type}</span>
                        )}
                        {hit.source?.confidentiality && (
                          <span className={clsx('badge', {
                            'bg-green-100 text-green-700': hit.source.confidentiality === 'public',
                            'bg-blue-100 text-blue-700': hit.source.confidentiality === 'internal',
                            'bg-orange-100 text-orange-700': hit.source.confidentiality === 'confidential',
                            'bg-red-100 text-red-700': hit.source.confidentiality === 'secret',
                          })}>
                            {hit.source.confidentiality}
                          </span>
                        )}
                        {hit.source?.document_date && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(hit.source.document_date).toLocaleDateString('fr-DJ')}
                          </span>
                        )}
                      </div>
                      {hit.highlight?.content_text?.[0] && (
                        <p
                          className="text-sm text-slate-600 mt-2 line-clamp-2"
                          dangerouslySetInnerHTML={{ __html: hit.highlight.content_text[0] }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {results.hits?.length === 0 && (
                <div className="card p-12 text-center text-slate-400">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>Aucun résultat pour cette recherche</p>
                  <p className="text-xs mt-1">Essayez d'autres termes ou utilisez l'assistant IA</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
