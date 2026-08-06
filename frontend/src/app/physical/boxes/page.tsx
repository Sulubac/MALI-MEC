'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { physicalApi } from '@/lib/api';
import { Archive, Plus, Search, MapPin, QrCode, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const BOX_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  in_place: { label: 'En place', color: 'bg-green-100 text-green-700' },
  borrowed: { label: 'Emprunté', color: 'bg-yellow-100 text-yellow-700' },
  in_transit: { label: 'En transit', color: 'bg-blue-100 text-blue-700' },
  missing: { label: 'Introuvable', color: 'bg-red-100 text-red-700' },
};

export default function PhysicalBoxesPage() {
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [locateResult, setLocateResult] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ location_id: '', barcode: '', label: '', description: '', year_start: new Date().getFullYear() });
  const queryClient = useQueryClient();

  const { data: locationsData } = useQuery({
    queryKey: ['physical-locations'],
    queryFn: () => physicalApi.listLocations(),
  });

  const { data: boxesData, isLoading } = useQuery({
    queryKey: ['physical-boxes'],
    queryFn: () => physicalApi.listBoxes(),
  });

  const locateMutation = useMutation({
    mutationFn: (barcode: string) => physicalApi.locateBox(barcode),
    onSuccess: (data) => setLocateResult(data?.data || data),
    onError: () => { toast.error('Boîte introuvable'); setLocateResult(null); },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => physicalApi.createBox(data),
    onSuccess: () => {
      toast.success('Boîte créée avec succès');
      queryClient.invalidateQueries({ queryKey: ['physical-boxes'] });
      setShowCreate(false);
      setForm({ location_id: '', barcode: '', label: '', description: '', year_start: new Date().getFullYear() });
    },
    onError: () => toast.error('Erreur lors de la création'),
  });

  const locations = locationsData?.data || locationsData?.locations || locationsData || [];
  const boxes = boxesData?.data || boxesData?.boxes || boxesData || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
            <Archive size={20} className="text-primary-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Boîtes d'archives</h1>
            <p className="text-gray-500 text-sm">Gestion et localisation des boîtes physiques</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nouvelle boîte
        </button>
      </div>

      {/* Barcode search */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <QrCode size={18} className="text-primary-500" /> Localiser une boîte
        </h2>
        <div className="flex gap-3">
          <input
            value={barcodeSearch}
            onChange={e => setBarcodeSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && barcodeSearch && locateMutation.mutate(barcodeSearch)}
            placeholder="Scanner ou saisir un code-barres..."
            className="input flex-1 font-mono"
          />
          <button
            onClick={() => barcodeSearch && locateMutation.mutate(barcodeSearch)}
            disabled={!barcodeSearch || locateMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            <Search size={16} /> {locateMutation.isPending ? 'Recherche...' : 'Localiser'}
          </button>
        </div>

        {locateResult && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <MapPin size={20} className="text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-green-800">{locateResult.label || `Boîte ${locateResult.barcode}`}</p>
                <p className="text-green-700 text-sm mt-1">
                  Dépôt: <strong>{locateResult.location_name}</strong>
                </p>
                {locateResult.room_name && (
                  <p className="text-green-700 text-sm">Salle: <strong>{locateResult.room_name}</strong></p>
                )}
                {locateResult.shelf_code && (
                  <p className="text-green-700 text-sm">Étagère: <strong>{locateResult.shelf_code}</strong></p>
                )}
                <span className={`badge text-xs mt-2 ${BOX_STATUS_CONFIG[locateResult.status]?.color || 'bg-gray-100 text-gray-600'}`}>
                  {BOX_STATUS_CONFIG[locateResult.status]?.label || locateResult.status}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <h3 className="font-semibold text-gray-900 mb-4">Nouvelle boîte d'archives</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Dépôt *</label>
                <select value={form.location_id} onChange={e => setForm({ ...form, location_id: e.target.value })} className="input w-full">
                  <option value="">Sélectionner un dépôt...</option>
                  {(Array.isArray(locations) ? locations : []).map((loc: any) => (
                    <option key={loc.id} value={loc.id}>{loc.name} ({loc.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Code-barres</label>
                <input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} className="input w-full font-mono" placeholder="Auto-généré si vide" />
              </div>
              <div>
                <label className="label">Libellé</label>
                <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} className="input w-full" placeholder="Ex: Ministère des Finances 2024" />
              </div>
              <div>
                <label className="label">Année de début</label>
                <input type="number" value={form.year_start} onChange={e => setForm({ ...form, year_start: +e.target.value })} className="input w-full" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.location_id || createMutation.isPending}
                className="btn-primary flex-1"
              >
                {createMutation.isPending ? 'Création...' : 'Créer'}
              </button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Boxes list */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : (Array.isArray(boxes) ? boxes : []).length === 0 ? (
        <div className="text-center py-16 card">
          <Archive size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Aucune boîte enregistrée</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Code-barres</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Libellé</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Dépôt</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Documents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(Array.isArray(boxes) ? boxes : []).map((box: any) => {
                  const statusCfg = BOX_STATUS_CONFIG[box.status] || { label: box.status, color: 'bg-gray-100 text-gray-600' };
                  return (
                    <tr key={box.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <code className="font-mono text-primary-600 font-bold">{box.barcode}</code>
                      </td>
                      <td className="px-4 py-3 text-gray-900">{box.label || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{box.location_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`badge text-xs ${statusCfg.color}`}>{statusCfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{box.document_count || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
