'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Clock, Search, CreditCard, Eye, Download, Calendar, DollarSign } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getClients, getPaymentHistory, getPendingPayments } from '@/lib/store';
import AppLayout from '@/components/layout/app-layout';
import type { Client, PaymentRecord as BasePaymentRecord } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import PendingPaymentsPanel from '@/components/admin/PendingPaymentsPanel';

// Extended PaymentRecord type with client information
type PaymentRecord = BasePaymentRecord & {
  clientName?: string;
  clientEmail?: string;
  clientId?: string;
};

export default function PaymentsPage() {
  const { isAdmin, initialLoadComplete } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<PaymentRecord[]>([]);
  const [pendingPayments, setPendingPayments] = useState<(PaymentRecord & { clientName: string; clientEmail: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('validated'); // ✅ Por defecto solo validados
  const [monthFilter, setMonthFilter] = useState('todos');

  // ✅ NUEVA función para recargar solo los datos necesarios
  const loadPaymentsData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      
      const clientsData = await getClients();
      setClients(clientsData);

      // ✅ Cargar pagos pendientes PRIMERO
      console.log('🔍 Cargando pagos pendientes...');
      const pendingPaymentsData = await getPendingPayments();
      console.log('📋 Pagos pendientes encontrados:', pendingPaymentsData.length);
      setPendingPayments(pendingPaymentsData);

      // Cargar historial de pagos para todos los clientes
      const allPaymentsData: PaymentRecord[] = [];
      for (const client of clientsData) {
        try {
          const paymentHistory = await getPaymentHistory(client.id);
          // Agregar información del cliente a cada pago
          const paymentsWithClientInfo = paymentHistory.map(payment => ({
            ...payment,
            clientName: `${client.firstName} ${client.lastName}`,
            clientEmail: client.email,
            clientId: client.id
          }));
          allPaymentsData.push(...paymentsWithClientInfo);
        } catch (error) {
          console.error(`Error loading payments for client ${client.id}:`, error);
        }
      }

      // Ordenar por fecha de registro (más recientes primero)
      allPaymentsData.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
      setAllPayments(allPaymentsData);
      console.log('💳 Total de pagos cargados:', allPaymentsData.length);
    } catch (error) {
      console.error('Error loading payments data:', error);
      setError('Error al cargar los datos de pagos');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // ✅ NUEVA función para manejar la validación de pagos
  const handlePaymentProcessed = async () => {
    console.log('🔄 Pago procesado, recargando datos...');
    // Recargar datos sin mostrar loading para mejor UX
    await loadPaymentsData(false);
  };

  useEffect(() => {
    if (initialLoadComplete && isAdmin) {
      loadPaymentsData();
    }
  }, [initialLoadComplete, isAdmin]);

  useEffect(() => {
    filterPayments();
  }, [allPayments, searchTerm, statusFilter, monthFilter]);

  // ✅ Filtrar pagos según criterios
  const filterPayments = () => {
    let filtered = [...allPayments];

    // ✅ Filtrar por estado PRIMERO
    if (statusFilter !== 'todos') {
      filtered = filtered.filter(payment => {
        const paymentStatus = payment.status || 'validated'; // Si no tiene status, asumimos que es validado (pagos antiguos)
        return paymentStatus === statusFilter;
      });
    }

    // Filtrar por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(payment =>
        payment.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.clientEmail?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtrar por mes
    if (monthFilter !== 'todos') {
      const currentYear = new Date().getFullYear();
      const targetMonth = parseInt(monthFilter);
      filtered = filtered.filter(payment => {
        const paymentDate = new Date(payment.paymentDate);
        return paymentDate.getMonth() === targetMonth && paymentDate.getFullYear() === currentYear;
      });
    }

    setFilteredPayments(filtered);
  };

  // ✅ Solo contar pagos VALIDADOS para los totales
  const getTotalAmount = () => {
    return filteredPayments
      .filter(payment => (payment.status || 'validated') === 'validated')
      .reduce((sum, payment) => sum + payment.amountPaid, 0);
  };

  // ✅ Solo pagos VALIDADOS para estadísticas por mes
  const getPaymentsByMonth = () => {
    const currentYear = new Date().getFullYear();
    const monthlyData: { [key: number]: number } = {};
    
    allPayments
      .filter(payment => (payment.status || 'validated') === 'validated') // Solo validados
      .forEach(payment => {
        const paymentDate = new Date(payment.paymentDate);
        if (paymentDate.getFullYear() === currentYear) {
          const month = paymentDate.getMonth();
          monthlyData[month] = (monthlyData[month] || 0) + payment.amountPaid;
        }
      });

    return monthlyData;
  };

  // ✅ Obtener conteos por estado
  const getPaymentCounts = () => {
    const counts = {
      validated: 0,
      pending: 0,
      rejected: 0,
      total: 0
    };

    allPayments.forEach(payment => {
      const status = payment.status || 'validated';
      counts[status as keyof typeof counts]++;
      counts.total++;
    });

    return counts;
  };

  // ✅ Función para obtener el ícono del estado
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'validated':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
  };

  // ✅ Función para obtener el badge del estado
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'validated':
        return <Badge variant="default">Validado</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pendiente</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rechazado</Badge>;
      default:
        return <Badge variant="default">Validado</Badge>;
    }
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
          <p className="ml-4 text-muted-foreground">Cargando datos de pagos...</p>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <Alert variant="destructive" className="my-4">
          <AlertTitle>Error al Cargar Pagos</AlertTitle>
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

  const monthlyData = getPaymentsByMonth();
  const paymentCounts = getPaymentCounts();

  return (
    <AppLayout>
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-100 px-6 py-8 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard className="h-8 w-8 text-green-600" />
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Pagos</h1>
        </div>
        <p className="text-gray-600">Administre y valide todos los pagos del sistema.</p>
      </div>

      {/* ✅ Panel de pagos pendientes - PRIMERA PRIORIDAD con callback */}
      <div className="mb-6">
        <PendingPaymentsPanel 
          pendingPayments={pendingPayments} 
          onPaymentProcessed={handlePaymentProcessed} // ✅ NUEVO callback
        />
      </div>

      {/* ✅ Estadísticas por estado */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Validados</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{paymentCounts.validated}</div>
            <p className="text-xs text-muted-foreground">
              Total: {formatCurrency(getTotalAmount())}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{paymentCounts.pending}</div>
            <p className="text-xs text-muted-foreground">
              Requieren validación
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rechazados</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{paymentCounts.rejected}</div>
            <p className="text-xs text-muted-foreground">
              No válidos para conteo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Registros</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paymentCounts.total}</div>
            <p className="text-xs text-muted-foreground">
              Todos los estados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ✅ Estadísticas de ingresos (solo validados) */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Este Mes</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(monthlyData[new Date().getMonth()] || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Solo pagos validados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio por Pago Validado</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {paymentCounts.validated > 0 
                ? formatCurrency(getTotalAmount() / paymentCounts.validated)
                : formatCurrency(0)
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Valor promedio
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ✅ Filtros y búsqueda */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filtros de Búsqueda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por cliente o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* ✅ Filtro por estado */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="validated">✅ Validados</SelectItem>
                <SelectItem value="pending">⏳ Pendientes</SelectItem>
                <SelectItem value="rejected">❌ Rechazados</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filtrar por mes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los meses</SelectItem>
                <SelectItem value="0">Enero</SelectItem>
                <SelectItem value="1">Febrero</SelectItem>
                <SelectItem value="2">Marzo</SelectItem>
                <SelectItem value="3">Abril</SelectItem>
                <SelectItem value="4">Mayo</SelectItem>
                <SelectItem value="5">Junio</SelectItem>
                <SelectItem value="6">Julio</SelectItem>
                <SelectItem value="7">Agosto</SelectItem>
                <SelectItem value="8">Septiembre</SelectItem>
                <SelectItem value="9">Octubre</SelectItem>
                <SelectItem value="10">Noviembre</SelectItem>
                <SelectItem value="11">Diciembre</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ✅ Tabla de pagos con estados */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Pagos</CardTitle>
          <CardDescription>
            {statusFilter === 'todos' 
              ? 'Lista completa de todos los pagos registrados'
              : statusFilter === 'validated'
              ? 'Pagos validados y contabilizados como ingresos'
              : statusFilter === 'pending'
              ? 'Pagos pendientes de validación'
              : 'Pagos rechazados (no contabilizados como ingresos)'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {statusFilter === 'todos' 
                  ? 'No se encontraron pagos con los filtros aplicados'
                  : statusFilter === 'validated'
                  ? 'No hay pagos validados con los filtros aplicados'
                  : statusFilter === 'pending'
                  ? 'No hay pagos pendientes de validación'
                  : 'No hay pagos rechazados con los filtros aplicados'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Monto Pagado</TableHead>
                    <TableHead>Fecha de Pago</TableHead>
                    <TableHead>Registrado el</TableHead>
                    <TableHead>Comprobante</TableHead>
                    <TableHead>Factura</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment, index) => {
                    const paymentStatus = payment.status || 'validated';
                    return (
                      <TableRow key={payment.id || index}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(paymentStatus)}
                            {getStatusBadge(paymentStatus)}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {payment.clientName || 'N/A'}
                        </TableCell>
                        <TableCell>{payment.clientEmail || 'N/A'}</TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(payment.amountPaid)}
                        </TableCell>
                        <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(payment.recordedAt)}
                        </TableCell>
                        <TableCell>
                          {payment.proofUrl ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(payment.proofUrl, '_blank')}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Ver
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">Sin comprobante</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {payment.siigoInvoiceUrl ? (
                            <a
                              href={payment.siigoInvoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-sm"
                            >
                              Ver Factura →
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-sm">Sin factura</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}