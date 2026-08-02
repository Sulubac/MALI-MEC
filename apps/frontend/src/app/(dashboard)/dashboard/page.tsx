'use client';

import { useQuery } from '@tanstack/react-query';
import { reportsApi, dossiersApi, appointmentsApi } from '@/lib/api';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { RecentDossiers } from '@/components/dashboard/RecentDossiers';
import { Header } from '@/components/layout/Header';
import { Loader2, Calendar, Clock, TrendingUp } from 'lucide-react';
import { useAuthStore } from '@/store';
import { formatCurrency } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: reportsApi.getDashboard,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: recentDossiers } = useQuery({
    queryKey: ['dossiers', 'recent'],
    queryFn: () => dossiersApi.getAll({ page: 1, limit: 6 }),
  });

  const { data: upcoming } = useQuery({
    queryKey: ['appointments', 'upcoming'],
    queryFn: () => appointmentsApi.getUpcoming(5),
  });

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <>
      <Header title="Tableau de Bord" subtitle={`${greeting}, ${user?.firstName || ''}`} />
      <div className="p-6 space-y-6">
        {stats && <StatsCards stats={stats} />}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RecentDossiers dossiers={recentDossiers?.data || []} />
          </div>

          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
                <Calendar className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold text-sm">Prochains RDV</h3>
              </div>
              <div className="p-2">
                {(upcoming || []).length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-6">Aucun rendez-vous</p>
                ) : (
                  (upcoming || []).map((appt: any) => (
                    <div key={appt.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-shrink-0 w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex flex-col items-center justify-center">
                        <span className="text-xs font-bold text-blue-600">
                          {new Date(appt.startTime).getDate()}
                        </span>
                        <span className="text-xs text-blue-400">
                          {new Date(appt.startTime).toLocaleString('fr', { month: 'short' })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{appt.title}</p>
                        {appt.client && (
                          <p className="text-xs text-muted-foreground truncate">
                            {appt.client.firstName} {appt.client.lastName}
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {new Date(appt.startTime).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {stats && (
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <h3 className="font-semibold text-sm">Finances</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Ce mois</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(stats.financial.revenueThisMonth)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Cette année</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(stats.financial.revenueThisYear)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
