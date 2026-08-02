'use client';
import { Header } from '@/components/layout/Header';

export default function TasksPage() {
  return (
    <>
      <Header title="Tasks" />
      <div className="p-6">
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-muted-foreground">Module Tasks - En cours de développement</p>
        </div>
      </div>
    </>
  );
}
