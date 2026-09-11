'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { physicalApi } from '@/lib/api';
import {
  Warehouse, Plus, MapPin, Wind, Flame, Camera, Wifi,
  Thermometer
} from 'lucide-react';
import toast from 'react-hot-toast';

function FeatureIcon({ active, label, icon }: { active: boolean; label: string; icon: React.ReactNode }) {
  return (
    <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
      {icon} {label}
    </span>
  );
}

export default function PhysicalLocationsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '', code: '', address: '', city: 'Djibouti',
    total_capacity_boxes: 1000,
    has_climate_control: true,
    has_fire_suppression: true,
    has_security_camera: true,
    has_rfid: false,
    temperature_min: 18,
    temperature_max: 22,
    humidity_min: 45,
    humidity_max: 55,
  });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['physical-locations'],
    queryFn: () => physicalApi.listLocations(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => physicalApi.createLocation(data),
    onSuccess: () => {
      toast.success('Dépôt créé avec succès');
      queryClient.invalidateQueries({ queryKey: ['physical-locations'] });
      setShowCreate(false);
      setForm({ name: '', code: '', address: '', city: 'Djibouti', total_capacity_boxes: 1000, has_climate_control: true, has_fire_suppression: true, has_security_camera: true, has_rfid: false, temperature_min: 18, temperature_max: 22, humidity_min: 45, humidity_max: 55 });
    },
    onError: () => toast.error('Erreur lors de la création'),
  });

  const locations = data?.data || data?.locations || data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
            <Warehouse size={20} className="text-primary-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dépôts d'archives</h1>
            <p className="text-gray-500 text-sm">Gestion des emplacements physiques</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nouveau dépôt
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="card p-6 w-full max-w-lg my-4">
            <h3 className="font-semibold text-gray-900 mb-4">Nouveau dépôt d'archives</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Nom du dépôt *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input w-full" placeholder="Dépôt Central" />
                </div>
                <div>
                  <label className="label">Code *</label>
                  <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="input w-full" placeholder="DEP-001" />
                </div>
              </div>
              <div>
                <label className="label">Adresse</label>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="input w-full" placeholder="Rue..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Ville</label>
                  <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="input w-full" />
                </div>
                <div>
                  <label className="label">Capacité (boîtes)</label>
                  <input type="number" value={form.total_capacity_boxes} onChange={e => setForm({ ...form, total_capacity_boxes: +e.target.value })} className="input w-full" />
                </div>
              </div>
              <div>
                <label className="label">Équipements</label>
                <div className="flex flex-wrap gap-3 mt-2">
                  {[
                    { key: 'has_climate_control', label: 'Climatisation' },
                    { key: 'has_fire_suppression', label: 'Anti-incendie' },
                    { key: 'has_security_camera', label: 'Vidéosurveillance' },
                    { key: 'has_rfid', label: 'RFID' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(form as any)[key]}
                        onChange={e => setForm({ ...form, [key]: e.target.checked })}
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Temp. min/max (°C)</label>
                  <div className="flex gap-2">
                    <input type="number" value={form.temperature_min} onChange={e => setForm({ ...form, temperature_min: +e.target.value })} className="input w-full" />
                    <input type="number" value={form.temperature_max} onChange={e => setForm({ ...form, temperature_max: +e.target.value })} className="input w-full" />
                  </div>
                </div>
                <div>
                  <label className="label">Humidité min/max (%)</label>
                  <div className="flex gap-2">
                    <input type="number" value={form.humidity_min} onChange={e => setForm({ ...form, humidity_min: +e.target.value })} className="input w-full" />
                    <input type="number" value={form.humidity_max} onChange={e => setForm({ ...form, humidity_max: +e.target.value })} className="input w-full" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.name.trim() || !form.code.trim() || createMutation.isPending}
                className="btn-primary flex-1"
              >
                {createMutation.isPending ? 'Création...' : 'Créer'}
              </button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Locations grid */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : (Array.isArray(locations) ? locations : []).length === 0 ? (
        <div className="text-center py-16 card">
          <Warehouse size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Aucun dépôt enregistré</p>
          <p className="text-sm text-gray-400 mt-1">Créez votre premier dépôt d'archives physiques</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {(Array.isArray(locations) ? locations : []).map((loc: any) => {
            const usedPct = loc.total_capacity_boxes > 0
              ? Math.round((loc.used_boxes / loc.total_capacity_boxes) * 100) : 0;
            return (
              <div key={loc.id} className="card p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{loc.name}</p>
                    <code className="text-xs text-primary-600 font-mono">{loc.code}</code>
                  </div>
                  <span className={`badge text-xs ${loc.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {loc.status === 'active' ? 'Actif' : loc.status}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-3 text-gray-500 text-sm">
                  <MapPin size={14} /> {loc.address || loc.city || 'Djibouti'}
                </div>

                {/* Capacity bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Occupation</span>
                    <span>{loc.used_boxes || 0} / {loc.total_capacity_boxes} boîtes ({usedPct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${usedPct > 90 ? 'bg-red-500' : usedPct > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>
                </div>

                {/* Features */}
                <div className="flex flex-wrap gap-2 mt-4">
                  <FeatureIcon active={loc.has_climate_control} label="Climat" icon={<Wind size={11} />} />
                  <FeatureIcon active={loc.has_fire_suppression} label="Incendie" icon={<Flame size={11} />} />
                  <FeatureIcon active={loc.has_security_camera} label="Vidéo" icon={<Camera size={11} />} />
                  <FeatureIcon active={loc.has_rfid} label="RFID" icon={<Wifi size={11} />} />
                </div>

                {/* Climate */}
                {loc.temperature_min && (
                  <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                    <Thermometer size={12} />
                    <span>{loc.temperature_min}–{loc.temperature_max}°C</span>
                    <span className="text-gray-300">|</span>
                    <span>{loc.humidity_min}–{loc.humidity_max}% HR</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
