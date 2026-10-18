import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <main id="contenu" className="mx-auto min-h-screen max-w-booking px-4 py-8 md:py-12">{children}</main>;
}
