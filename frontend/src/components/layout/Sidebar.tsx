'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard, FileText, Search, Building2, Workflow,
  Archive, BarChart3, Map, Users, Settings, BookOpen,
  Upload, Shield, Database, Globe, ChevronDown, ChevronRight,
  FolderTree, Package
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/lib/store';

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  children?: NavItem[];
  badge?: string | number;
  roles?: string[];
}

const navItems: NavItem[] = [
  { label: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
  {
    label: 'Documents',
    icon: FileText,
    children: [
      { label: 'Tous les documents', href: '/documents', icon: FileText },
      { label: 'Importer', href: '/documents/upload', icon: Upload },
      { label: 'En attente', href: '/documents/pending', icon: FileText },
      { label: 'Archivés', href: '/documents/archived', icon: Archive },
    ],
  },
  { label: 'Recherche', href: '/search', icon: Search },
  {
    label: 'Institutions',
    icon: Building2,
    children: [
      { label: 'Liste', href: '/institutions', icon: Building2 },
      { label: 'Arborescence', href: '/institutions/tree', icon: FolderTree },
    ],
  },
  { label: 'Workflows', href: '/workflows', icon: Workflow },
  {
    label: 'Plan de classement',
    href: '/classification',
    icon: FolderTree,
  },
  {
    label: 'Archives Physiques',
    icon: Package,
    children: [
      { label: 'Dépôts', href: '/physical/locations', icon: Map },
      { label: 'Boîtes', href: '/physical/boxes', icon: Package },
      { label: 'Emprunts', href: '/physical/borrows', icon: Archive },
    ],
  },
  {
    label: 'Rapports',
    icon: BarChart3,
    children: [
      { label: 'KPIs Nationaux', href: '/reports/kpis', icon: BarChart3 },
      { label: 'Cartographie', href: '/reports/geographic', icon: Map },
      { label: 'Journal d\'audit', href: '/reports/audit', icon: Shield },
    ],
  },
  {
    label: 'Administration',
    icon: Settings,
    roles: ['super_admin', 'national_archivist', 'ministry_admin'],
    children: [
      { label: 'Utilisateurs', href: '/admin/users', icon: Users },
      { label: 'Système', href: '/admin/system', icon: Database },
    ],
  },
  { label: 'Portail Citoyen', href: '/citizen', icon: Globe },
];

function NavItemComponent({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(
    item.children?.some(c => c.href && pathname.startsWith(c.href)) || false
  );

  if (item.children) {
    const isActive = item.children.some(c => c.href && pathname.startsWith(c.href));
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={clsx(
            'sidebar-item w-full justify-between',
            isActive && 'text-primary-700 bg-primary-50/50'
          )}
        >
          <span className="flex items-center gap-3">
            <item.icon className="w-5 h-5 shrink-0" />
            <span>{item.label}</span>
          </span>
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {expanded && (
          <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-slate-100 pl-3">
            {item.children.map((child) => (
              <NavItemComponent key={child.href} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isActive = item.href ? pathname === item.href || pathname.startsWith(item.href + '/') : false;

  return (
    <Link href={item.href || '#'}>
      <div className={clsx('sidebar-item', isActive && 'active')}>
        <item.icon className="w-5 h-5 shrink-0" />
        <span className="flex-1">{item.label}</span>
        {item.badge && (
          <span className="ml-auto bg-primary-600 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
            {item.badge}
          </span>
        )}
      </div>
    </Link>
  );
}

export function Sidebar() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shrink-0">
            <Archive className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-primary-900 truncate">PNGA</h1>
            <p className="text-xs text-slate-500 truncate">Archives Nationales</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          if (item.roles && user && !item.roles.includes(user.role) && !user.is_superuser) {
            return null;
          }
          return <NavItemComponent key={item.label} item={item} />;
        })}
      </nav>

      {/* User info */}
      {user && (
        <div className="px-3 py-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
            <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-primary-700">
                {user.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 truncate">{user.full_name}</p>
              <p className="text-xs text-slate-500 truncate">{user.role}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
