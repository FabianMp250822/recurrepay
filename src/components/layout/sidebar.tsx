
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Users, LogOut, CreditCard, BarChart3, SettingsIcon, Loader2, Link as LinkIconLucide } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import React, { useEffect, useState } from 'react';
import { fetchGeneralSettingsAction } from '@/app/actions/settingsActions';
import type { AppGeneralSettings } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';


const mainNavItems = [
  { href: '/dashboard', label: 'Panel de Analíticas', icon: BarChart3 },
  { href: '/clients', label: 'Clientes', icon: Users },
  // { href: '/clients/new', label: 'Agregar Cliente', icon: Users },
];

const settingsNavItem = { href: '/settings', label: 'Configuración', icon: SettingsIcon };

export function AppSidebar() {
  const pathname = usePathname();
  const { user, isAdmin, logout, initialLoadComplete } = useAuth();
  const [appName, setAppName] = useState('RecurPay');
  const [appLogoUrl, setAppLogoUrl] = useState<string | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function loadGeneralSettings() {
      if (initialLoadComplete && isAdmin && user) {
        setIsLoadingSettings(true);
        try {
          const settings: AppGeneralSettings = await fetchGeneralSettingsAction();
          if (settings) {
            setAppName(settings.appName || 'RecurPay');
            setAppLogoUrl(settings.appLogoUrl || null);
          }
        } catch (error) {
          console.error("Error fetching general settings for sidebar:", error);
          setAppName('RecurPay');
          setAppLogoUrl(null);
        } finally {
          setIsLoadingSettings(false);
        }
      } else if (initialLoadComplete) {
        setAppName('RecurPay');
        setAppLogoUrl(null);
        setIsLoadingSettings(false);
      }
    }
    loadGeneralSettings();
  }, [isAdmin, user, initialLoadComplete]);

  const handleSendLinkFormClick = () => {
    if (typeof window !== "undefined") {
      const registrationLink = `${window.location.origin}/inscribir`;
      navigator.clipboard.writeText(registrationLink)
        .then(() => {
          toast({
            title: "Enlace Copiado",
            description: "El enlace de auto-inscripción de cliente ha sido copiado al portapapeles. Puede compartirlo por WhatsApp o correo.",
          });
        })
        .catch(err => {
          console.error("Error al copiar el enlace: ", err);
          toast({
            title: "Error al Copiar",
            description: "No se pudo copiar el enlace. Puede copiarlo manualmente: " + registrationLink,
            variant: "destructive",
            duration: 7000,
          });
        });
    }
  };

  if (!initialLoadComplete || !isAdmin || !user) {
    return null;
  }

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 border-r bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-10">
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-lg text-sidebar-primary">
          {isLoadingSettings ? (
            <>
              <Skeleton className="h-8 w-8 rounded-sm bg-sidebar-accent/50" />
              <Skeleton className="h-5 w-24 bg-sidebar-accent/50" />
            </>
          ) : appLogoUrl ? (
            <Image src={appLogoUrl} alt={appName} width={120} height={32} className="h-8 w-auto max-w-[180px] object-contain" unoptimized />
          ) : (
            <>
              <CreditCard className="h-6 w-6 text-primary" />
              <span>{appName}</span>
            </>
          )}
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {mainNavItems.map((item) => {
          const isActive = pathname.startsWith(item.href) && (item.href !== '/' || pathname === '/');
          return (
            <Button
              key={item.href}
              variant={isActive ? 'secondary' : 'ghost'}
              className={cn(
                "w-full justify-start",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              asChild
            >
              <Link href={item.href}>
                <item.icon className="mr-3 h-5 w-5" />
                {item.label}
              </Link>
            </Button>
          );
        })}

        {/* Botón para Enviar Link de Inscripción */}
        <Button
          variant={'ghost'}
          className={cn(
            "w-full justify-start",
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
          onClick={handleSendLinkFormClick}
        >
          <LinkIconLucide className="mr-3 h-5 w-5" />
          Enviar Link Inscripción
        </Button>

        {/* Enlace de Configuración */}
        <Button
          key={settingsNavItem.href}
          variant={pathname.startsWith(settingsNavItem.href) ? 'secondary' : 'ghost'}
          className={cn(
            "w-full justify-start",
            pathname.startsWith(settingsNavItem.href)
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
          asChild
        >
          <Link href={settingsNavItem.href}>
            <settingsNavItem.icon className="mr-3 h-5 w-5" />
            {settingsNavItem.label}
          </Link>
        </Button>

      </nav>
      <div className="mt-auto p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src="https://placehold.co/40x40.png" alt="Avatar de Usuario" data-ai-hint="user avatar" />
            <AvatarFallback>{user?.email ? user.email.substring(0,2).toUpperCase() : 'AD'}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium truncate" title={user?.email || 'Usuario Administrador'}>{user?.email || 'Usuario Administrador'}</p>
            <p className="text-xs text-muted-foreground">Administrador</p>
          </div>
        </div>
        <Button variant="ghost" className="w-full justify-start mt-3 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={logout}>
          <LogOut className="mr-3 h-5 w-5" />
          Cerrar Sesión
        </Button>
      </div>
    </aside>
  );
}
