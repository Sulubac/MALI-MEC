'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Building2, ChevronRight, FileText, Users, HardDrive, MapPin } from 'lucide-react';
import { institutionsApi } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';

const TYPE_COLORS: Record<string, string> = {
  presidence: 'bg-purple-100 text-purple-800',
  primature: 'bg-indigo-100 text-indigo-800',
  sgg: 'bg-blue-100 text-blue-800',
  ministere: 'bg-cyan-100 text-cyan-800',
  direction: 'bg-teal-100 text-teal-800',
  service: 'bg-green-100 text-green-800',
  etablissement_public: 'bg-amber-100 text-amber-800',
};

const TYPE_LABELS: Record<string, string> = {
  presidence: 'Présidence',
  primature: 'Primature',
  sgg: 'SGG',
  ministere: 'Ministère',
  secretariat_etat: 'Secrétariat d\'État',
  direction: 'Direction',
  service: 'Service',
  etablissement_public: 'Établissement Public',
  collectivite: 'Collectivité',
  ambassade: 'Ambassade',
};

export default function InstitutionsPage() {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['institutions'],
    queryFn: () => institutionsApi.list({ size: 100 }).then(r => r.data),
  });

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Institutions</h1>
            <p className="text-slate-500 text-sm mt-1">
              {data?.total || 0} institution(s) dans le système
            </p>
          </div>
          <button
            onClick={() => router.push('/institutions/new')}
            className="btn-primary"
          >
            <Building2 className="w-4 h-4" />
            Nouvelle institution
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card p-5 space-y-3">
                <div className="h-5 bg-slate-100 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-slate-100 rounded animate-pulse w-1/2" />
                <div className="h-4 bg-slate-100 rounded animate-pulse w-full" />
              </div>
            ))
          ) : data?.items?.map((inst: any) => (
            <div
              key={inst.id}
              className="card p-5 cursor-pointer hover:shadow-md hover:border-primary-200 transition-all"
              onClick={() => router.push(`/institutions/${inst.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 bg-primary-50 rounded-xl">
                  <Building2 className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex gap-2 items-center">
                  <span className={`badge ${TYPE_COLORS[inst.type] || 'bg-slate-100 text-slate-700'}`}>
                    {TYPE_LABELS[inst.type] || inst.type}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>

              <h3 className="font-semibold text-slate-800 mb-1 line-clamp-2">{inst.name}</h3>
              {inst.name_ar && (
                <p className="text-sm text-slate-400 mb-3 font-arabic">{inst.name_ar}</p>
              )}

              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100">
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-900">{inst.document_count?.toLocaleString() || 0}</p>
                  <p className="text-xs text-slate-400">Docs</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-900">{inst.storage_used_gb?.toFixed(1) || 0}</p>
                  <p className="text-xs text-slate-400">GB</p>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-slate-900">
                    {inst.storage_quota_gb > 0
                      ? `${Math.round((inst.storage_used_gb / inst.storage_quota_gb) * 100)}%`
                      : '0%'}
                  </div>
                  <p className="text-xs text-slate-400">Quota</p>
                </div>
              </div>

              {inst.city && (
                <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-400">
                  <MapPin className="w-3 h-3" />
                  {inst.city}
                </div>
              )}
            </div>
          ))}
        </div>

        {!isLoading && !data?.items?.length && (
          <div className="card p-12 text-center text-slate-400">
            <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>Aucune institution enregistrée</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
