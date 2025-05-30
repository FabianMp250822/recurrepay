
'use client';
import React from 'react';
import { AppSidebar } from './sidebar';
import { AppHeader } from './header';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading, initialLoadComplete } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    // Si la carga inicial de autenticación ha terminado,
    // Y (no hay usuario O el usuario no es admin),
    // Y no estamos en /login NI en /inscribir,
    // entonces redirigir a /login.
    if (initialLoadComplete && (!user || !isAdmin) && pathname !== '/login' && pathname !== '/inscribir') {
      router.replace('/login');
    }
  }, [user, isAdmin, initialLoadComplete, pathname, router]);

  if (!initialLoadComplete || loading) {
    // Mostrar un spinner de carga para todo el layout si el estado de autenticación aún se está cargando,
    // a menos que esté en la página de login o inscripción, que tienen sus propios cargadores o no necesitan este.
    if (pathname !== '/login' && pathname !== '/inscribir') {
        return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
        );
    }
  }
  
  // Si está en la página de login o inscripción, renderizar solo el contenido de esas páginas
  // sin el AppLayout (sidebar/header de admin).
  if (pathname === '/login' || pathname === '/inscribir') {
    return <>{children}</>;
  }

  // Si el usuario está autenticado como admin, renderizar el layout completo de la aplicación.
  if (user && isAdmin) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <AppSidebar />
        <div className="flex flex-col sm:gap-4 sm:py-4 lg:pl-64"> {/* Ajustado pl para el ancho del sidebar */}
          <AppHeader />
          <main className="flex-1 p-4 sm:px-6 sm:py-0 md:gap-8">
            {children}
          </main>
        </div>
      </div>
    );
  }

  // Fallback para casos límite o mientras se redirige, si no es login o inscribir
  if (pathname !== '/login' && pathname !== '/inscribir') {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
        );
  }
  return null; // Debería ser redirigido o mostrar el contenido de login/inscribir
}
