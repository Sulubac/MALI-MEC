'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { classificationApi } from '@/lib/api';
import {
  FolderTree, ChevronRight, ChevronDown, Plus, Folder, FolderOpen,
  FileText, Clock, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';

const LEVEL_COLORS = [
  'text-blue-700 bg-blue-50',
  'text-purple-700 bg-purple-50',
  'text-green-700 bg-green-50',
  'text-orange-700 bg-orange-50',
  'text-pink-700 bg-pink-50',
];

function ClassificationNode({ node, depth = 0 }: { node: any; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const colorClass = LEVEL_COLORS[depth % LEVEL_COLORS.length];

  return (
    <div>
      <div
        className={`flex items-center gap-2 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer group transition-colors ${depth === 0 ? 'border border-gray-100 mb-1' : ''}`}
        style={{ paddingLeft: `${depth * 20 + 10}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded
            ? <ChevronDown size={16} className="text-gray-400 shrink-0" />
            : <ChevronRight size={16} className="text-gray-400 shrink-0" />
        ) : (
          <div className="w-4 shrink-0" />
        )}

        {hasChildren
          ? (expanded ? <FolderOpen size={18} className="text-yellow-500 shrink-0" /> : <Folder size={18} className="text-yellow-400 shrink-0" />)
          : <FileText size={16} className="text-gray-400 shrink-0" />
        }

        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 text-sm">{node.name}</span>
          {node.name_ar && (
            <span className="text-gray-500 text-xs font-arabic" dir="rtl">{node.name_ar}</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <code className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${colorClass}`}>
            {node.full_code || node.code}
          </code>
          {node.document_count > 0 && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {node.document_count} doc{node.document_count > 1 ? 's' : ''}
            </span>
          )}
          {node.retention_years && (
            <span className="text-xs text-blue-500 flex items-center gap-1">
              <Clock size={11} /> {node.retention_years}a
            </span>
          )}
          {node.confidentiality_default && node.confidentiality_default !== 'public' && (
            <Shield size={14} className="text-orange-400" />
          )}
        </div>
      </div>

      {hasChildren && expanded && (
        <div>
          {node.children.map((child: any) => (
            <ClassificationNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClassificationPage() {
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planCode, setPlanCode] = useState('');
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['classification-plans'],
    queryFn: () => classificationApi.listPlans(),
  });

  const { data: treeData, isLoading: treeLoading } = useQuery({
    queryKey: ['classification-tree', activePlanId],
    queryFn: () => activePlanId ? classificationApi.getPlanTree(activePlanId) : null,
    enabled: !!activePlanId,
  });

  const plans = plansData?.data || plansData?.plans || plansData || [];

  // Auto-select first plan
  const activePlan = (Array.isArray(plans) ? plans : []).find((p: any) => p.id === activePlanId)
    || (Array.isArray(plans) && plans.length > 0 ? plans[0] : null);

  const effectivePlanId = activePlanId || activePlan?.id;

  const { data: activeTreeData, isLoading: activeTreeLoading } = useQuery({
    queryKey: ['classification-tree', effectivePlanId],
    queryFn: () => effectivePlanId ? classificationApi.getPlanTree(effectivePlanId) : null,
    enabled: !!effectivePlanId,
  });

  const createPlanMutation = useMutation({
    mutationFn: (data: any) => classificationApi.createPlan(data),
    onSuccess: () => {
      toast.success('Plan de classement créé');
      queryClient.invalidateQueries({ queryKey: ['classification-plans'] });
      setShowCreatePlan(false);
      setPlanName('');
      setPlanCode('');
    },
    onError: () => toast.error('Erreur lors de la création'),
  });

  const tree = activeTreeData?.data?.tree || activeTreeData?.tree || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="gradient-header rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <FolderTree size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Plan de Classement</h1>
              <p className="text-white/80 text-sm">Structure nationale de classement des archives — PNC-DJ</p>
            </div>
          </div>
          <button onClick={() => setShowCreatePlan(true)} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Plus size={16} /> Nouveau plan
          </button>
        </div>
      </div>

      {/* Create plan modal */}
      {showCreatePlan && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <h3 className="font-semibold text-gray-900 mb-4">Nouveau plan de classement</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Code du plan *</label>
                <input value={planCode} onChange={e => setPlanCode(e.target.value)} placeholder="Ex: PNC-DJ-2025" className="input w-full" />
              </div>
              <div>
                <label className="label">Nom du plan *</label>
                <input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="Ex: Plan national 2025" className="input w-full" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => createPlanMutation.mutate({ code: planCode, name: planName, is_national: true })}
                disabled={!planName.trim() || !planCode.trim() || createPlanMutation.isPending}
                className="btn-primary flex-1"
              >
                {createPlanMutation.isPending ? 'Création...' : 'Créer'}
              </button>
              <button onClick={() => setShowCreatePlan(false)} className="btn-secondary flex-1">Annuler</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Plans list */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1">Plans disponibles</h2>
          {plansLoading ? (
            <div className="text-center py-8 text-gray-400 text-sm">Chargement...</div>
          ) : (
            (Array.isArray(plans) ? plans : []).map((plan: any) => (
              <button
                key={plan.id}
                onClick={() => setActivePlanId(plan.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  (activePlanId || activePlan?.id) === plan.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 bg-white hover:border-primary-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <code className="text-xs font-mono font-bold text-primary-600">{plan.code}</code>
                  {plan.is_national && (
                    <span className="text-xs bg-djibouti-blue text-white px-2 py-0.5 rounded-full">National</span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900 mt-1">{plan.name}</p>
                {plan.version && <p className="text-xs text-gray-400 mt-1">v{plan.version}</p>}
              </button>
            ))
          )}
        </div>

        {/* Tree view */}
        <div className="lg:col-span-3 card p-6">
          {!effectivePlanId ? (
            <div className="text-center py-16">
              <FolderTree size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Sélectionnez un plan de classement</p>
            </div>
          ) : activeTreeLoading ? (
            <div className="text-center py-16 text-gray-400">Chargement de l'arborescence...</div>
          ) : tree.length === 0 ? (
            <div className="text-center py-16">
              <Folder size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucune entrée dans ce plan</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">
                  {activePlan?.name || 'Plan de classement'}
                </h2>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Clock size={12} /> Rétention</span>
                  <span className="flex items-center gap-1"><Shield size={12} /> Confidentialité</span>
                </div>
              </div>
              <div className="space-y-1">
                {tree.map((node: any) => (
                  <ClassificationNode key={node.id} node={node} depth={0} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="card p-4 flex flex-wrap gap-4 text-sm text-gray-600">
        <span className="flex items-center gap-2"><FolderOpen size={16} className="text-yellow-500" /> Domaine / Sous-domaine</span>
        <span className="flex items-center gap-2"><FileText size={16} className="text-gray-400" /> Série (feuille)</span>
        <span className="flex items-center gap-2"><Clock size={14} className="text-blue-500" /> Durée de conservation (années)</span>
        <span className="flex items-center gap-2"><Shield size={14} className="text-orange-400" /> Niveau de confidentialité</span>
      </div>
    </div>
  );
}
