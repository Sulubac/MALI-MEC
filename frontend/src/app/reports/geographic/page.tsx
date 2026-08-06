'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import { MapPin, Building2, FileText, HardDrive, AlertTriangle } from 'lucide-react';

function InstitutionCard({ feature }: { feature: any }) {
  const props = feature.properties;
  const [lng, lat] = feature.geometry?.coordinates || [0, 0];

  return (
    <div className="card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{props.name}</p>
          {props.name_ar && (
            <p className="text-gray-500 text-xs font-arabic mt-0.5" dir="rtl">{props.name_ar}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">{props.type?.replace(/_/g, ' ')}</p>
        </div>
        <span className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-lg font-mono shrink-0 ml-2">
          {props.code}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="text-center bg-blue-50 rounded-lg p-2">
          <FileText size={14} className="text-blue-500 mx-auto mb-1" />
          <p className="text-xs font-bold text-gray-900">{(props.document_count || 0).toLocaleString()}</p>
          <p className="text-xs text-gray-500">docs</p>
        </div>
        <div className="text-center bg-purple-50 rounded-lg p-2">
          <Building2 size={14} className="text-purple-500 mx-auto mb-1" />
          <p className="text-xs font-bold text-gray-900">{props.user_count || 0}</p>
          <p className="text-xs text-gray-500">users</p>
        </div>
        <div className="text-center bg-green-50 rounded-lg p-2">
          <HardDrive size={14} className="text-green-500 mx-auto mb-1" />
          <p className="text-xs font-bold text-gray-900">{(props.storage_used_gb || 0).toFixed(1)}</p>
          <p className="text-xs text-gray-500">GB</p>
        </div>
      </div>
      {lat !== 0 && lng !== 0 && (
        <div className="flex items-center gap-1 mt-3 text-xs text-gray-400">
          <MapPin size={12} />
          <span>{lat.toFixed(4)}°N, {lng.toFixed(4)}°E</span>
        </div>
      )}
    </div>
  );
}

export default function GeographicPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-geographic'],
    queryFn: () => dashboardApi.getGeographic(),
  });

  const geoData = data?.data || data;
  const features = geoData?.features || [];

  const totalDocs = features.reduce((sum: number, f: any) => sum + (f.properties?.document_count || 0), 0);
  const totalStorage = features.reduce((sum: number, f: any) => sum + (f.properties?.storage_used_gb || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="gradient-header rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <MapPin size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Distribution Géographique</h1>
            <p className="text-white/80 text-sm">Carte des archives par institution — République de Djibouti</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">{features.length}</p>
            <p className="text-white/70 text-xs mt-1">Institutions géolocalisées</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">{totalDocs.toLocaleString()}</p>
            <p className="text-white/70 text-xs mt-1">Documents total</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">{totalStorage.toFixed(1)} GB</p>
            <p className="text-white/70 text-xs mt-1">Stockage utilisé</p>
          </div>
        </div>
      </div>

      {/* Map placeholder */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Carte interactive</h2>
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
            <AlertTriangle size={14} />
            Module cartographique (react-leaflet) requis
          </div>
        </div>
        {/* Djibouti map placeholder */}
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl h-80 flex items-center justify-center relative overflow-hidden border border-blue-100">
          <div className="absolute inset-0 opacity-5">
            {/* Grid lines */}
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="absolute border-t border-blue-400" style={{ top: `${i * 10}%`, left: 0, right: 0 }} />
            ))}
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="absolute border-l border-blue-400" style={{ left: `${i * 10}%`, top: 0, bottom: 0 }} />
            ))}
          </div>

          {/* Simulated institution markers */}
          {features.slice(0, 8).map((f: any, i: number) => {
            const [lng, lat] = f.geometry?.coordinates || [42.5 + Math.random(), 11.5 + Math.random() * 0.5];
            const x = ((lng - 41.7) / 1.2) * 80 + 10;
            const y = ((12.5 - lat) / 1.5) * 80 + 10;
            return (
              <div
                key={i}
                className="absolute flex flex-col items-center"
                style={{ left: `${Math.max(5, Math.min(90, x))}%`, top: `${Math.max(5, Math.min(80, y))}%` }}
                title={f.properties?.name}
              >
                <div className="w-4 h-4 bg-primary-600 rounded-full border-2 border-white shadow-lg cursor-pointer hover:scale-125 transition-transform" />
                <span className="text-xs font-bold text-primary-700 bg-white/90 px-1 rounded mt-0.5 whitespace-nowrap">
                  {f.properties?.code}
                </span>
              </div>
            );
          })}

          <div className="text-center z-10">
            <MapPin size={40} className="text-primary-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm font-medium">République de Djibouti</p>
            <p className="text-gray-400 text-xs">11°30'N, 43°00'E</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 text-center mt-2">
          Les marqueurs représentent les institutions géolocalisées. Intégration complète avec Leaflet disponible en production.
        </p>
      </div>

      {/* Institution cards grid */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Chargement des données géographiques...</div>
      ) : features.length === 0 ? (
        <div className="text-center py-16 card">
          <MapPin size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Aucune donnée géographique disponible</p>
        </div>
      ) : (
        <>
          <h2 className="font-semibold text-gray-900">Institutions par localisation</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {features.map((f: any, i: number) => (
              <InstitutionCard key={i} feature={f} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
