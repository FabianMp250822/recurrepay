'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, Search, Filter, Download, Calendar, DollarSign } from 'lucide-react';
import { formatCurrency, formatDate, getDaysUntilDue } from '@/lib/utils';
import { getClients, getPaymentHistory } from '@/lib/store';
import AppLayout from '@/components/layout/app-layout';
import type { Client, PaymentRecord as BasePaymentRecord } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [monthFilter, setMonthFilter] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialLoadComplete && isAdmin) {
      loadPaymentsData();
    }
  }, [initialLoadComplete, isAdmin]);

  useEffect(() => {
    filterPayments();
  }, [allPayments, searchTerm, statusFilter, monthFilter]);

  const loadPaymentsData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const clientsData = await getClients();
      setClients(clientsData);

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
    } catch (error) {
      console.error('Error loading payments data:', error);
      setError('Error al cargar los datos de pagos');
    } finally {
      setLoading(false);
    }
  };

  const filterPayments = () => {
    let filtered = [...allPayments];

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

  const getTotalAmount = () => {
    return filteredPayments.reduce((sum, payment) => sum + payment.amountPaid, 0);
  };

  const getPaymentsByMonth = () => {
    const currentYear = new Date().getFullYear();
    const monthlyData: { [key: number]: number } = {};
    
    allPayments.forEach(payment => {
      const paymentDate = new Date(payment.paymentDate);
      if (paymentDate.getFullYear() === currentYear) {
        const month = paymentDate.getMonth();
        monthlyData[month] = (monthlyData[month] || 0) + payment.amountPaid;
      }
    });

    return monthlyData;
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

  return (
    <AppLayout>
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-100 px-6 py-8 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard className="h-8 w-8 text-green-600" />
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Pagos</h1>
        </div>
        <p className="text-gray-600">Administre y visualice todos los pagos registrados en el sistema.</p>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pagos Filtrados</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(getTotalAmount())}</div>
            <p className="text-xs text-muted-foreground">
              {filteredPayments.length} pagos registrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Este Mes</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(monthlyData[new Date().getMonth()] || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Mes actual
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio por Pago</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredPayments.length > 0 
                ? formatCurrency(getTotalAmount() / filteredPayments.length)
                : formatCurrency(0)
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Valor promedio
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros y búsqueda */}
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

      {/* Tabla de pagos */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Pagos</CardTitle>
          <CardDescription>
            Lista completa de todos los pagos registrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No se encontraron pagos con los filtros aplicados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Monto Pagado</TableHead>
                    <TableHead>Fecha de Pago</TableHead>
                    <TableHead>Registrado el</TableHead>
                    <TableHead>Factura</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment, index) => (
                    <TableRow key={payment.id || index}>
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}