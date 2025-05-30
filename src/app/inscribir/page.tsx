
import { ClientSelfRegistrationForm } from '@/components/public/client-self-registration-form';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
// Podríamos querer cargar el nombre de la app aquí también para el título de la página
// import { getGeneralSettings } from '@/lib/store';

// export async function generateMetadata() {
//   const settings = await getGeneralSettings();
//   return {
//     title: `Inscripción de Cliente - ${settings.appName || 'RecurPay'}`,
//   };
// }

export default function ClientSelfRegistrationPage() {
  return (
    <div className="min-h-screen bg-muted/40 py-8 px-4 flex flex-col items-center justify-center">
      {/* Podríamos añadir un logo pequeño o el nombre de la app aquí si se desea */}
      <Suspense fallback={<div className="flex flex-col items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="mt-2">Cargando formulario...</p></div>}>
        <ClientSelfRegistrationForm />
      </Suspense>
      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Todos los derechos reservados.</p>
        {/* <p>Powered by RecurPay</p>  // Considerar si mostrar esto o el appName */}
      </footer>
    </div>
  );
}

