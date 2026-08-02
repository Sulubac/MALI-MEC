'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUIStore, useAuthStore } from '@/store';
import {
  LayoutDashboard, Users, FolderOpen, FileText, Calendar,
  Home, CheckSquare, DollarSign, Bot, BarChart3, Settings,
  Scale, LogOut, ChevronLeft, ChevronRight, Bell, Search
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const navigation = [
  { name: 'Tableau de Bord', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Clients', href: '/dashboard/clients', icon: Users },
  { name: 'Dossiers', href: '/dashboard/dossiers', icon: FolderOpen },
  { name: 'Documents', href: '/dashboard/documents', icon: FileText },
  { name: 'Rendez-vous', href: '/dashboard/appointments', icon: Calendar },
  { name: 'Propriétés', href: '/dashboard/properties', icon: Home },
  { name: 'Tâches', href: '/dashboard/tasks', icon: CheckSquare },
  { name: 'Comptabilité', href: '/dashboard/accounting', icon: DollarSign },
  { name: 'Assistant IA', href: '/dashboard/ai-assistant', icon: Bot },
  { name: 'Rapports', href: '/dashboard/reports', icon: BarChart3 },
  { name: 'Paramètres', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebarCollapsed } = useUIStore();
  const { user } = useAuthStore();
  const { logout } = useAuth();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full bg-slate-900 text-white flex flex-col transition-all duration-300 z-40',
        sidebarCollapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center h-16 px-4 border-b border-white/10',
        sidebarCollapsed ? 'justify-center' : 'gap-3',
      )}>
        <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-lg flex-shrink-0">
          <Scale className="w-5 h-5 text-white" />
        </div>
        {!sidebarCollapsed && (
          <div>
            <p className="font-bold text-sm leading-tight">NotaryOS</p>
            <p className="text-xs text-white/50">Djibouti</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : 'text-white/60 hover:text-white hover:bg-white/10',
                    sidebarCollapsed && 'justify-center px-2',
                  )}
                  title={sidebarCollapsed ? item.name : undefined}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span>{item.name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User & Collapse */}
      <div className="border-t border-white/10 p-2 space-y-1">
        {!sidebarCollapsed && user && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">
              {user.firstName?.[0]}{user.lastName?.[0]}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-white/50 truncate">{user.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => logout()}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-red-500/20 transition-all w-full',
            sidebarCollapsed && 'justify-center px-2',
          )}
          title="Déconnexion"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!sidebarCollapsed && 'Déconnexion'}
        </button>
        <button
          onClick={toggleSidebarCollapsed}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/40 hover:text-white hover:bg-white/10 transition-all w-full',
            sidebarCollapsed && 'justify-center px-2',
          )}
        >
          {sidebarCollapsed
            ? <ChevronRight className="w-4 h-4" />
            : <><ChevronLeft className="w-4 h-4" /><span>Réduire</span></>
          }
        </button>
      </div>
    </aside>
  );
}
