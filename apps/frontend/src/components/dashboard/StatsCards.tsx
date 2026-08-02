'use client';

import { DashboardStats } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Users, FolderOpen, FileText, TrendingUp, Calendar, CheckSquare, UserPlus, Award } from 'lucide-react';

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: 'Clients Actifs',
      value: stats.overview.totalClients.toLocaleString('fr'),
      icon: Users,
      color: 'blue',
      sub: `+${stats.overview.newClientsThisMonth} ce mois`,
      subIcon: UserPlus,
    },
    {
      title: 'Dossiers Actifs',
      value: stats.overview.activeDossiers.toLocaleString('fr'),
      icon: FolderOpen,
      color: 'purple',
      sub: `${stats.overview.totalDossiers} total`,
    },
    {
      title: 'Documents',
      value: stats.overview.totalDocuments.toLocaleString('fr'),
      icon: FileText,
      color: 'indigo',
      sub: 'Tous types',
    },
    {
      title: 'Revenus ce Mois',
      value: formatCurrency(stats.financial.revenueThisMonth),
      icon: TrendingUp,
      color: 'green',
      sub: `${formatCurrency(stats.financial.revenueThisYear)} cette année`,
    },
    {
      title: 'Rendez-vous',
      value: stats.overview.upcomingAppointments.toLocaleString('fr'),
      icon: Calendar,
      color: 'orange',
      sub: 'A venir',
    },
    {
      title: 'Tâches Pending',
      value: stats.overview.pendingTasks.toLocaleString('fr'),
      icon: CheckSquare,
      color: 'red',
      sub: 'En cours',
    },
    {
      title: 'Complétés',
      value: stats.overview.completedDossiers.toLocaleString('fr'),
      icon: Award,
      color: 'teal',
      sub: 'Ce mois',
    },
  ];

  const colorMap = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
    teal: 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400',
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
      {cards.map((card) => (
        <div key={card.title} className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow">
          <div className={`inline-flex p-2 rounded-lg mb-3 ${colorMap[card.color as keyof typeof colorMap]}`}>
            <card.icon className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-foreground">{card.value}</p>
          <p className="text-xs font-medium text-muted-foreground mt-1">{card.title}</p>
          {card.sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{card.sub}</p>}
        </div>
      ))}
    </div>
  );
}
