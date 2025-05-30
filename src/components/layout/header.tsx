
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { CreditCard, Menu, Users, LogOut, BarChart3, SettingsIcon, Loader2, Link as LinkIconLucide } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import React, { useEffect, useState } from 'react';
import { fetchGeneralSettingsAction } from '@/app/actions/settingsActions';
import type { AppGeneralSettings } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const mainNavItems = [
  { href: '/dashboard', label: 'Panel de Analíticas', icon: BarChart3 },
  { href: '/clients', label: 'Clientes', icon: Users },
];

const settingsNavItem = { href: '/settings', label: 'Configuración', icon: SettingsIcon };


export function AppHeader() {
  const pathname = usePathname();
  const { user, isAdmin, logout, loading, initialLoadComplete } = useAuth();
  const { toast } = useToast();

  const [headerAppName, setHeaderAppName] = useState('RecurPay');
  const [headerAppLogoUrl, setHeaderAppLogoUrl] = useState<string | null>(null);
  const [isLoadingHeaderSettings, setIsLoadingHeaderSettings] = useState(true);

  useEffect(() => {
    async function loadHeaderGeneralSettings() {
      if (initialLoadComplete && isAdmin && user) {
        setIsLoadingHeaderSettings(true);
        try {
          const settings: AppGeneralSettings = await fetchGeneralSettingsAction();
          if (settings) {
            setHeaderAppName(settings.appName || 'RecurPay');
            setHeaderAppLogoUrl(settings.appLogoUrl || null);
          }
        } catch (error) {
          console.error("Error fetching general settings for header:", error);
          setHeaderAppName('RecurPay');
          setHeaderAppLogoUrl(null);
        } finally {
          setIsLoadingHeaderSettings(false);
        }
      } else if (initialLoadComplete) {
        setHeaderAppName('RecurPay');
        setHeaderAppLogoUrl(null);
        setIsLoadingHeaderSettings(false);
      }
    }
    loadHeaderGeneralSettings();
  }, [isAdmin, user, initialLoadComplete]);

  const getPageTitle = () => {
    const allNavItems = [...mainNavItems, settingsNavItem];
    const currentNavItem = allNavItems.find(item => pathname.startsWith(item.href) && (item.href !== '/' || pathname === '/'));
    
    if (currentNavItem) return currentNavItem.label;
    if (pathname.startsWith('/clients/new')) return 'Crear Nuevo Cliente';
    if (pathname.match(/^\/clients\/[^/]+\/edit$/)) return 'Editar Cliente';
    if (pathname.startsWith('/login')) return 'Inicio de Sesión';
    if (pathname.startsWith('/inscribir')) return 'Inscripción de Cliente';
    
    return isLoadingHeaderSettings ? 'Cargando...' : headerAppName;
  };

  const handleSendLinkFormClick = () => {
    if (typeof window !== "undefined") {
      const registrationLink = `${window.location.origin}/inscribir`;
      navigator.clipboard.writeText(registrationLink)
        .then(() => {
          toast({
            title: "Enlace Copiado",
            description: "El enlace de auto-inscripción de cliente ha sido copiado al portapapeles.",
          });
        })
        .catch(err => {
          console.error("Error al copiar el enlace: ", err);
          toast({
            title: "Error al Copiar",
            description: "No se pudo copiar el enlace. Puede copiarlo manually: " + registrationLink,
            variant: "destructive",
            duration: 7000,
          });
        });
    }
  };
  
  if (!initialLoadComplete || (!isAdmin && pathname !== '/login' && pathname !== '/inscribir')) {
    if (loading && pathname !== '/login' && pathname !== '/inscribir') return null; 
    if (!isAdmin && pathname !== '/login' && pathname !== '/inscribir') return null; 
  }


  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-4">
      {/* Solo mostrar SheetTrigger si el usuario es admin y no está en /login o /inscribir */}
      {isAdmin && user && pathname !== '/login' && pathname !== '/inscribir' && ( 
        <Sheet>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline" className="lg:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Alternar Menú</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="sm:max-w-xs bg-sidebar text-sidebar-foreground">
            <nav className="grid gap-4 text-lg font-medium p-2">
                <SheetClose asChild>
                  <Link
                    href="/dashboard"
                    className="group flex h-10 items-center gap-2 rounded-full bg-primary px-3 py-2 text-lg font-semibold text-primary-foreground md:text-base mb-4"
                  >
                    {isLoadingHeaderSettings ? (
                      <>
                        <Skeleton className="h-6 w-6 rounded-sm bg-background/30" />
                        <Skeleton className="h-4 w-20 bg-background/30 ml-1" />
                      </>
                    ) : headerAppLogoUrl ? (
                      <Image src={headerAppLogoUrl} alt={headerAppName} width={100} height={24} className="h-6 w-auto max-w-[150px] object-contain" unoptimized/>
                    ) : (
                      <>
                        <CreditCard className="h-5 w-5 transition-all group-hover:scale-110" />
                        <span className="text-base">{headerAppName}</span>
                      </>
                    )}
                  </Link>
                </SheetClose>
              {mainNavItems.map((item) => {
                  const isActive = pathname.startsWith(item.href) && (item.href !== '/' || pathname === '/');
                return (
                <SheetClose asChild key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-4 px-2.5 py-2 rounded-lg ${
                      isActive
                        ? 'text-sidebar-accent-foreground bg-sidebar-accent'
                        : 'text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                </SheetClose>
                );
              })}
              {/* Botón para Enviar Link de Inscripción en menú móvil */}
               <SheetClose asChild>
                <Button
                  variant="ghost"
                  onClick={handleSendLinkFormClick}
                  className="flex items-center gap-4 px-2.5 py-2 rounded-lg text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent justify-start"
                >
                  <LinkIconLucide className="h-5 w-5" />
                  Enviar Link Inscripción
                </Button>
              </SheetClose>

              {/* Enlace de Configuración en menú móvil */}
              <SheetClose asChild>
                <Link
                  href={settingsNavItem.href}
                  className={`flex items-center gap-4 px-2.5 py-2 rounded-lg ${
                    pathname.startsWith(settingsNavItem.href)
                      ? 'text-sidebar-accent-foreground bg-sidebar-accent'
                      : 'text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent'
                  }`}
                >
                  <settingsNavItem.icon className="h-5 w-5" />
                  {settingsNavItem.label}
                </Link>
              </SheetClose>

              <SheetClose asChild>
                <Button onClick={logout} variant="ghost" className="flex items-center gap-4 px-2.5 py-2 rounded-lg text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent justify-start">
                    <LogOut className="h-5 w-5" />
                    Cerrar Sesión
                </Button>
              </SheetClose>
            </nav>
          </SheetContent>
        </Sheet>
      )}
      
      <div className="relative ml-auto flex-1 md:grow-0">
        {/* Search can be added later if needed */}
      </div>
       <h1 className="text-xl font-semibold md:text-2xl flex-1 lg:ml-4">{getPageTitle()}</h1>
      
      {/* Solo mostrar DropdownMenu si el usuario es admin y no está en /login o /inscribir */}
      {isAdmin && user && pathname !== '/login' && pathname !== '/inscribir' && ( 
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="overflow-hidden rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src="https://placehold.co/40x40.png" alt="Avatar de Usuario" data-ai-hint="user avatar" />
                <AvatarFallback>{user.email ? user.email.substring(0, 2).toUpperCase() : 'RP'}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user.email || 'Mi Cuenta'}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}
