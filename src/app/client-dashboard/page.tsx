'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarIcon, CreditCardIcon, FileTextIcon, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatDate, getDaysUntilDue } from '@/lib/utils';
import { getClientByEmail, getPaymentHistory } from '@/lib/store';
import ClientLayout from '@/components/layout/client-layout';
import type { Client, PaymentRecord } from '@/types';
import SubmitPaymentButton from '@/components/clients/SubmitPaymentButton';

export default function ClientDashboardPage() {
  const { user, initialLoadComplete } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [loadingClient, setLoadingClient] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    if (initialLoadComplete && user?.email) {
      loadClientData();
    }
  }, [initialLoadComplete, user]);

  const loadClientData = async () => {
    if (!user?.email) return;
    
    try {
      setLoadingClient(true);
      const clientData = await getClientByEmail(user.email);
      setClient(clientData || null);
      
      if (clientData) {
        setLoadingHistory(true);
        const history = await getPaymentHistory(clientData.id);
        setPaymentHistory(history);
      }
    } catch (error) {
      console.error('Error loading client data:', error);
    } finally {
      setLoadingClient(false);
      setLoadingHistory(false);
    }
  };

  const getPaymentStatusIcon = (payment: PaymentRecord) => {
    switch (payment.status) {
      case 'validated':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'rejected':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
  };

  const getPaymentRecordStatusBadge = (payment: PaymentRecord) => {
    switch (payment.status) {
      case 'validated':
        return <Badge variant="default">Validado</Badge>;
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
              Estado de tu cuenta y próximos pagos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Estado del Pago</p>
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

        {/* Botón para reportar pago */}
        {client.status !== 'completed' && (
          <Card>
            <CardHeader>
              <CardTitle>¿Ya realizaste tu pago?</CardTitle>
              <CardDescription>
                Reporta tu pago para que sea validado por nuestro equipo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SubmitPaymentButton client={client} />
            </CardContent>
          </Card>
        )}

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
                              {getPaymentStatusIcon(payment)}
                              <p className="font-semibold text-lg">
                                {formatCurrency(payment.amountPaid)}
                              </p>
                              {getPaymentRecordStatusBadge(payment)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Enviado: {formatDate(payment.recordedAt)}
                            </p>
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
                              {getPaymentStatusIcon(payment)}
                              <p className="font-semibold text-lg">
                                {formatCurrency(payment.amountPaid)}
                              </p>
                              {getPaymentRecordStatusBadge(payment)}
                            </div>
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
                              {getPaymentStatusIcon(payment)}
                              <p className="font-semibold text-lg">
                                {formatCurrency(payment.amountPaid)}
                              </p>
                              {getPaymentRecordStatusBadge(payment)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Enviado: {formatDate(payment.recordedAt)}
                            </p>
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