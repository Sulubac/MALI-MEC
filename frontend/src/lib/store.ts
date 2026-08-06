import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies from 'js-cookie';

interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
  institution_id: string | null;
  confidentiality_level: string;
  preferred_language: string;
  is_superuser: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      login: (user, accessToken, refreshToken) => {
        Cookies.set('access_token', accessToken, { secure: true, sameSite: 'strict', expires: 1 });
        Cookies.set('refresh_token', refreshToken, { secure: true, sameSite: 'strict', expires: 30 });
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },
      logout: () => {
        Cookies.remove('access_token');
        Cookies.remove('refresh_token');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },
      updateUser: (userData) =>
        set((state) => ({ user: state.user ? { ...state.user, ...userData } : null })),
    }),
    { name: 'pnga-auth' }
  )
);

interface UIState {
  sidebarOpen: boolean;
  language: 'fr' | 'ar' | 'en';
  theme: 'light' | 'dark';
  setSidebarOpen: (open: boolean) => void;
  setLanguage: (lang: 'fr' | 'ar' | 'en') => void;
  toggleTheme: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      language: 'fr',
      theme: 'light',
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setLanguage: (lang) => set({ language: lang }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
    }),
    { name: 'pnga-ui' }
  )
);
