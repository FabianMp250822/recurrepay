
import AppLayout from '@/components/layout/app-layout';
import { fetchFinancingSettingsAction } from '@/app/actions/settingsActions';
import { FinancingSettingsForm } from '@/components/settings/FinancingSettingsForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AppFinancingSettings } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';

export default async function SettingsPage() {
  let financingSettings: AppFinancingSettings | null = null;
  let errorLoadingSettings: string | null = null;

  try {
    financingSettings = await fetchFinancingSettingsAction();
  } catch (error) {
    console.error("Error fetching settings for SettingsPage:", error);
    errorLoadingSettings = error instanceof Error ? error.message : "Ocurrió un error desconocido al cargar la configuración.";
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Configuración General</CardTitle>
            <CardDescription>
              Ajuste los parámetros clave de la aplicación RecurPay.
            </CardDescription>
          </CardHeader>
        </Card>

        {errorLoadingSettings && (
          <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error al Cargar Configuración</AlertTitle>
            <AlertDescription>{errorLoadingSettings}</AlertDescription>
          </Alert>
        )}

        {financingSettings && (
          <FinancingSettingsForm currentSettings={financingSettings} />
        )}
        
        {/* Aquí se pueden añadir más tarjetas de configuración en el futuro */}
        {/* Por ejemplo: Datos de la Empresa, Plantillas de Correo, etc. */}

      </div>
    </AppLayout>
  );
}
