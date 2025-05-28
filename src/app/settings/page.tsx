
'use client'; 

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/app-layout';
import { fetchFinancingSettingsAction, fetchGeneralSettingsAction } from '@/app/actions/settingsActions';
import { FinancingSettingsForm } from '@/components/settings/FinancingSettingsForm';
import { GeneralSettingsForm } from '@/components/settings/GeneralSettingsForm'; // New form
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AppFinancingSettings, AppGeneralSettings } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Loader2 } from 'lucide-react';


export default function SettingsPage() { 
  const [financingSettings, setFinancingSettings] = useState<AppFinancingSettings | null>(null);
  const [generalSettings, setGeneralSettings] = useState<AppGeneralSettings | null>(null);
  const [errorLoading, setErrorLoading] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      } catch (error) {
        console.error("Error fetching settings for SettingsPage:", error);
        setErrorLoading(error instanceof Error ? error.message : "Ocurrió un error desconocido al cargar la configuración.");
      } finally {
        setIsLoading(false);
      }
    }
    loadAllSettings();
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Configuración General de RecurPay</CardTitle>
            <CardDescription>
              Ajuste los parámetros clave, la identidad y las preferencias de la aplicación.
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

        {!isLoading && financingSettings && (
          <FinancingSettingsForm currentSettings={financingSettings} />
        )}
        
      </div>
    </AppLayout>
  );
}
