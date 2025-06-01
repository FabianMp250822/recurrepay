'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard as CreditCardIcon, Clock, CheckCircle, XCircle, Eye, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatDate, getDaysUntilDue } from '@/lib/utils';
import { getClientByFirebaseId, getPaymentHistory } from '@/lib/store';
import ClientLayout from '@/components/layout/client-layout';
import SubmitPaymentButton from '@/components/clients/SubmitPaymentButton';
import { PaymentHistoryList } from '@/components/clients/PaymentHistoryList';
import FullInstallmentsTable from '@/components/clients/FullInstallmentsTable';
import PaymentProgressChart from '@/components/analytics/PaymentProgressChart'; // ✅ NUEVO
import ClientTicketsSummary from '@/components/tickets/ClientTicketsSummary'; // ✅ NUEVO
import type { Client, PaymentRecord } from '@/types';

export default function ClientDashboardPage() {
  const { user, client: authClient, loading: loadingAuth, initialLoadComplete } = useAuth();
  const [client, setClient] = useState<Client | null>(authClient);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [loadingClient, setLoadingClient] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadClientData = async () => {
    if (!user?.uid) return;

    setLoadingClient(true);
    try {
      // ✅ CAMBIAR de getClientById a getClientByFirebaseId
      const clientData = await getClientByFirebaseId(user.uid);
      if (clientData) {
        setClient(clientData);
        
        // Cargar historial de pagos
        setLoadingHistory(true);
        try {
          const history = await getPaymentHistory(clientData.id);
          setPaymentHistory(history);
        } catch (error) {
          console.error('Error loading payment history:', error);
        } finally {
          setLoadingHistory(false);
        }
      }
    } catch (error) {
      console.error('Error loading client data:', error);
    } finally {
      setLoadingClient(false);
    }
  };

  useEffect(() => {
    if (initialLoadComplete && user) {
      if (!authClient) {
        loadClientData();
      } else {
        setClient(authClient);
        // Cargar historial si ya tenemos cliente
        if (authClient.id) {
          setLoadingHistory(true);
          getPaymentHistory(authClient.id).then(history => {
            setPaymentHistory(history);
          }).catch(error => {
            console.error('Error loading payment history:', error);
          }).finally(() => {
            setLoadingHistory(false);
          });
        }
      }
    }
  }, [initialLoadComplete, user, authClient]);

  // ✅ Función para recargar datos después de enviar un pago
  const handlePaymentSubmitted = () => {
    loadClientData();
  };

  const getPaymentRecordStatusBadge = (payment: PaymentRecord) => {
    const status = payment.status || 'validated';
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">En Validación</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rechazado</Badge>;
      default:
        return <Badge variant="default">Validado</Badge>;
    }
  };

  if (!initialLoadComplete || loadingClient) {
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
      <ClientLayout>
        <div className="max-w-4xl mx-auto p-6">
          <Card>
            <CardHeader>
              <CardTitle>Información No Encontrada</CardTitle>
            </CardHeader>
            <CardContent>
              <p>No se encontró información de cliente para tu cuenta.</p>
              <Button className="w-full mt-4" onClick={() => window.location.href = '/inscribir'}>
                Completar Registro
              </Button>
            </CardContent>
          </Card>
        </div>
      </ClientLayout>
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

  // Separar pagos por estado
  const validatedPayments = paymentHistory.filter(p => p.status === 'validated' || !p.status);
  const pendingPayments = paymentHistory.filter(p => p.status === 'pending');
  const rejectedPayments = paymentHistory.filter(p => p.status === 'rejected');

  return (
    <ClientLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header con información del cliente */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              ¡Hola, {client.firstName} {client.lastName}!
            </CardTitle>
            <CardDescription>
              Estado de tu cuenta y plan de pagos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Estado del Plan</p>
                {getPaymentStatusBadge()}
              </div>
              
              {client.status !== 'completed' && (
                <>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Próximo Pago</p>
                    <p className="font-semibold">{formatDate(client.nextPaymentDate)}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Monto</p>
                    <p className="font-semibold text-lg">{formatCurrency(client.paymentAmount)}</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ✅ NUEVA: Tabla completa de cuotas (pagadas y pendientes) */}
        <FullInstallmentsTable 
          client={client} 
          paymentHistory={paymentHistory}
          onPaymentSubmitted={handlePaymentSubmitted}
        />

        {/* ✅ NUEVA SECCIÓN: Gráficos de progreso y tickets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico de progreso de pagos */}
          <PaymentProgressChart 
            client={client} 
            paymentHistory={paymentHistory}
          />
          
          {/* Resumen de tickets de soporte */}
          <ClientTicketsSummary />
        </div>

        {/* Historial de Pagos Detallado (mantener para referencia completa) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Historial Detallado de Pagos</CardTitle>
            <CardDescription>
              Registro cronológico de todos tus pagos
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6">
            {loadingHistory ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-3 text-sm text-muted-foreground">Cargando historial...</p>
              </div>
            ) : paymentHistory.length > 0 ? (
              <div className="space-y-6">
                {/* Pagos pendientes */}
                {pendingPayments.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold mb-3 text-yellow-700">
                      Pagos en Validación ({pendingPayments.length})
                    </h4>
                    <div className="space-y-3">
                      {pendingPayments.map((payment, index) => (
                        <div 
                          key={payment.id || index} 
                          className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 border rounded-lg bg-yellow-50 gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-yellow-600" />
                              <p className="font-semibold text-lg">
                                {formatCurrency(payment.amountPaid)}
                              </p>
                              {getPaymentRecordStatusBadge(payment)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Enviado: {formatDate(payment.recordedAt)}
                            </p>
                            {payment.installmentNumber && (
                              <p className="text-sm text-blue-600">
                                Cuota #{payment.installmentNumber}
                                {payment.totalInstallments && ` de ${payment.totalInstallments}`}
                              </p>
                            )}
                          </div>
                          <div className="text-left sm:text-right space-y-1">
                            <p className="text-sm font-medium">
                              Fecha de Pago: {formatDate(payment.paymentDate)}
                            </p>
                            {payment.proofUrl && (
                              <a 
                                href={payment.proofUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-block text-xs text-primary hover:underline font-medium"
                              >
                                Ver Comprobante →
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pagos validados */}
                {validatedPayments.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold mb-3 text-green-700">
                      Pagos Validados ({validatedPayments.length})
                    </h4>
                    <div className="space-y-3">
                      {validatedPayments.map((payment, index) => (
                        <div 
                          key={payment.id || index} 
                          className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 border rounded-lg bg-green-50 gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <p className="font-semibold text-lg">
                                {formatCurrency(payment.amountPaid)}
                              </p>
                              {getPaymentRecordStatusBadge(payment)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Registrado: {formatDate(payment.recordedAt)}
                            </p>
                            {payment.installmentNumber && (
                              <p className="text-sm text-blue-600">
                                Cuota #{payment.installmentNumber}
                                {payment.totalInstallments && ` de ${payment.totalInstallments}`}
                              </p>
                            )}
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
                  </div>
                )}

                {/* Pagos rechazados */}
                {rejectedPayments.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold mb-3 text-red-700">
                      Pagos Rechazados ({rejectedPayments.length})
                    </h4>
                    <div className="space-y-3">
                      {rejectedPayments.map((payment, index) => (
                        <div 
                          key={payment.id || index} 
                          className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 border rounded-lg bg-red-50 gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <XCircle className="h-4 w-4 text-red-600" />
                              <p className="font-semibold text-lg">
                                {formatCurrency(payment.amountPaid)}
                              </p>
                              {getPaymentRecordStatusBadge(payment)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Enviado: {formatDate(payment.recordedAt)}
                            </p>
                            {payment.installmentNumber && (
                              <p className="text-sm text-blue-600">
                                Cuota #{payment.installmentNumber}
                                {payment.totalInstallments && ` de ${payment.totalInstallments}`}
                              </p>
                            )}
                            {payment.rejectionReason && (
                              <p className="text-sm text-red-600">
                                Motivo: {payment.rejectionReason}
                              </p>
                            )}
                          </div>
                          <div className="text-left sm:text-right space-y-1">
                            <p className="text-sm font-medium">
                              Fecha de Pago: {formatDate(payment.paymentDate)}
                            </p>
                            {payment.proofUrl && (
                              <a 
                                href={payment.proofUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-block text-xs text-primary hover:underline font-medium"
                              >
                                Ver Comprobante →
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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