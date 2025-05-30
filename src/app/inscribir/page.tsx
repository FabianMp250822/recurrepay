
'use client';

import { ClientSelfRegistrationForm } from '@/components/public/client-self-registration-form';
import { Suspense, useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function ClientSelfRegistrationPage() {
  const [currentYear, setCurrentYear] = useState<string>('');

  useEffect(() => {
    setCurrentYear(new Date().getFullYear().toString());
  }, []);

  return (
    <div className="min-h-screen bg-muted/40 py-8 px-4 flex flex-col items-center justify-center">
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center h-screen">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-2">Cargando formulario...</p>
        </div>
      }>
        <ClientSelfRegistrationForm />
      </Suspense>
      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>
          &copy; {currentYear || new Date().getFullYear() /* Fallback for SSR, client will update */} Todos los derechos reservados.
        </p>
        {/* <p>Powered by RecurPay</p>  // Considerar si mostrar esto o el appName */}
      </footer>
    </div>
  );
}
