'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, formatDate, getDaysUntilDue } from '@/lib/utils';
import { CalendarIcon, CreditCardIcon, UserIcon, PhoneIcon, MailIcon, FileTextIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getPaymentHistory } from '@/lib/store';
import type { PaymentRecord } from '@/types';
import ClientLayout from '@/components/layout/client-layout';

export default function ClientDashboardPage() {
  const { client, loading, initialLoadComplete } = useAuth();
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    async function fetchPaymentHistory() {
      if (client?.id) {
        try {
          const history = await getPaymentHistory(client.id);
          setPaymentHistory(history);
        } catch (error) {
          console.error('Error fetching payment history:', error);
        } finally {
          setLoadingHistory(false);
        }
      }
    }

    if (client) {
      fetchPaymentHistory();
    }
  }, [client]);

  if (!initialLoadComplete || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4">Cargando tu panel...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Acceso Restringido</CardTitle>
          </CardHeader>
          <CardContent>
            <p>No se encontró información de cliente para tu cuenta.</p>
            <Button className="w-full mt-4" onClick={() => window.location.href = '/inscribir'}>
              Completar Registro
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const daysUntilDue = getDaysUntilDue(client.nextPaymentDate);
  const isPaymentDue = daysUntilDue <= 0;
  const isPaymentSoon = daysUntilDue > 0 && daysUntilDue <= 7;

  const getPaymentStatusBadge = () => {
    if (client.status === 'completed') {
      return <Badge variant="secondary">Completado</Badge>;
    }
    if (isPaymentDue) {
      return <Badge variant="destructive">Vencido</Badge>;
    }
    if (isPaymentSoon) {
      return <Badge variant="outline">Vence Pronto</Badge>;
    }
    return <Badge variant="default">Al Día</Badge>;
  };

  return (
    <ClientLayout>
      {/* Container principal con padding apropiado */}
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header del dashboard */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Bienvenido, {client.firstName}
          </h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            Aquí puedes ver el estado de tus pagos y servicios
          </p>
        </div>

        {/* Grid de tarjetas principales */}
        <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3 mb-8">
          {/* Información Personal */}
          <Card className="h-fit">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserIcon className="h-5 w-5" />
                Información Personal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <UserIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium truncate">
                  {client.firstName} {client.lastName}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <MailIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm truncate">{client.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <PhoneIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm">{client.phoneNumber}</span>
              </div>
            </CardContent>
          </Card>

          {/* Estado de Pago */}
          <Card className="h-fit">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCardIcon className="h-5 w-5" />
                Estado de Pago
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Estado:</span>
                {getPaymentStatusBadge()}
              </div>
              {client.paymentAmount > 0 && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Cuota Mensual:</span>
                    <strong className="text-sm font-semibold">
                      {formatCurrency(client.paymentAmount)}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Próximo Pago:</span>
                    <strong className="text-sm font-semibold">
                      {formatDate(client.nextPaymentDate)}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Días Restantes:</span>
                    <span className={`text-sm font-semibold ${
                      daysUntilDue <= 0 
                        ? 'text-destructive' 
                        : daysUntilDue <= 7 
                          ? 'text-yellow-600' 
                          : 'text-green-600'
                    }`}>
                      {daysUntilDue <= 0 
                        ? `${Math.abs(daysUntilDue)} días vencido` 
                        : `${daysUntilDue} días`
                      }
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Información del Contrato */}
          {client.contractValue && client.contractValue > 0 && (
            <Card className="h-fit md:col-span-2 lg:col-span-1">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileTextIcon className="h-5 w-5" />
                  Detalles del Contrato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Valor Contrato:</span>
                  <strong className="text-sm font-semibold">
                    {formatCurrency(client.contractValue)}
                  </strong>
                </div>
                {client.totalWithIva && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Total con IVA:</span>
                    <strong className="text-sm font-semibold">
                      {formatCurrency(client.totalWithIva)}
                    </strong>
                  </div>
                )}
                {client.downPayment && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Abono Inicial:</span>
                    <strong className="text-sm font-semibold">
                      {formatCurrency(client.downPayment)}
                    </strong>
                  </div>
                )}
                {client.financingPlan && client.financingPlan > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Plan Financiación:</span>
                    <strong className="text-sm font-semibold">
                      {client.financingPlan} meses
                    </strong>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Historial de Pagos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Historial de Pagos</CardTitle>
            <CardDescription>
              Registro de todos tus pagos realizados
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6">
            {loadingHistory ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-3 text-sm text-muted-foreground">Cargando historial...</p>
              </div>
            ) : paymentHistory.length > 0 ? (
              <div className="space-y-4">
                {paymentHistory.map((payment, index) => (
                  <div 
                    key={payment.id || index} 
                    className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 border rounded-lg bg-muted/30 gap-3"
                  >
                    <div className="space-y-1">
                      <p className="font-semibold text-lg">
                        {formatCurrency(payment.amountPaid)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Registrado: {formatDate(payment.recordedAt)}
                      </p>
                    </div>
                    <div className="text-left sm:text-right space-y-1">
                      <p className="text-sm font-medium">
                        Fecha de Pago: {formatDate(payment.paymentDate)}
                      </p>
                      {payment.siigoInvoiceUrl && (
                        <a 
                          href={payment.siigoInvoiceUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-block text-xs text-primary hover:underline font-medium"
                        >
                          Ver Factura →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <CreditCardIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No hay pagos registrados
                </h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Cuando realices tu primer pago, aparecerá aquí en tu historial.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
}