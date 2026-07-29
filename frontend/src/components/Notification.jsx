import React from 'react';
import { CheckCircle, XCircle, Info } from 'lucide-react';
import useStore from '../store/useStore';

export default function Notification() {
  const { notification } = useStore();
  if (!notification) return null;

  const icons = { success: CheckCircle, error: XCircle, info: Info };
  const colors = {
    success: 'bg-emerald-900/90 border-emerald-700 text-emerald-100',
    error: 'bg-red-900/90 border-red-700 text-red-100',
    info: 'bg-blue-900/90 border-blue-700 text-blue-100',
  };
  const Icon = icons[notification.type] || Info;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4">
      <div className={`flex items-center gap-2.5 px-5 py-3 rounded-xl border text-sm font-medium shadow-xl ${colors[notification.type]}`}>
        <Icon size={16} />
        {notification.message}
      </div>
    </div>
  );
}
