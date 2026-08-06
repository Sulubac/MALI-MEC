'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import {
  Users, Plus, Search, Shield, Lock, Unlock, Trash2,
  CheckCircle, XCircle, Edit3
} from 'lucide-react';
import toast from 'react-hot-toast';

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  super_admin: { label: 'Super Admin', color: 'bg-red-100 text-red-700' },
  national_archivist: { label: 'Archiviste National', color: 'bg-purple-100 text-purple-700' },
  ministry_admin: { label: 'Admin Ministère', color: 'bg-blue-100 text-blue-700' },
  archivist: { label: 'Archiviste', color: 'bg-green-100 text-green-700' },
  validator: { label: 'Validateur', color: 'bg-cyan-100 text-cyan-700' },
  digitizer: { label: 'Numériseur', color: 'bg-yellow-100 text-yellow-700' },
  reader: { label: 'Lecteur', color: 'bg-gray-100 text-gray-600' },
  citizen: { label: 'Citoyen', color: 'bg-orange-100 text-orange-700' },
};

const ROLES = Object.keys(ROLE_CONFIG);

function UserRow({ user, onToggle, onDelete }: { user: any; onToggle: (id: string, active: boolean) => void; onDelete: (id: string) => void }) {
  const role = ROLE_CONFIG[user.primary_role] || { label: user.primary_role, color: 'bg-gray-100 text-gray-600' };

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-sm shrink-0">
            {(user.full_name || user.username || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">{user.full_name || user.username}</p>
            {user.full_name_ar && <p className="text-xs text-gray-400 font-arabic" dir="rtl">{user.full_name_ar}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{user.username}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
      <td className="px-4 py-3">
        <span className={`badge text-xs ${role.color}`}>{role.label}</span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{user.institution_name || '—'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {user.is_active
            ? <CheckCircle size={16} className="text-green-500" />
            : <XCircle size={16} className="text-red-400" />
          }
          {user.two_factor_enabled && <Shield size={14} className="text-blue-500" title="2FA activé" />}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">
        {user.last_login ? new Date(user.last_login).toLocaleDateString('fr-FR') : 'Jamais'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggle(user.id, user.is_active)}
            className={`p-1.5 rounded transition-colors ${user.is_active ? 'hover:bg-red-50 text-red-500' : 'hover:bg-green-50 text-green-500'}`}
            title={user.is_active ? 'Désactiver' : 'Activer'}
          >
            {user.is_active ? <Lock size={14} /> : <Unlock size={14} />}
          </button>
          <button
            onClick={() => onDelete(user.id)}
            className="p-1.5 rounded hover:bg-red-50 text-red-400 transition-colors"
            title="Supprimer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', full_name: '', password: '', primary_role: 'reader', institution_id: '' });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list({ limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => usersApi.create(data),
    onSuccess: () => {
      toast.success('Utilisateur créé');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowCreate(false);
      setForm({ username: '', email: '', full_name: '', password: '', primary_role: 'reader', institution_id: '' });
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Erreur lors de la création'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      usersApi.update(id, { is_active: !active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      toast.success('Utilisateur supprimé');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  const users = data?.data || data?.users || data || [];
  const filtered = (Array.isArray(users) ? users : []).filter((u: any) => {
    const matchSearch = !search || [u.username, u.email, u.full_name].some(f => f?.toLowerCase().includes(search.toLowerCase()));
    const matchRole = !roleFilter || u.primary_role === roleFilter;
    return matchSearch && matchRole;
  });

  const roleStats = ROLES.reduce((acc, role) => {
    acc[role] = (Array.isArray(users) ? users : []).filter((u: any) => u.primary_role === role).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
            <Users size={20} className="text-primary-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Gestion des utilisateurs</h1>
            <p className="text-gray-500 text-sm">{(Array.isArray(users) ? users : []).length} utilisateurs enregistrés</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nouvel utilisateur
        </button>
      </div>

      {/* Role stats chips */}
      <div className="flex flex-wrap gap-2">
        {ROLES.filter(r => roleStats[r] > 0).map(role => {
          const cfg = ROLE_CONFIG[role];
          return (
            <button
              key={role}
              onClick={() => setRoleFilter(roleFilter === role ? '' : role)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                roleFilter === role ? cfg.color + ' ring-2 ring-offset-1 ring-current' : cfg.color
              }`}
            >
              {cfg.label} ({roleStats[role]})
            </button>
          );
        })}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <h3 className="font-semibold text-gray-900 mb-4">Créer un utilisateur</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Nom d'utilisateur *</label>
                  <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="input w-full" />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input w-full" />
                </div>
              </div>
              <div>
                <label className="label">Nom complet</label>
                <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="input w-full" />
              </div>
              <div>
                <label className="label">Mot de passe *</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="input w-full" />
              </div>
              <div>
                <label className="label">Rôle</label>
                <select value={form.primary_role} onChange={e => setForm({ ...form, primary_role: e.target.value })} className="input w-full">
                  {ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_CONFIG[r]?.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.username || !form.email || !form.password || createMutation.isPending}
                className="btn-primary flex-1"
              >
                {createMutation.isPending ? 'Création...' : 'Créer'}
              </button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 flex gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, email, username..."
            className="input w-full pl-9"
          />
        </div>
        <span className="text-sm text-gray-500 flex items-center">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Nom</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Username</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Rôle</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Institution</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Dernière connexion</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400">Aucun utilisateur trouvé</td>
                  </tr>
                ) : (
                  filtered.map((u: any) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      onToggle={(id, active) => toggleMutation.mutate({ id, active })}
                      onDelete={(id) => {
                        if (confirm('Supprimer cet utilisateur ?')) deleteMutation.mutate(id);
                      }}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
