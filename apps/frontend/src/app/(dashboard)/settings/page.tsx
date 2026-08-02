'use client';
import { Header } from '@/components/layout/Header';

export default function SettingsPage() {
  return (
    <>
      <Header title="Settings" />
      <div className="p-6">
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-muted-foreground">Module Settings - En cours de développement</p>
        </div>
      </div>
    </>
  );
}
