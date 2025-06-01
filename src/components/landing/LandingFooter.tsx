
'use client';

import Link from 'next/link';
import { CreditCard, Facebook, Twitter, Linkedin, Instagram } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { fetchGeneralSettingsAction } from '@/app/actions/settingsActions';
import type { AppGeneralSettings } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function LandingFooter() {
  const [currentYear, setCurrentYear] = useState<string>('');
  const [appName, setAppName] = useState('RecurPay');
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);


  useEffect(() => {
    setCurrentYear(new Date().getFullYear().toString());
    async function loadSettings() {
      setIsLoadingSettings(true);
      try {
        const settings: AppGeneralSettings = await fetchGeneralSettingsAction();
        if (settings && settings.appName) {
          setAppName(settings.appName);
        }
      } catch (error) {
        console.error("Error fetching app name for landing footer:", error);
      } finally {
        setIsLoadingSettings(false);
      }
    }
    loadSettings();
  }, []);

  return (
    <footer className="bg-muted/50 border-t">
      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <Link href="/" className="flex items-center gap-2 font-bold text-xl mb-4">
               {isLoadingSettings ? <Skeleton className="h-6 w-32 bg-muted-foreground/20" /> : (
                <>
                  <CreditCard className="h-7 w-7 text-primary" />
                  <span>{appName}</span>
                </>
              )}
            </Link>
            <p className="text-muted-foreground text-sm">
              Simplificando la gestión de pagos recurrentes para tu negocio.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Enlaces Rápidos</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="#features" className="text-muted-foreground hover:text-primary">Características</Link></li>
              <li><Link href="/inscribir" className="text-muted-foreground hover:text-primary">Registrarse</Link></li>
              <li><Link href="/login" className="text-muted-foreground hover:text-primary">Iniciar Sesión</Link></li>
              {/* <li><Link href="#" className="text-muted-foreground hover:text-primary">Política de Privacidad</Link></li> */}
              {/* <li><Link href="#" className="text-muted-foreground hover:text-primary">Términos de Servicio</Link></li> */}
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Contacto</h3>
             <p className="text-muted-foreground text-sm">
              {/* email@example.com <br /> */}
              {/* +1 234 567 8900 <br /> */}
              {/* Bogotá, Colombia */}
            </p>
            <div className="flex space-x-4 mt-4">
              {/* <Link href="#" className="text-muted-foreground hover:text-primary"><Facebook size={20} /></Link> */}
              {/* <Link href="#" className="text-muted-foreground hover:text-primary"><Twitter size={20} /></Link> */}
              {/* <Link href="#" className="text-muted-foreground hover:text-primary"><Linkedin size={20} /></Link> */}
              {/* <Link href="#" className="text-muted-foreground hover:text-primary"><Instagram size={20} /></Link> */}
            </div>
          </div>
        </div>
        <div className="mt-10 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>&copy; {currentYear || new Date().getFullYear()} {appName}. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
