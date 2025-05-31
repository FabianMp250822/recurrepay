'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Calendar, Users, TrendingUp, DollarSign, BarChart3 } from 'lucide-react';
import { formatCurrency, formatDate, getDaysUntilDue } from '@/lib/utils';
import { getClients, getPaymentHistory } from '@/lib/store';
import AppLayout from '@/components/layout/app-layout';
import type { Client, PaymentRecord } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

interface ReportData {
  totalClients: number;
  activeClients: number;
  completedClients: number;
  overdueClients: number;
  totalRevenue: number;
  monthlyRevenue: { [key: string]: number };
  paymentStatusBreakdown: { [key: string]: number };
  financingBreakdown: { [key: string]: number };
  avgPaymentAmount: number;
  totalContractValue: number;
}

export default function ReportsPage() {
  const { isAdmin, initialLoadComplete } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('current-year');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialLoadComplete && isAdmin) {
      loadReportData();
    }
  }, [initialLoadComplete, isAdmin]);

  const loadReportData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const clientsData = await getClients();
      setClients(clientsData);

      // Calcular datos del reporte
      await calculateReportData(clientsData);
    } catch (error) {
      console.error('Error loading report data:', error);
      setError('Error al cargar los datos del reporte');
    } finally {
      setLoading(false);
    }
  };

  const calculateReportData = async (clientsData: Client[]) => {
    const currentYear = new Date().getFullYear();
    let totalRevenue = 0;
    const monthlyRevenue: { [key: string]: number } = {};
    const paymentStatusBreakdown: { [key: string]: number } = {
      'Al día': 0,
      'Vence pronto': 0,
      'Vencido': 0,
      'Completado': 0
    };
    const financingBreakdown: { [key: string]: number } = {};

    // Inicializar datos mensuales
    for (let i = 0; i < 12; i++) {
      const monthName = new Date(currentYear, i, 1).toLocaleDateString('es-ES', { month: 'long' });
      monthlyRevenue[monthName] = 0;
    }

    // Cargar historial de pagos y calcular estadísticas
    for (const client of clientsData) {
      // Estadísticas de estado de pago
      if (client.status === 'completed') {
        paymentStatusBreakdown['Completado']++;
      } else {
        const daysUntilDue = getDaysUntilDue(client.nextPaymentDate);
        if (daysUntilDue < 0) {
          paymentStatusBreakdown['Vencido']++;
        } else if (daysUntilDue <= 7) {
          paymentStatusBreakdown['Vence pronto']++;
        } else {
          paymentStatusBreakdown['Al día']++;
        }
      }

      // Estadísticas de financiación
      const financingKey = client.financingPlan 
        ? `${client.financingPlan} meses`
        : 'Sin financiación';
      financingBreakdown[financingKey] = (financingBreakdown[financingKey] || 0) + 1;

      // Cargar historial de pagos para ingresos
      try {
        const paymentHistory = await getPaymentHistory(client.id);
        paymentHistory.forEach(payment => {
          const paymentDate = new Date(payment.paymentDate);
          if (paymentDate.getFullYear() === currentYear) {
            totalRevenue += payment.amountPaid;
            const monthName = paymentDate.toLocaleDateString('es-ES', { month: 'long' });
            monthlyRevenue[monthName] += payment.amountPaid;
          }
        });
      } catch (error) {
        console.error(`Error loading payments for client ${client.id}:`, error);
      }
    }

    const activeClients = clientsData.filter(c => c.status === 'active').length;
    const completedClients = clientsData.filter(c => c.status === 'completed').length;
    const overdueClients = clientsData.filter(c => 
      c.status === 'active' && getDaysUntilDue(c.nextPaymentDate) < 0
    ).length;

    const totalContractValue = clientsData.reduce((sum, client) => 
      sum + (client.contractValue || 0), 0
    );

    const avgPaymentAmount = activeClients > 0 
      ? clientsData.reduce((sum, client) => sum + (client.paymentAmount || 0), 0) / activeClients
      : 0;

    setReportData({
      totalClients: clientsData.length,
      activeClients,
      completedClients,
      overdueClients,
      totalRevenue,
      monthlyRevenue,
      paymentStatusBreakdown,
      financingBreakdown,
      avgPaymentAmount,
      totalContractValue
    });
  };

  const exportReport = (format: 'pdf' | 'excel') => {
    // Aquí implementarías la lógica de exportación
    console.log(`Exportando reporte en formato ${format}`);
    // Por ahora, solo mostramos un mensaje
    alert(`Funcionalidad de exportación ${format.toUpperCase()} será implementada próximamente`);
  };

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

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-muted-foreground">Generando reporte...</p>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <Alert variant="destructive" className="my-4">
          <AlertTitle>Error al Generar Reporte</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <Alert variant="destructive" className="my-4">
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
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-100 px-6 py-8 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="h-8 w-8 text-purple-600" />
          <h1 className="text-3xl font-bold text-gray-900">Reportes y Análisis</h1>
        </div>
        <p className="text-gray-600">Genere reportes detallados y análisis de su negocio.</p>
      </div>

      {/* Controles de reporte */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Configuración del Reporte</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Período</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current-year">Año Actual</SelectItem>
                  <SelectItem value="last-year">Año Anterior</SelectItem>
                  <SelectItem value="current-month">Mes Actual</SelectItem>
                  <SelectItem value="last-month">Mes Anterior</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => exportReport('pdf')}>
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" onClick={() => exportReport('excel')}>
                <Download className="h-4 w-4 mr-2" />
                Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {reportData && (
        <>
          {/* Resumen ejecutivo */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.totalClients}</div>
                <p className="text-xs text-muted-foreground">
                  {reportData.activeClients} activos, {reportData.completedClients} completados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(reportData.totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">
                  Año {new Date().getFullYear()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Contratado</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(reportData.totalContractValue)}</div>
                <p className="text-xs text-muted-foreground">
                  Total de contratos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clientes Vencidos</CardTitle>
                <TrendingUp className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{reportData.overdueClients}</div>
                <p className="text-xs text-muted-foreground">
                  Requieren atención
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Desglose por estado de pago */}
          <div className="grid gap-6 md:grid-cols-2 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Estado de Pagos</CardTitle>
                <CardDescription>Distribución de clientes por estado</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(reportData.paymentStatusBreakdown).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{status}</span>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-bold">{count}</div>
                        <div className="text-xs text-muted-foreground">
                          ({reportData.totalClients > 0 ? Math.round((count / reportData.totalClients) * 100) : 0}%)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Planes de Financiación</CardTitle>
                <CardDescription>Distribución por tipo de financiación</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(reportData.financingBreakdown).map(([plan, count]) => (
                    <div key={plan} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{plan}</span>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-bold">{count}</div>
                        <div className="text-xs text-muted-foreground">
                          ({reportData.totalClients > 0 ? Math.round((count / reportData.totalClients) * 100) : 0}%)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ingresos mensuales */}
          <Card>
            <CardHeader>
              <CardTitle>Ingresos Mensuales {new Date().getFullYear()}</CardTitle>
              <CardDescription>Evolución de ingresos por mes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(reportData.monthlyRevenue).map(([month, amount]) => (
                  <div key={month} className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">{month}</span>
                    <div className="text-sm font-bold">{formatCurrency(amount)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </AppLayout>
  );
}