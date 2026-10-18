"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/event-types", label: "Types d'événements" },
  { href: "/availability", label: "Disponibilités" },
  { href: "/bookings", label: "Réunions" },
];

export function SideNav({ publicHref }: { publicHref: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Navigation principale" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {LINKS.map((l) => {
        const active = path === l.href || path.startsWith(l.href + "/");
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold ${active ? "bg-accent-subtle text-text" : "text-muted hover:bg-surface"}`}>
            {l.label}
          </Link>
        );
      })}
      <Link href={publicHref} className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted hover:bg-surface md:mt-4">
        Voir ma page publique
      </Link>
    </nav>
  );
}
