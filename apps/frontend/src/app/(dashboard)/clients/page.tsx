'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clientsApi } from '@/lib/api';
import { Header } from '@/components/layout/Header';
import { Loader2, Plus, Search, Filter, Users, Building2, Shield } from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
import Link from 'next/link';

const RISK_COLORS: Record<string, string> = {
  LOW: 'bg-green-100 text-green-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const KYC_COLORS: Record<string, string> = {
  VERIFIED: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  REJECTED: 'bg-red-100 text-red-700',
};

export default function ClientsPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['clients', { search, type, page }],
    queryFn: () => clientsApi.getAll({ search: search || undefined, type: type || undefined, page, limit: 20 }),
  });

  return (
    <>
      <Header title="Gestion des Clients" subtitle="Registre clientèle et KYC" />
      <div className="p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher par nom, email, CIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-3 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les types</option>
            <option value="INDIVIDUAL">Particulier</option>
            <option value="COMPANY">Société</option>
            <option value="GOVERNMENT">Gouvernement</option>
            <option value="BANK">Banque</option>
          </select>
          <Link
            href="/dashboard/clients/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau Client
          </Link>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contact</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">KYC</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Risque</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Dossiers</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Créé le</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(data?.data || []).map((client: any) => (
                    <tr key={client.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/clients/${client.id}`} className="group">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                              {client.type === 'INDIVIDUAL'
                                ? <Users className="w-4 h-4 text-blue-600" />
                                : <Building2 className="w-4 h-4 text-blue-600" />
                              }
                            </div>
                            <div>
                              <p className="font-medium text-foreground group-hover:text-blue-600 transition-colors">
                                {client.type === 'INDIVIDUAL'
                                  ? `${client.firstName || ''} ${client.lastName || ''}`
                                  : client.companyName || 'N/A'}
                              </p>
                              <p className="text-xs text-muted-foreground">{client.clientNumber}</p>
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {client.type === 'INDIVIDUAL' ? 'Particulier' : 'Société'}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-foreground">{client.email || '-'}</p>
                        <p className="text-xs text-muted-foreground">{client.phone || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', KYC_COLORS[client.kycStatus] || 'bg-gray-100 text-gray-700')}>
                          {client.kycStatus}
                        </span>
                        {client.pepStatus && (
                          <div className="flex items-center gap-1 mt-1">
                            <Shield className="w-3 h-3 text-orange-500" />
                            <span className="text-xs text-orange-600">PPE</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', RISK_COLORS[client.riskLevel] || 'bg-gray-100 text-gray-700')}>
                          {client.riskLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {client._count?.dossiers || 0}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(client.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  {data.total} clients • Page {data.page}/{data.totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1 rounded border border-border text-sm disabled:opacity-50 hover:bg-muted transition-colors"
                  >
                    Précédent
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                    disabled={page >= data.totalPages}
                    className="px-3 py-1 rounded border border-border text-sm disabled:opacity-50 hover:bg-muted transition-colors"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
