import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../styles/tokens.css";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: { default: "Planifier", template: "%s · Planifier" },
  description: "Partagez un lien, laissez les autres réserver un créneau libre.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded-md focus:bg-bg focus:px-3 focus:py-2">
          Aller au contenu
        </a>
        {children}
      </body>
    </html>
  );
}
