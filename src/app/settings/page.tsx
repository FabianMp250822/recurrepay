
'use client'; // Ensure this is at the very top

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/app-layout';
import { fetchFinancingSettingsAction } from '@/app/actions/settingsActions';
import { FinancingSettingsForm } from '@/components/settings/FinancingSettingsForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AppFinancingSettings } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { testMercadoPagoPreferenceCreation } from '@/app/actions/mercadopagoTestActions';
import { useToast } from '@/hooks/use-toast';

// TestMercadoPagoButton remains a client component, which is correct
function TestMercadoPagoButton() {
  const { toast } = useToast(); // This is now fine as SettingsPage will be a client component

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

export default function SettingsPage() { // Removed 'async'
  const [financingSettings, setFinancingSettings] = useState<AppFinancingSettings | null>(null);
  const [errorLoadingSettings, setErrorLoadingSettings] = useState<string | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      setIsLoadingSettings(true);
      setErrorLoadingSettings(null);
      try {
        const settings = await fetchFinancingSettingsAction();
        setFinancingSettings(settings);
      } catch (error) {
        console.error("Error fetching settings for SettingsPage:", error);
        setErrorLoadingSettings(error instanceof Error ? error.message : "Ocurrió un error desconocido al cargar la configuración.");
      } finally {
        setIsLoadingSettings(false);
      }
    }
    loadSettings();
  }, []);

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

        {isLoadingSettings && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Cargando configuración...</p>
          </div>
        )}

        {errorLoadingSettings && !isLoadingSettings && (
          <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error al Cargar Configuración</AlertTitle>
            <AlertDescription>{errorLoadingSettings}</AlertDescription>
          </Alert>
        )}

        {!isLoadingSettings && financingSettings && (
          <FinancingSettingsForm currentSettings={financingSettings} />
        )}
        
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
