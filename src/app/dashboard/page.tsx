
'use client';

import Link from 'next/link';
import { PlusCircle, Users as UsersIconLucide, FileText, DollarSign, LinkIcon as LinkIconLucide, Loader2, Terminal, Landmark, TrendingUp, CalendarClock, UserX, CreditCard as CreditCardIcon, AlertCircle, LineChart, BarChart3, PieChartIcon } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import AppLayout from '@/components/layout/app-layout';
import { getClients, getGeneralSettings, getFinancingOptionsMap } from '@/lib/store'; // Added getGeneralSettings & getFinancingOptionsMap
import { formatDate, formatCurrency, getDaysUntilDue } from '@/lib/utils';
import type { Client, AppGeneralSettings } from '@/types'; // Added AppGeneralSettings
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { 
  isSameMonth, isSameYear, getMonth, getYear, startOfToday, 
  parseISO, format as formatDateFns, addMonths, subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';

import MonthlyRevenueChart from '@/components/analytics/MonthlyRevenueChart';
import ClientGrowthChart from '@/components/analytics/ClientGrowthChart';
import FinancingPlanDistributionChart from '@/components/analytics/FinancingPlanDistributionChart';
// import { FINANCING_OPTIONS } from '@/lib/constants'; // Will get from DB

export default function AnalyticsDashboardPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAdmin, initialLoadComplete } = useAuth();
  const [appName, setAppName] = useState('RecurPay'); // Default
  const [financingOptions, setFinancingOptions] = useState<{[key: number]: { rate: number; label: string }}>({});


  const fetchDashboardData = useCallback(async () => {
    if (!initialLoadComplete || !isAdmin) {
      if (initialLoadComplete && !isAdmin) {
        setError("Acceso denegado. No tiene permisos para ver esta información.");
      }
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [fetchedClients, generalSettings, finOptions] = await Promise.all([
        getClients(),
        getGeneralSettings(),
        getFinancingOptionsMap(),
      ]);
      setClients(fetchedClients);
      if (generalSettings && generalSettings.appName) {
        setAppName(generalSettings.appName);
      }
      setFinancingOptions(finOptions);

    } catch (err: any) {
      console.error("Error fetching data for dashboard. AuthContext state: ", { userUid: user?.uid, isAdminContext: isAdmin, initialLoadCompleteContext: initialLoadComplete }, err);
      const detailedError = err.message || 'Error al cargar los datos del panel. Por favor, inténtelo de nuevo.';
      setError(detailedError.includes("permission denied") || detailedError.includes("Permiso denegado") ? "Permiso denegado por Firestore al buscar datos. Asegúrese de que las reglas de seguridad de Firebase permitan el acceso de lectura requerido y que su cuenta de administrador esté configurada correctamente." : detailedError);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, user?.uid, initialLoadComplete]);

  useEffect(() => {
    if (initialLoadComplete) {
      if (isAdmin) {
        fetchDashboardData();
      } else {
        setError("Acceso denegado. No es un administrador autorizado.");
        setIsLoading(false);
        setClients([]);
      }
    }
  }, [initialLoadComplete, isAdmin, fetchDashboardData]);

  const statistics = useMemo(() => {
    if (!clients || clients.length === 0) {
      return {
        totalPendingCollection: 0,
        estimatedTaxes: 0,
        currentMonthProjection: 0,
        currentYearProjection: 0,
        clientsInArrearsCount: 0,
        totalOverdueAmount: 0,
        totalContractValue: 0,
        totalDownPayments: 0,
        totalFinancedAmount: 0,
        totalFinancingInterest: 0,
        totalProjectedRevenue: 0,
      };
    }

    const today = startOfToday();
    // const currentMonth = getMonth(today); // Not directly used in this calculation logic
    // const currentYear = getYear(today); // Not directly used in this calculation logic

    let totalPendingCollection = 0;
    let estimatedTaxes = 0;
    let currentMonthProjection = 0;
    let currentYearProjection = 0;
    let clientsInArrearsCount = 0;
    let totalOverdueAmount = 0;
    let totalContractValue = 0;
    let totalDownPayments = 0;
    let totalFinancedAmount = 0;
    let totalFinancingInterest = 0;
    let totalProjectedRevenue = 0;


    clients.forEach(client => {
      if (client.paymentAmount > 0 && client.status !== 'completed') {
        totalPendingCollection += client.paymentAmount; 

        const nextPaymentDate = parseISO(client.nextPaymentDate);
        if (isSameMonth(nextPaymentDate, today) && isSameYear(nextPaymentDate, today)) {
          currentMonthProjection += client.paymentAmount;
        }
        if (isSameYear(nextPaymentDate, today)) {
          currentYearProjection += client.paymentAmount;
        }

        if (getDaysUntilDue(client.nextPaymentDate) < 0) {
          clientsInArrearsCount++;
          totalOverdueAmount += client.paymentAmount;
        }
      }

      if (client.contractValue && client.contractValue > 0) {
        totalContractValue += client.contractValue;
        if (client.ivaAmount) {
          estimatedTaxes += client.ivaAmount;
        }
        if (client.downPayment) {
          totalDownPayments += client.downPayment;
        }
        if(client.amountToFinance) {
            totalFinancedAmount += client.amountToFinance;
        }
        if(client.financingInterestAmount) {
            totalFinancingInterest += client.financingInterestAmount;
        }
        if(client.totalAmountWithInterest && client.financingPlan && client.financingPlan > 0) {
            totalProjectedRevenue += (client.downPayment || 0) + client.totalAmountWithInterest;
        } else if (client.totalWithIva) { // Contract value but no financing (e.g. single payment)
            totalProjectedRevenue += client.totalWithIva;
        }
      }
    });

    return {
      totalPendingCollection,
      estimatedTaxes,
      currentMonthProjection,
      currentYearProjection,
      clientsInArrearsCount,
      totalOverdueAmount,
      totalContractValue,
      totalDownPayments,
      totalFinancedAmount,
      totalFinancingInterest,
      totalProjectedRevenue,
    };
  }, [clients]);

  const monthlyRevenueData = useMemo(() => {
    if (!clients) return [];
    const data: { month: string; revenue: number }[] = [];
    const today = new Date();
    
    for (let i = 0; i < 6; i++) { 
      const targetMonthDate = addMonths(today, i);
      const monthName = formatDateFns(targetMonthDate, 'MMM yyyy', { locale: es });
      let monthlySum = 0;
      clients.forEach(client => {
        if (client.paymentAmount > 0 && client.status !== 'completed') {
          const nextPaymentDate = parseISO(client.nextPaymentDate);
          if (isSameMonth(nextPaymentDate, targetMonthDate) && isSameYear(nextPaymentDate, targetMonthDate)) {
            monthlySum += client.paymentAmount;
          }
        }
      });
      data.push({ month: monthName, revenue: monthlySum });
    }
    return data;
  }, [clients]);

  const clientGrowthData = useMemo(() => {
    if (!clients) return [];
    const data: { month: string; count: number }[] = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) { 
      const targetMonthDate = subMonths(today, i);
      const monthName = formatDateFns(targetMonthDate, 'MMM yyyy', { locale: es });
      let clientsInMonth = 0;
      clients.forEach(client => {
        if (client.createdAt){
            const createdAtDate = parseISO(client.createdAt);
            if (isSameMonth(createdAtDate, targetMonthDate) && isSameYear(createdAtDate, targetMonthDate)) {
            clientsInMonth++;
            }
        }
      });
      data.push({ month: monthName, count: clientsInMonth });
    }
    return data;
  }, [clients]);

  const financingPlanDistributionData = useMemo(() => {
    if (!clients || Object.keys(financingOptions).length === 0) return [];
    const distribution: { name: string; value: number; fill: string }[] = [];
    const planCounts: { [key: string]: number } = {};

    clients.forEach(client => {
      const planKey = client.financingPlan !== undefined ? Number(client.financingPlan) : 0;
      const planLabel = financingOptions[planKey]?.label || "N/A";
      planCounts[planLabel] = (planCounts[planLabel] || 0) + 1;
    });

    const colors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
    let colorIndex = 0;
    for (const [planName, count] of Object.entries(planCounts)) {
      distribution.push({ name: planName, value: count, fill: colors[colorIndex % colors.length] });
      colorIndex++;
    }
    return distribution;
  }, [clients, financingOptions]);


  if (!initialLoadComplete) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-muted-foreground">Verificando acceso...</p>
        </div>
      </AppLayout>
    );
  }
  
  if (isLoading && initialLoadComplete) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-muted-foreground">Cargando datos del panel...</p>
        </div>
      </AppLayout>
    );
  }

  if (error && initialLoadComplete) {
    return (
      <AppLayout>
        <Alert variant="destructive" className="my-4">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error al Cargar Datos</AlertTitle>
          <AlertDescription>
            {error}
             {error.toLowerCase().includes("permission denied") || error.toLowerCase().includes("permiso denegado") ? (
                 <p className="mt-2 text-xs">Asegúrese de que las reglas de seguridad de Firestore permitan el acceso requerido y que su cuenta de administrador esté configurada correctamente.</p>
            ) : null}
          </AlertDescription>
        </Alert>
      </AppLayout>
    );
  }
  
  if (!isAdmin && initialLoadComplete) {
     return (
      <AppLayout>
        <Alert variant="destructive" className="my-4">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Acceso Denegado</AlertTitle>
          <AlertDescription>
            No tiene permisos de administrador para ver esta página.
          </AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Panel de Analíticas {appName}</h1>
        <p className="text-muted-foreground">Métricas clave, proyecciones y rendimiento de su negocio.</p>
      </div>

      {/* Statistics Panel */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
        {/* Fila 1: Estadísticas Generales de Recaudo */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recaudación Próxima Cuota</CardTitle>
            <CreditCardIcon className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics.totalPendingCollection)}</div>
            <p className="text-xs text-muted-foreground">Suma de la próxima cuota de cada cliente activo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proyección Mes Actual</CardTitle>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics.currentMonthProjection)}</div>
            <p className="text-xs text-muted-foreground">Próximas cuotas este mes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proyección Año Actual</CardTitle>
            <CalendarClock className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics.currentYearProjection)}</div>
            <p className="text-xs text-muted-foreground">Próximas cuotas este año</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Impuestos Estimados (IVA)</CardTitle>
            <Landmark className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics.estimatedTaxes)}</div>
            <p className="text-xs text-muted-foreground">IVA de contratos con financiación</p>
          </CardContent>
        </Card>
        
        {/* Fila 2: Estadísticas de Mora */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes en Mora</CardTitle>
            <UserX className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.clientsInArrearsCount}</div>
            <p className="text-xs text-muted-foreground">Clientes con pagos vencidos</p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monto Total Vencido</CardTitle>
            <AlertCircle className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics.totalOverdueAmount)}</div>
            <p className="text-xs text-muted-foreground">Suma de cuotas vencidas</p>
          </CardContent>
        </Card>

        {/* Fila 3: Estadísticas "Contables" / Valor de Contratos */}
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total Contratado</CardTitle>
            <FileText className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics.totalContractValue)}</div>
            <p className="text-xs text-muted-foreground">Suma de valores de contrato (antes de IVA)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Abonos Registrados</CardTitle>
            <DollarSign className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics.totalDownPayments)}</div>
            <p className="text-xs text-muted-foreground">Suma de los abonos iniciales</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Financiado (Bruto)</CardTitle>
            <DollarSign className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics.totalFinancedAmount)}</div>
            <p className="text-xs text-muted-foreground">Suma de montos a financiar</p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Intereses Financiación</CardTitle>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics.totalFinancingInterest)}</div>
            <p className="text-xs text-muted-foreground">Suma de intereses por financiación</p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingreso Total Proyectado</CardTitle>
            <DollarSign className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics.totalProjectedRevenue)}</div>
            <p className="text-xs text-muted-foreground">Suma de (abonos + total con interés) o (total con IVA)</p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes Activos</CardTitle>
            <UsersIconLucide className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients.filter(c => c.status === 'active').length}</div>
            <p className="text-xs text-muted-foreground">Número total de clientes activos</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Proyección de Recaudos Mensuales</CardTitle>
            <CardDescription>Estimación de las próximas cuotas a recaudar en los siguientes 6 meses.</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyRevenueData.length > 0 ? (
              <MonthlyRevenueChart data={monthlyRevenueData} />
            ) : (
              <p className="text-muted-foreground text-center py-8">No hay datos suficientes para generar este gráfico.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5" />Curva de Crecimiento de Clientes</CardTitle>
            <CardDescription>Número de clientes nuevos registrados por mes en los últimos 6 meses.</CardDescription>
          </CardHeader>
          <CardContent>
            {clientGrowthData.length > 0 ? (
              <ClientGrowthChart data={clientGrowthData} />
            ) : (
              <p className="text-muted-foreground text-center py-8">No hay datos suficientes para generar este gráfico.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PieChartIcon className="h-5 w-5" />Distribución de Clientes por Plan de Financiación</CardTitle>
            <CardDescription>Cómo se distribuyen los clientes entre los diferentes planes de financiación ofrecidos.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            {financingPlanDistributionData.length > 0 ? (
              <FinancingPlanDistributionChart data={financingPlanDistributionData} />
            ) : (
              <p className="text-muted-foreground text-center py-8">No hay datos suficientes para generar este gráfico.</p>
            )}
          </CardContent>
        </Card>
      
      {/* Quick Actions or Links */}
      <Card>
        <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
            <Button asChild>
              <Link href="/clients">
                <UsersIconLucide className="mr-2 h-4 w-4" /> Ver Lista de Clientes
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/clients/new">
                <PlusCircle className="mr-2 h-4 w-4" /> Agregar Nuevo Cliente
              </Link>
            </Button>
        </CardContent>
      </Card>

    </AppLayout>
  );
}
