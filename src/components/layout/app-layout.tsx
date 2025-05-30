'use client';
import React from 'react';
import { AppSidebar } from './sidebar';
import { AppHeader } from './header';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const PUBLIC_PATHS = ['/login', '/inscribir'];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading, initialLoadComplete } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Si la ruta actual es pública, renderizar solo el contenido sin el layout de admin ni chequeos de auth aquí.
  // AuthContext manejará redirecciones DESDE estas páginas si el usuario YA está logueado como admin.
  if (PUBLIC_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  // Para rutas no públicas, realizar chequeos de autenticación y admin.
  React.useEffect(() => {
    // Solo redirigir si la carga inicial ha completado Y (no hay usuario O no es admin)
    // Y no estamos ya en una ruta pública (aunque este useEffect ya no debería correr para esas).
    if (initialLoadComplete && (!user || !isAdmin) && !PUBLIC_PATHS.includes(pathname)) {
      router.replace('/login');
    }
  }, [user, isAdmin, initialLoadComplete, pathname, router]);

  // Si aún está cargando la info de auth y no es una ruta pública, mostrar loader.
  if ((!initialLoadComplete || loading) && !PUBLIC_PATHS.includes(pathname)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  // Si es una ruta protegida y el usuario es admin, renderizar el layout completo.
  if (user && isAdmin && !PUBLIC_PATHS.includes(pathname)) {
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

  // Fallback para rutas no públicas si el usuario no es admin o no está autenticado.
  // El useEffect ya debería haber redirigido, pero esto es una salvaguarda.
  if (!PUBLIC_PATHS.includes(pathname)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Redirigiendo...</p>
      </div>
    );
  }
  
  return null; // No debería llegar aquí si la lógica es correcta para rutas públicas.
}
