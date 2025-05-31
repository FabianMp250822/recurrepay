'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, TrendingUp, TrendingDown, Users, DollarSign, Calendar, CreditCard } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getClients, getPaymentHistory } from '@/lib/store';
import AppLayout from '@/components/layout/app-layout';
import type { Client, PaymentRecord } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

interface MonthlyData {
  month: string;
  revenue: number;
  payments: number;
  clients: number;
}

export default function ReportsPage() {
  const { isAdmin, initialLoadComplete } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState({
    totalRevenue: 0,
    totalPayments: 0,
    totalClients: 0,
    activeClients: 0,
    monthlyData: [] as MonthlyData[],
    averagePayment: 0,
    completedClients: 0,
    pendingPayments: 0
  });

  const loadReportData = async () => {
    try {
      setLoading(true);
      setError(null);

      const clients = await getClients();
      
      // ✅ Inicializar todas las variables
      let totalRevenue = 0;
      let totalPayments = 0; // ✅ Definir esta variable
      let pendingPayments = 0;
      const currentYear = new Date().getFullYear();
      const monthlyRevenue: { [key: number]: number } = {};
      const monthlyPaymentCounts: { [key: number]: number } = {};
      const monthlyClientCounts: { [key: number]: number } = {};

      // Inicializar datos mensuales
      for (let i = 0; i < 12; i++) {
        monthlyRevenue[i] = 0;
        monthlyPaymentCounts[i] = 0;
        monthlyClientCounts[i] = 0;
      }

      // Procesar cada cliente
      for (const client of clients) {
        // Contar clientes por mes de registro
        const clientDate = new Date(client.createdAt);
        if (clientDate.getFullYear() === currentYear) {
          const month = clientDate.getMonth();
          monthlyClientCounts[month]++;
        }

        // ✅ Cargar historial de pagos y contar solo los VALIDADOS
        try {
          const paymentHistory = await getPaymentHistory(client.id);
          
          paymentHistory.forEach(payment => {
            const paymentStatus = payment.status || 'validated'; // Si no tiene status, asumimos validado (pagos antiguos)
            
            if (paymentStatus === 'validated') {
              // ✅ Solo contar pagos validados
              const paymentDate = new Date(payment.paymentDate);
              const month = paymentDate.getMonth();
              const year = paymentDate.getFullYear();
              
              if (year === currentYear) {
                monthlyRevenue[month] += payment.amountPaid;
                monthlyPaymentCounts[month]++;
              }
              
              totalRevenue += payment.amountPaid;
              totalPayments++; // ✅ Incrementar contador
            } else if (paymentStatus === 'pending') {
              pendingPayments++;
            }
            // Los rechazados no se cuentan en ningún lado
          });
        } catch (error) {
          console.error(`Error loading payment history for client ${client.id}:`, error);
        }
      }

      // Calcular estadísticas
      const activeClients = clients.filter(c => c.status === 'active').length;
      const completedClients = clients.filter(c => c.status === 'completed').length;
      const averagePayment = totalPayments > 0 ? totalRevenue / totalPayments : 0;

      // Crear datos mensuales
      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];

      const monthlyData: MonthlyData[] = monthNames.map((month, index) => ({
        month,
        revenue: monthlyRevenue[index] || 0,
        payments: monthlyPaymentCounts[index] || 0,
        clients: monthlyClientCounts[index] || 0
      }));

      setReportData({
        totalRevenue,
        totalPayments, // ✅ Usar la variable definida
        totalClients: clients.length,
        activeClients,
        monthlyData,
        averagePayment,
        completedClients,
        pendingPayments
      });

    } catch (error) {
      console.error('Error loading report data:', error);
      setError('Error al cargar los datos de reportes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialLoadComplete && isAdmin) {
      loadReportData();
    }
  }, [initialLoadComplete, isAdmin]);

  const exportToCSV = () => {
    const headers = ['Mes', 'Ingresos', 'Pagos', 'Nuevos Clientes'];
    const csvContent = [
      headers.join(','),
      ...reportData.monthlyData.map(data => 
        [data.month, data.revenue, data.payments, data.clients].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte-${new Date().getFullYear()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <p className="ml-4 text-muted-foreground">Generando reportes...</p>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <Alert variant="destructive" className="my-4">
          <AlertTitle>Error al Cargar Reportes</AlertTitle>
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

  const currentMonth = new Date().getMonth();
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const currentMonthRevenue = reportData.monthlyData[currentMonth]?.revenue || 0;
  const lastMonthRevenue = reportData.monthlyData[lastMonth]?.revenue || 0;
  const revenueGrowth = lastMonthRevenue > 0 ? 
    ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

  return (
    <AppLayout>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-100 px-6 py-8 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Reportes y Analíticas</h1>
            </div>
            <p className="text-gray-600">Análisis detallado del rendimiento financiero y operativo.</p>
          </div>
          <Button onClick={exportToCSV} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* ✅ Métricas principales (solo pagos validados) */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(reportData.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Solo pagos validados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Procesados</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.totalPayments}</div>
            <p className="text-xs text-muted-foreground">
              Pagos validados únicamente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.activeClients}</div>
            <p className="text-xs text-muted-foreground">
              de {reportData.totalClients} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pago Promedio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(reportData.averagePayment)}</div>
            <p className="text-xs text-muted-foreground">
              Por pago validado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ✅ Crecimiento mensual */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Este Mes</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(currentMonthRevenue)}</div>
            <div className="flex items-center text-xs">
              {revenueGrowth > 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600 mr-1" />
              )}
              <span className={revenueGrowth > 0 ? 'text-green-600' : 'text-red-600'}>
                {Math.abs(revenueGrowth).toFixed(1)}% vs mes anterior
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Completados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.completedClients}</div>
            <p className="text-xs text-muted-foreground">
              Planes finalizados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Pendientes</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{reportData.pendingPayments}</div>
            <p className="text-xs text-muted-foreground">
              Requieren validación
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ✅ Tabla de datos mensuales */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen Mensual {new Date().getFullYear()}</CardTitle>
          <CardDescription>
            Desglose de ingresos, pagos y nuevos clientes por mes (solo datos validados)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Mes</th>
                  <th className="text-right py-2">Ingresos</th>
                  <th className="text-right py-2">Pagos</th>
                  <th className="text-right py-2">Nuevos Clientes</th>
                </tr>
              </thead>
              <tbody>
                {reportData.monthlyData.map((data, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2">{data.month}</td>
                    <td className="text-right py-2 font-medium">
                      {formatCurrency(data.revenue)}
                    </td>
                    <td className="text-right py-2">{data.payments}</td>
                    <td className="text-right py-2">{data.clients}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-semibold">
                  <td className="py-2">Total</td>
                  <td className="text-right py-2">{formatCurrency(reportData.totalRevenue)}</td>
                  <td className="text-right py-2">{reportData.totalPayments}</td>
                  <td className="text-right py-2">{reportData.totalClients}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}