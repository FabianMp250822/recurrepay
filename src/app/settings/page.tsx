
'use client'; 

import React, { useState, useEffect, useTransition } from 'react';
import AppLayout from '@/components/layout/app-layout';
import { 
  fetchFinancingSettingsAction, 
  fetchGeneralSettingsAction,
  triggerManualReminderDispatchAction // Importar la nueva acción
} from '@/app/actions/settingsActions';
import { FinancingSettingsForm } from '@/components/settings/FinancingSettingsForm';
import { GeneralSettingsForm } from '@/components/settings/GeneralSettingsForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AppFinancingSettings, AppGeneralSettings } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';


export default function SettingsPage() { 
  const [financingSettings, setFinancingSettings] = useState<AppFinancingSettings | null>(null);
  const [generalSettings, setGeneralSettings] = useState<AppGeneralSettings | null>(null);
  const [errorLoading, setErrorLoading] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [appName, setAppName] = useState('Configuración'); 
  const { toast } = useToast();
  const [isDispatching, startDispatchTransition] = useTransition();

  useEffect(() => {
    async function loadAllSettings() {
      setIsLoading(true);
      setErrorLoading(null);
      try {
        const [fetchedFinancingSettings, fetchedGeneralSettings] = await Promise.all([
          fetchFinancingSettingsAction(),
          fetchGeneralSettingsAction()
        ]);
        setFinancingSettings(fetchedFinancingSettings);
        setGeneralSettings(fetchedGeneralSettings);
        if (fetchedGeneralSettings && fetchedGeneralSettings.appName) {
          setAppName(fetchedGeneralSettings.appName);
        }
      } catch (error) {
        console.error("Error fetching settings for SettingsPage:", error);
        setErrorLoading(error instanceof Error ? error.message : "Ocurrió un error desconocido al cargar la configuración.");
        setAppName('Error de Configuración');
      } finally {
        setIsLoading(false);
      }
    }
    loadAllSettings();
  }, []);

  const handleManualReminderDispatch = () => {
    startDispatchTransition(async () => {
      toast({
        title: "Procesando...",
        description: "Ejecutando la función de envío de recordatorios.",
      });
      const result = await triggerManualReminderDispatchAction();
      if (result.success) {
        toast({
          title: "Éxito",
          description: result.message,
          duration: 5000,
        });
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
          duration: 7000,
        });
      }
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Configuración de {appName}</CardTitle>
            <CardDescription>
              Ajuste los parámetros clave, la identidad y las preferencias de la plataforma.
            </CardDescription>
          </CardHeader>
        </Card>

        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Cargando configuración...</p>
          </div>
        )}

        {errorLoading && !isLoading && (
          <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error al Cargar Configuración</AlertTitle>
            <AlertDescription>{errorLoading}</AlertDescription>
          </Alert>
        )}

        {!isLoading && generalSettings && (
          <GeneralSettingsForm currentSettings={generalSettings} />
        )}
        
        <Separator />

        {!isLoading && financingSettings && (
          <FinancingSettingsForm currentSettings={financingSettings} />
        )}

        <Separator />

        {!isLoading && (
          <Card>
            <CardHeader>
              <CardTitle>Acciones del Sistema</CardTitle>
              <CardDescription>
                Ejecute tareas administrativas manualmente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleManualReminderDispatch} 
                disabled={isDispatching}
              >
                {isDispatching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Despachar Recordatorios Manualmente
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Esto invocará la función programada para enviar recordatorios de pago a los clientes elegibles.
              </p>
            </CardContent>
          </Card>
        )}
        
      </div>
    </AppLayout>
  );
}
