'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Search, Menu, X, Moon, Sun, LogOut, User } from 'lucide-react';
import { useAuthStore, useUIStore } from '@/lib/store';
import { Sidebar } from './Sidebar';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { authApi } from '@/lib/api';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { sidebarOpen, setSidebarOpen, theme, toggleTheme } = useUIStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {}
    logout();
    router.push('/login');
    toast.success('Déconnexion réussie');
  };

  if (!isAuthenticated || !user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-30 transition-all duration-300 ease-in-out',
          sidebarOpen ? 'w-64' : 'w-0 overflow-hidden',
          'lg:relative lg:flex-shrink-0'
        )}
        style={{ width: sidebarOpen ? '256px' : '0' }}
      >
        <div className="h-full w-64">
          <Sidebar />
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Search bar */}
          <div className="flex-1 max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="search"
                placeholder="Rechercher dans les archives..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const q = (e.target as HTMLInputElement).value;
                    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q)}`);
                  }
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              title="Changer le thème"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            <button className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            <div className="flex items-center gap-2 pl-2 ml-1 border-l border-slate-200">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-primary-700">
                  {user.full_name.charAt(0)}
                </span>
              </div>
              <div className="hidden md:block text-sm">
                <p className="font-semibold text-slate-800 leading-none">{user.full_name.split(' ')[0]}</p>
                <p className="text-xs text-slate-500 mt-0.5">{user.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors ml-1"
                title="Déconnexion"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
