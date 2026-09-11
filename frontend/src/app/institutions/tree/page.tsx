'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { institutionsApi } from '@/lib/api';
import { Building2, ChevronRight, ChevronDown, MapPin, FileText, Users, HardDrive } from 'lucide-react';

const TYPE_COLORS: Record<string, string> = {
  presidence: 'bg-red-100 text-red-700',
  primature: 'bg-orange-100 text-orange-700',
  sgg: 'bg-yellow-100 text-yellow-700',
  ministere: 'bg-blue-100 text-blue-700',
  direction: 'bg-green-100 text-green-700',
  agence: 'bg-purple-100 text-purple-700',
  prefecture: 'bg-cyan-100 text-cyan-700',
  commune: 'bg-pink-100 text-pink-700',
};

const TYPE_LABELS: Record<string, string> = {
  presidence: 'Présidence', primature: 'Primature', sgg: 'SGG',
  ministere: 'Ministère', direction: 'Direction', agence: 'Agence',
  prefecture: 'Préfecture', commune: 'Commune',
};

function InstitutionNode({ inst, depth = 0 }: { inst: any; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = inst.children && inst.children.length > 0;
  const typeCfg = TYPE_COLORS[inst.type] || 'bg-gray-100 text-gray-600';

  return (
    <div>
      <div
        className="flex items-center gap-2 p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group"
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />
        ) : <div className="w-4 shrink-0" />}

        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeCfg}`}>
          <Building2 size={15} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 text-sm">{inst.name}</span>
            {inst.acronym && <span className="text-xs text-gray-400">({inst.acronym})</span>}
          </div>
          {inst.name_ar && <span className="text-xs text-gray-500 font-arabic" dir="rtl">{inst.name_ar}</span>}
        </div>

        <div className="flex items-center gap-3 ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {inst.document_count !== undefined && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <FileText size={11} /> {inst.document_count}
            </span>
          )}
          {inst.city && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <MapPin size={11} /> {inst.city}
            </span>
          )}
          <span className={`badge text-xs ${typeCfg}`}>{TYPE_LABELS[inst.type] || inst.type}</span>
        </div>
      </div>

      {hasChildren && expanded && (
        <div>
          {inst.children.map((child: any) => (
            <InstitutionNode key={child.id} inst={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function InstitutionTreePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['institutions-tree'],
    queryFn: () => institutionsApi.getTree(),
  });

  const tree = data?.data?.tree || data?.tree || data?.data || data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
          <Building2 size={20} className="text-primary-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Hiérarchie des institutions</h1>
          <p className="text-gray-500 text-sm">Arborescence de l'administration djiboutienne</p>
        </div>
      </div>

      {/* Legend */}
      <div className="card p-4 flex flex-wrap gap-2">
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <span key={key} className={`badge text-xs ${TYPE_COLORS[key] || 'bg-gray-100 text-gray-600'}`}>
            {label}
          </span>
        ))}
      </div>

      <div className="card p-4">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Chargement de l'arborescence...</div>
        ) : (Array.isArray(tree) ? tree : []).length === 0 ? (
          <div className="text-center py-12 text-gray-400">Aucune institution trouvée</div>
        ) : (
          <div className="space-y-1">
            {(Array.isArray(tree) ? tree : []).map((inst: any) => (
              <InstitutionNode key={inst.id} inst={inst} depth={0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
