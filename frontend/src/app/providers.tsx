'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#161627',
              color: '#e2e8f0',
              border: '1px solid #252540',
              borderRadius: '8px',
            },
            success: {
              iconTheme: { primary: '#6272f3', secondary: '#161627' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#161627' },
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
