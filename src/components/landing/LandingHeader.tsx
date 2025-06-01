
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, CreditCard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import React, { useEffect, useState } from 'react';
import { fetchGeneralSettingsAction } from '@/app/actions/settingsActions';
import type { AppGeneralSettings } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';


const navLinks = [
  { href: '#features', label: 'Características' },
  // { href: '#pricing', label: 'Precios' }, // Placeholder
  // { href: '#contact', label: 'Contacto' }, // Placeholder
];

export default function LandingHeader() {
  const { user, isAdmin, initialLoadComplete } = useAuth(); // Get auth state
  const [appName, setAppName] = useState('RecurPay');
  const [appLogoUrl, setAppLogoUrl] = useState<string | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      setIsLoadingSettings(true);
      try {
        const settings: AppGeneralSettings = await fetchGeneralSettingsAction();
        if (settings) {
          setAppName(settings.appName || 'RecurPay');
          setAppLogoUrl(settings.appLogoUrl || null);
        }
      } catch (error) {
        console.error("Error fetching app name/logo for landing header:", error);
      } finally {
        setIsLoadingSettings(false);
      }
    }
    loadSettings();
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          {isLoadingSettings ? (
            <>
              <Skeleton className="h-7 w-7 rounded-sm bg-muted" />
              <Skeleton className="h-5 w-24 bg-muted" />
            </>
          ) : appLogoUrl ? (
             <Image src={appLogoUrl} alt={appName} width={120} height={30} className="h-8 w-auto max-w-[150px] object-contain" unoptimized/>
          ) : (
            <>
              <CreditCard className="h-6 w-6 text-primary" />
              <span>{appName}</span>
            </>
          )}
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {initialLoadComplete && user ? (
             <Button asChild variant="outline">
              <Link href={isAdmin ? "/dashboard" : "/client-dashboard"}>Ir al Panel</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/login">Iniciar Sesión</Link>
              </Button>
              <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/inscribir">Registrarse</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Abrir menú</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <nav className="grid gap-4 py-6">
                <Link href="/" className="flex items-center gap-2 font-bold text-lg mb-4">
                 {isLoadingSettings ? ( <Skeleton className="h-5 w-28 bg-muted" /> )
                    : appLogoUrl ? ( <Image src={appLogoUrl} alt={appName} width={120} height={30} />)
                    : ( <><CreditCard className="h-6 w-6 text-primary" /><span>{appName}</span></> )
                  }
                </Link>
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="text-muted-foreground hover:text-primary"
                  >
                    {link.label}
                  </Link>
                ))}
                <hr className="my-2"/>
                 {initialLoadComplete && user ? (
                    <Button asChild variant="outline" className="w-full">
                        <Link href={isAdmin ? "/dashboard" : "/client-dashboard"}>Ir al Panel</Link>
                    </Button>
                 ) : (
                    <>
                        <Button asChild variant="ghost" className="w-full justify-start">
                            <Link href="/login">Iniciar Sesión</Link>
                        </Button>
                        <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                            <Link href="/inscribir">Registrarse</Link>
                        </Button>
                    </>
                 )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
