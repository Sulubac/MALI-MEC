'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowsApi } from '@/lib/api';
import {
  GitBranch, Play, Clock, CheckCircle, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, Plus, User, Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';

const STEP_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'En attente', color: 'bg-gray-100 text-gray-600', icon: <Clock size={12} /> },
  in_progress: { label: 'En cours', color: 'bg-blue-100 text-blue-700', icon: <Play size={12} /> },
  completed: { label: 'Terminé', color: 'bg-green-100 text-green-700', icon: <CheckCircle size={12} /> },
  rejected: { label: 'Rejeté', color: 'bg-red-100 text-red-700', icon: <XCircle size={12} /> },
  skipped: { label: 'Ignoré', color: 'bg-gray-100 text-gray-500', icon: null },
  waiting: { label: 'Attente', color: 'bg-yellow-100 text-yellow-700', icon: <Clock size={12} /> },
};

function StepBadge({ status }: { status: string }) {
  const cfg = STEP_STATUS_CONFIG[status] || { label: status, color: 'bg-gray-100 text-gray-600', icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function StepNode({ step, index }: { step: any; index: number }) {
  const isCompleted = step.status === 'completed';
  const isRejected = step.status === 'rejected';
  const isActive = step.status === 'in_progress';
  const isPending = step.status === 'pending';

  return (
    <div className={`relative flex items-start gap-4 ${index > 0 ? 'mt-0' : ''}`}>
      {/* Line connector */}
      {index > 0 && (
        <div className="absolute left-5 -top-6 w-0.5 h-6 bg-gray-200" />
      )}
      {/* Circle indicator */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 z-10 ${
        isCompleted ? 'bg-green-500 border-green-500 text-white' :
        isRejected ? 'bg-red-500 border-red-500 text-white' :
        isActive ? 'bg-primary-500 border-primary-500 text-white animate-pulse' :
        'bg-white border-gray-300 text-gray-400'
      }`}>
        {isCompleted ? <CheckCircle size={18} /> :
         isRejected ? <XCircle size={18} /> :
         <span className="text-sm font-bold">{step.step_order}</span>}
      </div>
      {/* Step info */}
      <div className={`flex-1 pb-6 ${isPending ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="font-medium text-gray-900">{step.step_name}</p>
            {step.assigned_role && (
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <User size={12} /> {step.assigned_role}
              </p>
            )}
          </div>
          <StepBadge status={step.status} />
        </div>
        {step.started_at && (
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <Calendar size={11} />
            Début: {new Date(step.started_at).toLocaleString('fr-FR')}
          </p>
        )}
        {step.completed_at && (
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <CheckCircle size={11} />
            Fin: {new Date(step.completed_at).toLocaleString('fr-FR')}
            {step.duration_minutes && ` (${step.duration_minutes} min)`}
          </p>
        )}
        {step.sla_deadline && step.is_overdue && (
          <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
            <AlertTriangle size={11} /> SLA dépassé
          </p>
        )}
        {step.decision_notes && (
          <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded italic">"{step.decision_notes}"</p>
        )}
      </div>
    </div>
  );
}

function InstanceCard({ instance }: { instance: any }) {
  const [expanded, setExpanded] = useState(false);
  const completedSteps = instance.steps?.filter((s: any) => s.status === 'completed').length || 0;
  const totalSteps = instance.steps?.length || instance.total_steps || 0;
  const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div className="card overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 truncate">{instance.title || `Instance #${instance.id?.slice(0,8)}`}</span>
              <span className={`badge text-xs ${
                instance.status === 'completed' ? 'bg-green-100 text-green-700' :
                instance.status === 'rejected' ? 'bg-red-100 text-red-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {instance.status === 'completed' ? 'Terminé' :
                 instance.status === 'rejected' ? 'Rejeté' : 'En cours'}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {instance.workflow_name || 'Workflow standard'}
            </p>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-gray-100 rounded">
            {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
          </button>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{completedSteps}/{totalSteps} étapes</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                instance.status === 'completed' ? 'bg-green-500' :
                instance.status === 'rejected' ? 'bg-red-400' : 'bg-primary-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Calendar size={12} /> {new Date(instance.created_at).toLocaleDateString('fr-FR')}
          </span>
          {instance.initiated_by_name && (
            <span className="flex items-center gap-1">
              <User size={12} /> {instance.initiated_by_name}
            </span>
          )}
        </div>
      </div>

      {expanded && instance.steps && (
        <div className="border-t border-gray-100 p-5 bg-gray-50">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">Étapes du workflow</h4>
          <div>
            {instance.steps.map((step: any, i: number) => (
              <StepNode key={step.id} step={step} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkflowsPage() {
  const [activeTab, setActiveTab] = useState<'instances' | 'definitions'>('instances');
  const [showCreateDef, setShowCreateDef] = useState(false);
  const [newDefName, setNewDefName] = useState('');
  const queryClient = useQueryClient();

  const { data: defsData, isLoading: defsLoading } = useQuery({
    queryKey: ['workflow-definitions'],
    queryFn: () => workflowsApi.listDefinitions(),
  });

  const { data: instancesData, isLoading: instancesLoading } = useQuery({
    queryKey: ['workflow-instances'],
    queryFn: () => workflowsApi.listInstances(),
  });

  const { data: statsData } = useQuery({
    queryKey: ['workflow-stats'],
    queryFn: () => workflowsApi.getStats(),
  });

  const createDefMutation = useMutation({
    mutationFn: (name: string) => workflowsApi.createDefinition({
      name,
      description: 'Définition personnalisée',
      steps: [
        { step_code: 'reception', step_name: 'Réception', step_order: 1, required_role: 'archivist', sla_hours: 24 },
        { step_code: 'validation', step_name: 'Validation', step_order: 2, required_role: 'validator', sla_hours: 48 },
        { step_code: 'archivage', step_name: 'Archivage', step_order: 3, required_role: 'archivist', sla_hours: 24 },
      ]
    }),
    onSuccess: () => {
      toast.success('Définition créée');
      queryClient.invalidateQueries({ queryKey: ['workflow-definitions'] });
      setShowCreateDef(false);
      setNewDefName('');
    },
    onError: () => toast.error('Erreur lors de la création'),
  });

  const stats = statsData?.data || statsData || {};
  const definitions = defsData?.data || defsData?.definitions || defsData || [];
  const instances = instancesData?.data || instancesData?.instances || instancesData || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="gradient-header rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <GitBranch size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Workflows BPM</h1>
              <p className="text-white/80 text-sm">Gestion des processus métier</p>
            </div>
          </div>
        </div>
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[
            { label: 'En cours', value: stats.active_instances || 0 },
            { label: 'Terminés', value: stats.completed_instances || 0 },
            { label: 'En retard (SLA)', value: stats.overdue_steps || 0 },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-white/70 text-xs mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['instances', 'definitions'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab === 'instances' ? 'Instances actives' : 'Définitions'}
          </button>
        ))}
        {activeTab === 'definitions' && (
          <button
            onClick={() => setShowCreateDef(true)}
            className="ml-auto btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> Nouvelle définition
          </button>
        )}
      </div>

      {/* Create definition modal */}
      {showCreateDef && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <h3 className="font-semibold text-gray-900 mb-4">Nouvelle définition de workflow</h3>
            <div>
              <label className="label">Nom du workflow</label>
              <input
                value={newDefName}
                onChange={e => setNewDefName(e.target.value)}
                placeholder="Ex: Workflow validation ministère"
                className="input w-full"
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => createDefMutation.mutate(newDefName)}
                disabled={!newDefName.trim() || createDefMutation.isPending}
                className="btn-primary flex-1"
              >
                {createDefMutation.isPending ? 'Création...' : 'Créer'}
              </button>
              <button onClick={() => setShowCreateDef(false)} className="btn-secondary flex-1">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {activeTab === 'instances' && (
        <div>
          {instancesLoading ? (
            <div className="text-center py-12 text-gray-400">Chargement...</div>
          ) : instances.length === 0 ? (
            <div className="text-center py-16 card">
              <GitBranch size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucune instance de workflow active</p>
              <p className="text-sm text-gray-400 mt-1">Les workflows se créent automatiquement lors de la soumission de documents</p>
            </div>
          ) : (
            <div className="space-y-4">
              {instances.map((inst: any) => (
                <InstanceCard key={inst.id} instance={inst} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'definitions' && (
        <div>
          {defsLoading ? (
            <div className="text-center py-12 text-gray-400">Chargement...</div>
          ) : (
            <div className="space-y-4">
              {(Array.isArray(definitions) ? definitions : []).map((def: any) => (
                <div key={def.id} className="card p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{def.name}</p>
                      {def.description && <p className="text-sm text-gray-500 mt-1">{def.description}</p>}
                    </div>
                    <span className={`badge text-xs ${def.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {def.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                  {def.steps && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {def.steps.map((step: any, i: number) => (
                        <div key={i} className="flex items-center gap-1">
                          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                            {step.step_name || step.name}
                          </span>
                          {i < def.steps.length - 1 && <span className="text-gray-300">→</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 text-xs text-gray-400">
                    {def.steps?.length || 0} étapes · {def.used_count || 0} utilisations
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
