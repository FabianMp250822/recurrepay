
import AppLayout from '@/components/layout/app-layout';
import { fetchFinancingSettingsAction } from '@/app/actions/settingsActions';
import { FinancingSettingsForm } from '@/components/settings/FinancingSettingsForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AppFinancingSettings } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button'; // Importar Button
import { testMercadoPagoPreferenceCreation } from '@/app/actions/mercadopagoTestActions'; // Importar la acción de prueba
import { useToast } from '@/hooks/use-toast'; // Para mostrar notificaciones

// Componente wrapper para usar hooks de cliente como useToast
function TestMercadoPagoButton() {
  'use client'; // Marcar este componente como de cliente
  const { toast } = useToast();

  const handleTestMercadoPago = async () => {
    toast({ title: "Iniciando prueba de Mercado Pago...", description: "Revisa la consola del servidor para el resultado." });
    const result = await testMercadoPagoPreferenceCreation();
    if (result.success) {
      toast({
        title: "Prueba de Mercado Pago Exitosa",
        description: `Preferencia creada: ${result.preferenceId}. Init Point: ${result.init_point}`,
        duration: 9000,
      });
    } else {
      toast({
        title: "Error en Prueba de Mercado Pago",
        description: result.error || "Ocurrió un error desconocido.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button onClick={handleTestMercadoPago} variant="outline" className="mt-4">
      Probar Conexión Mercado Pago (Crear Preferencia)
    </Button>
  );
}


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
        
        <Card>
          <CardHeader>
            <CardTitle>Pruebas de Integración</CardTitle>
          </CardHeader>
          <CardContent>
            <TestMercadoPagoButton />
            <p className="text-xs text-muted-foreground mt-2">
              Este botón intentará crear una preferencia de pago de prueba usando tus credenciales de prueba de Mercado Pago.
              El resultado se mostrará en la consola de tu servidor Next.js y como una notificación.
            </p>
          </CardContent>
        </Card>

      </div>
    </AppLayout>
  );
}
