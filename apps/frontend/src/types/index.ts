export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  status: string;
  language: string;
  avatar?: string;
  permissions: string[];
  twoFactorEnabled: boolean;
  lastLoginAt?: string;
  loginCount: number;
  createdAt: string;
}

export type UserRole =
  | 'SUPER_ADMIN' | 'ADMINISTRATOR' | 'SENIOR_NOTARY' | 'ASSISTANT_NOTARY'
  | 'LEGAL_ASSISTANT' | 'RECEPTIONIST' | 'ACCOUNTANT' | 'CASHIER'
  | 'ARCHIVIST' | 'CLIENT' | 'BANK_OFFICER' | 'REAL_ESTATE_AGENT'
  | 'COURT_OFFICER' | 'GOVERNMENT_OFFICER';

export interface Client {
  id: string;
  clientNumber: string;
  type: ClientType;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country: string;
  nationalIdNumber?: string;
  kycStatus: string;
  riskLevel: string;
  riskScore: number;
  pepStatus: boolean;
  isActive: boolean;
  createdAt: string;
  _count?: { dossiers: number; appointments: number };
}

export type ClientType = 'INDIVIDUAL' | 'COMPANY' | 'GOVERNMENT' | 'BANK' | 'LAWYER' | 'REAL_ESTATE' | 'COURT' | 'OTHER';

export interface Dossier {
  id: string;
  dossierNumber: string;
  title: string;
  type: DossierType;
  status: DossierStatus;
  description?: string;
  assignedNotary?: { id: string; firstName: string; lastName: string; avatar?: string };
  clients: DossierClient[];
  estimatedValue?: number;
  notaryFees?: number;
  totalAmount?: number;
  openedAt: string;
  deadlineAt?: string;
  completedAt?: string;
  priority: string;
  riskLevel: string;
  riskScore: number;
  aiSummary?: string;
  tags: string[];
  _count?: { documents: number; tasks: number };
}

export type DossierType =
  | 'SALE' | 'MORTGAGE' | 'INHERITANCE' | 'COMPANY_INCORPORATION'
  | 'DONATION' | 'LEASE' | 'MARRIAGE_CONTRACT' | 'POWER_OF_ATTORNEY'
  | 'AFFIDAVIT' | 'CERTIFICATION' | 'LOAN_AGREEMENT' | 'LAND_TRANSFER'
  | 'DISSOLUTION' | 'OTHER';

export type DossierStatus =
  | 'DRAFT' | 'ACTIVE' | 'PENDING_DOCUMENTS' | 'PENDING_SIGNATURE'
  | 'PENDING_PAYMENT' | 'PENDING_REGISTRATION' | 'COMPLETED' | 'ARCHIVED' | 'CANCELLED';

export interface DossierClient {
  id: string;
  role: string;
  client: Client;
}

export interface Document {
  id: string;
  documentNumber: string;
  title: string;
  type: string;
  status: string;
  language: string;
  version: number;
  createdAt: string;
  signedAt?: string;
  dossier?: { id: string; dossierNumber: string; title: string };
}

export interface Appointment {
  id: string;
  title: string;
  type: string;
  status: string;
  startTime: string;
  endTime: string;
  duration: number;
  location?: string;
  isVirtual: boolean;
  meetingLink?: string;
  notary: User;
  client?: Client;
  dossier?: Dossier;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignee?: User;
  dossier?: { dossierNumber: string; title: string };
  dueDate?: string;
  completedAt?: string;
  estimatedHours?: number;
  actualHours?: number;
  tags: string[];
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  client: Client;
  dossier?: { dossierNumber: string; title: string };
  status: string;
  subtotal: number;
  total: number;
  paid: number;
  balance: number;
  currency: string;
  issueDate: string;
  dueDate?: string;
  paidAt?: string;
}

export interface DashboardStats {
  overview: {
    totalClients: number;
    totalDossiers: number;
    activeDossiers: number;
    totalDocuments: number;
    upcomingAppointments: number;
    pendingTasks: number;
    newClientsThisMonth: number;
    completedDossiers: number;
  };
  financial: {
    revenueThisMonth: number;
    revenueThisYear: number;
  };
  dossiersByStatus: Array<{ status: string; _count: { status: number } }>;
  dossiersByType: Array<{ type: string; _count: { type: number } }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
