'use client';

import './globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        retry: 1,
      },
    },
  }));

  return (
    <html lang="fr">
      <head>
        <title>PNGA - Plateforme Nationale de Gestion des Archives</title>
        <meta name="description" content="Plateforme Nationale de Gestion des Archives de la République de Djibouti" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </head>
      <body className="antialiased">
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { background: '#1e293b', color: '#f8fafc', borderRadius: '8px' },
              success: { iconTheme: { primary: '#22c55e', secondary: '#f8fafc' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#f8fafc' } },
            }}
          />
        </QueryClientProvider>
      </body>
    </html>
  );
}
