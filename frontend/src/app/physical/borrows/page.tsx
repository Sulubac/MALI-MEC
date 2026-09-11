'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { physicalApi } from '@/lib/api';
import { BookOpen, Plus, RotateCcw, Calendar, User, AlertTriangle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BorrowsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ box_id: '', borrower_name: '', borrower_email: '', borrower_institution: '', purpose: '', expected_return_date: '' });
  const queryClient = useQueryClient();

  const { data: borrows, isLoading } = useQuery({
    queryKey: ['borrows'],
    queryFn: () => physicalApi.listBorrows ? physicalApi.listBorrows() : Promise.resolve([]),
  });

  const { data: boxesData } = useQuery({
    queryKey: ['physical-boxes'],
    queryFn: () => physicalApi.listBoxes(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => physicalApi.createBorrow(data),
    onSuccess: () => {
      toast.success('Emprunt enregistré');
      queryClient.invalidateQueries({ queryKey: ['borrows'] });
      setShowCreate(false);
      setForm({ box_id: '', borrower_name: '', borrower_email: '', borrower_institution: '', purpose: '', expected_return_date: '' });
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement'),
  });

  const returnMutation = useMutation({
    mutationFn: (borrowId: string) => physicalApi.returnBorrow(borrowId),
    onSuccess: () => {
      toast.success('Retour enregistré');
      queryClient.invalidateQueries({ queryKey: ['borrows'] });
    },
    onError: () => toast.error('Erreur lors du retour'),
  });

  const borrowList = borrows?.data || borrows?.borrows || borrows || [];
  const boxes = boxesData?.data || boxesData?.boxes || boxesData || [];

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
            <BookOpen size={20} className="text-primary-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Emprunts de boîtes</h1>
            <p className="text-gray-500 text-sm">Suivi des emprunts et retours</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nouvel emprunt
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <h3 className="font-semibold text-gray-900 mb-4">Enregistrer un emprunt</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Boîte *</label>
                <select value={form.box_id} onChange={e => setForm({ ...form, box_id: e.target.value })} className="input w-full">
                  <option value="">Sélectionner...</option>
                  {(Array.isArray(boxes) ? boxes : [])
                    .filter((b: any) => b.status === 'in_place')
                    .map((box: any) => (
                    <option key={box.id} value={box.id}>{box.barcode} – {box.label || 'Sans libellé'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Nom de l'emprunteur *</label>
                <input value={form.borrower_name} onChange={e => setForm({ ...form, borrower_name: e.target.value })} className="input w-full" placeholder="Prénom Nom" />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" value={form.borrower_email} onChange={e => setForm({ ...form, borrower_email: e.target.value })} className="input w-full" />
              </div>
              <div>
                <label className="label">Institution</label>
                <input value={form.borrower_institution} onChange={e => setForm({ ...form, borrower_institution: e.target.value })} className="input w-full" />
              </div>
              <div>
                <label className="label">Objet de l'emprunt</label>
                <textarea value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} className="input w-full" rows={2} placeholder="Motif..." />
              </div>
              <div>
                <label className="label">Date de retour prévue *</label>
                <input type="date" min={today} value={form.expected_return_date} onChange={e => setForm({ ...form, expected_return_date: e.target.value })} className="input w-full" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.box_id || !form.borrower_name || !form.expected_return_date || createMutation.isPending}
                className="btn-primary flex-1"
              >
                {createMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Borrows table */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : (Array.isArray(borrowList) ? borrowList : []).length === 0 ? (
        <div className="text-center py-16 card">
          <BookOpen size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Aucun emprunt en cours</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Boîte</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Emprunteur</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Date emprunt</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Retour prévu</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(Array.isArray(borrowList) ? borrowList : []).map((borrow: any) => {
                  const isOverdue = borrow.expected_return_date && new Date(borrow.expected_return_date) < new Date() && borrow.status !== 'returned';
                  return (
                    <tr key={borrow.id} className={`hover:bg-gray-50 transition-colors ${isOverdue ? 'bg-red-50/50' : ''}`}>
                      <td className="px-4 py-3">
                        <code className="font-mono text-primary-600 font-bold text-xs">{borrow.box_barcode}</code>
                        {borrow.box_label && <p className="text-xs text-gray-500 mt-0.5">{borrow.box_label}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-gray-400 shrink-0" />
                          <div>
                            <p className="text-gray-900 font-medium">{borrow.borrower_name}</p>
                            {borrow.borrower_institution && <p className="text-xs text-gray-500">{borrow.borrower_institution}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          {borrow.borrow_date ? new Date(borrow.borrow_date).toLocaleDateString('fr-FR') : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                          {isOverdue && <AlertTriangle size={12} />}
                          {borrow.expected_return_date ? new Date(borrow.expected_return_date).toLocaleDateString('fr-FR') : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {borrow.status === 'returned' ? (
                          <span className="badge text-xs bg-green-100 text-green-700 flex items-center gap-1 w-fit">
                            <CheckCircle size={12} /> Retourné
                          </span>
                        ) : isOverdue ? (
                          <span className="badge text-xs bg-red-100 text-red-700 flex items-center gap-1 w-fit">
                            <AlertTriangle size={12} /> En retard
                          </span>
                        ) : (
                          <span className="badge text-xs bg-blue-100 text-blue-700 w-fit">En cours</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {borrow.status !== 'returned' && (
                          <button
                            onClick={() => returnMutation.mutate(borrow.id)}
                            disabled={returnMutation.isPending}
                            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <RotateCcw size={12} /> Retour
                          </button>
                        )}
                      </td>
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
