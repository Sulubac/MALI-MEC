'use client';

import Link from 'next/link';
import { Dossier } from '@/types';
import { formatDate, DOSSIER_STATUS_LABELS, DOSSIER_TYPE_LABELS, STATUS_COLORS } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecentDossiersProps {
  dossiers: Dossier[];
}

export function RecentDossiers({ dossiers }: RecentDossiersProps) {
  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Dossiers Récents</h3>
        <Link href="/dashboard/dossiers" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
          Voir tous <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="divide-y divide-border">
        {dossiers.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">Aucun dossier récent</p>
        ) : (
          dossiers.slice(0, 6).map((dossier) => (
            <Link
              key={dossier.id}
              href={`/dashboard/dossiers/${dossier.id}`}
              className="flex items-center gap-4 px-6 py-4 hover:bg-muted/50 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground truncate group-hover:text-blue-600">
                  {dossier.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {dossier.dossierNumber} • {DOSSIER_TYPE_LABELS[dossier.type] || dossier.type}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  STATUS_COLORS[dossier.status] || 'bg-gray-100 text-gray-600',
                )}>
                  {DOSSIER_STATUS_LABELS[dossier.status] || dossier.status}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(dossier.openedAt)}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
