'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Shield, Archive, Eye, EyeOff, Globe } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const schema = z.object({
  username: z.string().min(1, 'Nom d\'utilisateur requis'),
  password: z.string().min(1, 'Mot de passe requis'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await authApi.login(data.username, data.password);
      const { access_token, refresh_token, user } = res.data;
      login(user, access_token, refresh_token);
      toast.success(`Bienvenue, ${user.full_name}!`);
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Erreur de connexion';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-header flex-col items-center justify-center p-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 border border-white rounded-full" />
          <div className="absolute bottom-10 right-10 w-96 h-96 border border-white rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-white rounded-full" />
        </div>

        <div className="relative z-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="p-4 bg-white/20 rounded-2xl">
              <Archive className="w-12 h-12 text-white" />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-white mb-4">PNGA</h1>
          <h2 className="text-xl text-white/90 mb-3">
            Plateforme Nationale de<br />Gestion des Archives
          </h2>
          <p className="text-white/70 text-lg mb-2">منصة الأرشيف الوطني الرقمي</p>
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className="w-6 h-4 rounded-sm overflow-hidden flex flex-col">
              <div className="flex-1 bg-sky-400" />
              <div className="flex-1 bg-green-500" />
            </div>
            <p className="text-white/80 font-medium">République de Djibouti</p>
          </div>

          <div className="mt-16 grid grid-cols-3 gap-6 text-center">
            {[
              { label: 'Documents', value: '100M+' },
              { label: 'Institutions', value: '200+' },
              { label: 'Conformité', value: 'ISO' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/10 rounded-xl p-4">
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-white/60 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-3 mb-8">
            <div className="p-3 bg-primary-600 rounded-xl">
              <Archive className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary-900">PNGA</h1>
              <p className="text-xs text-slate-500">Archives Nationales</p>
            </div>
          </div>

          <div className="card p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Connexion</h2>
              <p className="text-slate-500 mt-1">Accédez à la plateforme nationale des archives</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="label">Nom d'utilisateur ou Email</label>
                <input
                  {...register('username')}
                  type="text"
                  placeholder="admin ou admin@archives.gouv.dj"
                  className="input"
                  autoComplete="username"
                />
                {errors.username && (
                  <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>
                )}
              </div>

              <div>
                <label className="label">Mot de passe</label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="input pr-11"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-slate-300 text-primary-600" />
                  <span className="text-sm text-slate-600">Se souvenir de moi</span>
                </label>
                <a href="#" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                  Mot de passe oublié ?
                </a>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-3 text-base"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Connexion en cours...
                  </div>
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    Se connecter
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs font-semibold text-blue-800 mb-2">Comptes de démonstration:</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-blue-700">
                  <span className="font-mono">admin</span>
                  <span className="font-mono">Pnga@Djibouti2024!</span>
                </div>
                <div className="flex justify-between text-xs text-blue-700">
                  <span className="font-mono">archiviste</span>
                  <span className="font-mono">Archiviste@2024!</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-4 text-xs text-slate-400">
            <span>ISO 15489</span>
            <span>·</span>
            <span>ISO 14721</span>
            <span>·</span>
            <span>ISO 27001</span>
            <span>·</span>
            <span>MoReq2010</span>
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Globe className="w-3.5 h-3.5" />
            <span>Djibouti · République de Djibouti · جمهورية جيبوتي</span>
          </div>
        </div>
      </div>
    </div>
  );
}
