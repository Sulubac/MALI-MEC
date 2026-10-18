import type { ReactNode } from "react";
import { SideNav } from "@/components/SideNav";
import { getCurrentHost } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const host = getCurrentHost();
  return (
    <div className="mx-auto flex min-h-screen max-w-content flex-col md:flex-row">
      <aside className="border-b border-border bg-surface p-3 md:w-[var(--sidebar-width)] md:shrink-0 md:border-b-0 md:border-r md:p-4">
        <p className="mb-3 px-3 text-lg font-semibold">Planifier</p>
        <SideNav publicHref={`/${host.username}`} />
      </aside>
      <main id="contenu" className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
