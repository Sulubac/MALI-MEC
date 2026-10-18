import type { ReactNode } from "react";
import { SideNav } from "@/components/SideNav";
import { Button } from "@/components/ui";
import { logoutAction } from "@/app/actions";
import { requireHost } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { host } = await requireHost();
  return (
    <div className="mx-auto flex min-h-screen max-w-content flex-col md:flex-row">
      <aside className="flex flex-col border-b border-border bg-surface p-3 md:w-[var(--sidebar-width)] md:shrink-0 md:border-b-0 md:border-r md:p-4">
        <p className="mb-3 px-3 text-lg font-semibold">Planifier</p>
        <SideNav publicHref={`/${host.username}`} />
        <form action={logoutAction} className="mt-3 px-1 md:mt-auto md:pt-6">
          <Button type="submit" variant="ghost" size="sm">Se déconnecter</Button>
        </form>
      </aside>
      <main id="contenu" className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
