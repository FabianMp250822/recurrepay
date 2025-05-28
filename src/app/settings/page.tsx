
'use client'; // Ensure this is at the very top

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/app-layout';
import { fetchFinancingSettingsAction } from '@/app/actions/settingsActions';
import { FinancingSettingsForm } from '@/components/settings/FinancingSettingsForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AppFinancingSettings } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Loader2 } from 'lucide-react';
// Mercado Pago related imports removed
// import { Button } from '@/components/ui/button';
// import { testMercadoPagoPreferenceCreation } from '@/app/actions/mercadopagoTestActions';
// import { useToast } from '@/hooks/use-toast';
// import { CreditCard } from 'lucide-react';
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
//   TableCaption,
// } from "@/components/ui/table";


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
        
        {/* Mercado Pago Integration Test Section Removed */}

      </div>
    </AppLayout>
  );
}
