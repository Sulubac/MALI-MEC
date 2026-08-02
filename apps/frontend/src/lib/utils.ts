import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, fmt = 'dd/MM/yyyy') {
  return format(new Date(date), fmt, { locale: fr });
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: fr });
}

export function timeAgo(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr });
}

export function formatCurrency(amount: number, currency = 'DJF') {
  return new Intl.NumberFormat('fr-DJ', {
    style: 'currency',
    currency: currency === 'DJF' ? 'DJF' : currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getInitials(firstName?: string, lastName?: string) {
  if (!firstName && !lastName) return 'N/A';
  return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase();
}

export const DOSSIER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  ACTIVE: 'Actif',
  PENDING_DOCUMENTS: 'En attente de documents',
  PENDING_SIGNATURE: 'En attente de signature',
  PENDING_PAYMENT: 'En attente de paiement',
  PENDING_REGISTRATION: 'En attente d\'enregistrement',
  COMPLETED: 'Complété',
  ARCHIVED: 'Archivé',
  CANCELLED: 'Annulé',
};

export const DOSSIER_TYPE_LABELS: Record<string, string> = {
  SALE: 'Vente Immobilière',
  MORTGAGE: 'Hypothèque',
  INHERITANCE: 'Succession',
  COMPANY_INCORPORATION: 'Création de Société',
  DONATION: 'Donation',
  LEASE: 'Bail',
  MARRIAGE_CONTRACT: 'Contrat de Mariage',
  POWER_OF_ATTORNEY: 'Procuration',
  AFFIDAVIT: 'Déclaration sous serment',
  CERTIFICATION: 'Certification',
  LOAN_AGREEMENT: 'Contrat de Prêt',
  LAND_TRANSFER: 'Transfert Foncier',
  DISSOLUTION: 'Dissolution',
  OTHER: 'Autre',
};

export const RISK_LEVEL_COLORS: Record<string, string> = {
  LOW: 'text-green-600 bg-green-50',
  MEDIUM: 'text-yellow-600 bg-yellow-50',
  HIGH: 'text-orange-600 bg-orange-50',
  CRITICAL: 'text-red-600 bg-red-50',
};

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'text-gray-600 bg-gray-100',
  ACTIVE: 'text-blue-600 bg-blue-100',
  PENDING_DOCUMENTS: 'text-yellow-600 bg-yellow-100',
  PENDING_SIGNATURE: 'text-orange-600 bg-orange-100',
  PENDING_PAYMENT: 'text-red-600 bg-red-100',
  COMPLETED: 'text-green-600 bg-green-100',
  ARCHIVED: 'text-gray-500 bg-gray-100',
  CANCELLED: 'text-red-500 bg-red-50',
};
