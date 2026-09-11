'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { searchApi } from '@/lib/api';
import { Globe, Search, FileText, Download, Eye, Shield, Clock, Info, Book } from 'lucide-react';

const EXAMPLE_QUERIES = [
  'Journal Officiel 2024',
  'Décret présidentiel',
  'Loi sur l\'environnement',
  'Accord international Djibouti',
  'Règlement municipal',
  'Code civil djiboutien',
];

function DocumentCard({ doc }: { doc: any }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium capitalize">
              {doc.type?.replace(/_/g, ' ')}
            </span>
            {doc.document_date && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock size={11} /> {new Date(doc.document_date).toLocaleDateString('fr-FR')}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-gray-900 leading-tight">{doc.title}</h3>
          {doc.title_ar && <p className="text-gray-500 text-sm mt-1 font-arabic" dir="rtl">{doc.title_ar}</p>}
          {doc.highlight && (
            <p
              className="text-gray-600 text-sm mt-2 line-clamp-2 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: doc.highlight }}
            />
          )}
          {doc.institution_name && (
            <p className="text-xs text-gray-400 mt-2">Source: {doc.institution_name}</p>
          )}
        </div>
        <FileText size={20} className="text-gray-300 shrink-0 mt-1" />
      </div>
      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-50">
        <button className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium">
          <Eye size={14} /> Consulter
        </button>
        <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <Download size={14} /> Télécharger
        </button>
        {doc.reference && (
          <span className="ml-auto text-xs text-gray-400 font-mono">{doc.reference}</span>
        )}
      </div>
    </div>
  );
}

export default function CitizenPortalPage() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'search' | 'ai'>('search');
  const [results, setResults] = useState<any[]>([]);
  const [aiAnswer, setAiAnswer] = useState('');

  const searchMutation = useMutation({
    mutationFn: (q: string) => searchApi.search({ q, confidentiality: 'public' }),
    onSuccess: (data) => {
      setResults(data?.data?.results || data?.results || []);
    },
  });

  const aiMutation = useMutation({
    mutationFn: (q: string) => searchApi.aiAssistant(q),
    onSuccess: (data) => {
      setAiAnswer(data?.data?.answer || data?.answer || '');
      setResults(data?.data?.sources || data?.sources || []);
    },
  });

  const handleSearch = (q: string = query) => {
    if (!q.trim()) return;
    setAiAnswer('');
    if (mode === 'ai') {
      aiMutation.mutate(q);
    } else {
      searchMutation.mutate(q);
    }
  };

  const isPending = searchMutation.isPending || aiMutation.isPending;

  return (
    <div className="min-h-screen bg-gradient-to-b from-djibouti-blue/5 to-white">
      {/* Hero section */}
      <div className="bg-gradient-to-r from-djibouti-blue to-primary-700 text-white py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Globe size={32} />
          </div>
          <h1 className="text-4xl font-bold mb-3">Portail Citoyen</h1>
          <p className="text-xl text-white/80 mb-2">Archives Nationales de la République de Djibouti</p>
          <p className="text-white/60 text-sm">Accès libre aux documents publics officiels</p>

          {/* Search bar */}
          <div className="mt-8 max-w-2xl mx-auto">
            <div className="flex gap-2 mb-3">
              {(['search', 'ai'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    mode === m ? 'bg-white text-primary-700' : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  {m === 'search' ? '🔍 Recherche' : '🤖 Assistant IA'}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder={mode === 'ai' ? 'Posez votre question juridique ou administrative...' : 'Rechercher un document officiel...'}
                className="flex-1 px-5 py-3.5 rounded-xl text-gray-900 bg-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 shadow-lg"
              />
              <button
                onClick={() => handleSearch()}
                disabled={isPending || !query.trim()}
                className="px-6 py-3.5 bg-djibouti-green text-white rounded-xl font-semibold hover:bg-green-600 disabled:opacity-50 transition-colors shadow-lg text-sm"
              >
                {isPending ? '...' : 'Rechercher'}
              </button>
            </div>
          </div>

          {/* Example queries */}
          {results.length === 0 && !aiAnswer && (
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {EXAMPLE_QUERIES.map(q => (
                <button
                  key={q}
                  onClick={() => { setQuery(q); handleSearch(q); }}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white/80 rounded-full text-xs transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* AI answer */}
        {aiAnswer && (
          <div className="mb-6 p-5 bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center shrink-0">
                <Info size={16} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-primary-900 mb-2">Réponse de l'assistant IA</p>
                <p className="text-gray-700 text-sm leading-relaxed">{aiAnswer}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                {results.length} document{results.length > 1 ? 's' : ''} trouvé{results.length > 1 ? 's' : ''}
              </h2>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Shield size={12} /> Documents publics uniquement
              </span>
            </div>
            {results.map((doc: any, i: number) => (
              <DocumentCard key={doc.id || i} doc={doc} />
            ))}
          </div>
        )}

        {/* Empty state / welcome */}
        {results.length === 0 && !aiAnswer && !isPending && (
          <div className="space-y-8 mt-4">
            {/* Info cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: <Book size={24} />, title: 'Documents officiels', desc: 'Accédez aux décrets, lois, et décisions gouvernementales' },
                { icon: <Shield size={24} />, title: 'Données publiques', desc: 'Seuls les documents de niveau public sont accessibles sans connexion' },
                { icon: <Globe size={24} />, title: 'Multilingue', desc: 'Recherche en français, arabe, anglais et somali' },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="bg-white rounded-xl border border-gray-100 p-5 text-center shadow-sm">
                  <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center mx-auto mb-3 text-primary-600">
                    {icon}
                  </div>
                  <p className="font-semibold text-gray-900 mb-1">{title}</p>
                  <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            {/* Statistics */}
            <div className="bg-gradient-to-r from-djibouti-blue/10 to-djibouti-green/10 rounded-2xl p-6">
              <h3 className="text-center font-semibold text-gray-900 mb-4">PNGA en chiffres</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                {[
                  { label: 'Documents archivés', value: '100M+' },
                  { label: 'Institutions', value: '200+' },
                  { label: 'Années d\'histoire', value: '60+' },
                  { label: 'Disponibilité', value: '99.99%' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-2xl font-bold text-primary-700">{value}</p>
                    <p className="text-gray-500 text-xs mt-1">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {isPending && (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 text-sm">{mode === 'ai' ? 'L\'IA analyse votre question...' : 'Recherche en cours...'}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 py-6 mt-8">
        <div className="max-w-4xl mx-auto px-6 text-center text-xs text-gray-400">
          <p>PNGA — Plateforme Nationale de Gestion des Archives · République de Djibouti</p>
          <p className="mt-1">Conforme aux standards ISO 15489 · ISO 14721 · ISO 27001 · MoReq2010</p>
        </div>
      </div>
    </div>
  );
}
