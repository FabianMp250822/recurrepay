'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { AppSidebar } from './sidebar';
import { AppHeader } from './header';
import { Loader2 } from 'lucide-react';

const PUBLIC_PATHS = ['/login', '/inscribir'];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, userRole, loading, initialLoadComplete } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Si es una ruta pública, renderizar sin layout
  if (PUBLIC_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  // Si es una ruta de cliente, redirigir al panel de cliente
  if (pathname.startsWith('/client-dashboard') && userRole !== 'client') {
    if (initialLoadComplete) {
      if (userRole === 'admin') {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Mostrar loader mientras se verifica la autenticación
  if ((!initialLoadComplete || loading) && !PUBLIC_PATHS.includes(pathname)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Redirigir usuarios no autenticados o sin rol definido
  React.useEffect(() => {
    if (initialLoadComplete && (!user || !userRole) && !PUBLIC_PATHS.includes(pathname)) {
      router.replace('/login');
    }
  }, [initialLoadComplete, user, userRole, pathname, router]);

  // Si es administrador, mostrar layout completo de admin
  if (user && userRole === 'admin' && !PUBLIC_PATHS.includes(pathname)) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <AppSidebar />
        <div className="flex flex-col sm:gap-4 sm:py-4 lg:pl-64">
          <AppHeader />
          <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
            {children}
          </main>
        </div>
      </div>
    );
  }

  // Si es cliente, no mostrar este layout (usará ClientLayout)
  if (userRole === 'client') {
    return <>{children}</>;
  }

  // Para otros casos, mostrar solo el contenido
  return <>{children}</>;
}
