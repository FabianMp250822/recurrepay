
'use client'; // Ensure this is at the very top

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/app-layout';
import { fetchFinancingSettingsAction } from '@/app/actions/settingsActions';
import { FinancingSettingsForm } from '@/components/settings/FinancingSettingsForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AppFinancingSettings } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Loader2, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { testMercadoPagoPreferenceCreation } from '@/app/actions/mercadopagoTestActions';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";

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
        duration: 9000,
      });
    }
  };

  return (
    <Button onClick={handleTestMercadoPago} variant="outline" className="mt-4">
      Probar Conexión Mercado Pago (Crear Preferencia)
    </Button>
  );
}

const testCards = [
  { brand: "Mastercard", number: "5254 1336 7440 3564", cvv: "123", expiry: "11/30" },
  { brand: "Visa", number: "4013 5406 8274 6260", cvv: "123", expiry: "11/30" },
  { brand: "American Express", number: "3743 781877 55283", cvv: "1234", expiry: "11/30" },
  { brand: "Visa Debito", number: "4915 1120 5524 6507", cvv: "123", expiry: "11/30" },
];

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
            <CardTitle>Pruebas de Integración Mercado Pago</CardTitle>
            <CardDescription>
              Utilice el botón para probar la creación de una preferencia de pago con sus credenciales de prueba.
              Consulte la tabla de tarjetas de prueba para simular pagos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TestMercadoPagoButton />
            <p className="text-xs text-muted-foreground mt-2">
              Este botón intentará crear una preferencia de pago de prueba usando tus credenciales de prueba de Mercado Pago.
              El resultado se mostrará en la consola de tu servidor Next.js y como una notificación.
            </p>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <CreditCard className="mr-2 h-5 w-5" />
                  Tarjetas de Prueba Mercado Pago
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableCaption>Estas son tarjetas de prueba proporcionadas por Mercado Pago para el entorno de sandbox.</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarjeta</TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead className="text-center">CVV</TableHead>
                      <TableHead className="text-right">Vencimiento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {testCards.map((card) => (
                      <TableRow key={card.number}>
                        <TableCell className="font-medium">{card.brand}</TableCell>
                        <TableCell>{card.number}</TableCell>
                        <TableCell className="text-center">{card.cvv}</TableCell>
                        <TableCell className="text-right">{card.expiry}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

      </div>
    </AppLayout>
  );
}
