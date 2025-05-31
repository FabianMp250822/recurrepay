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
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Bienvenido, {client.firstName}</h1>
          <p className="text-muted-foreground">Aquí puedes ver el estado de tus pagos y servicios</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Información Personal */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5" />
                Información Personal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                <span>{client.firstName} {client.lastName}</span>
              </div>
              <div className="flex items-center gap-2">
                <MailIcon className="h-4 w-4 text-muted-foreground" />
                <span>{client.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <PhoneIcon className="h-4 w-4 text-muted-foreground" />
                <span>{client.phoneNumber}</span>
              </div>
            </CardContent>
          </Card>

          {/* Estado de Pago */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCardIcon className="h-5 w-5" />
                Estado de Pago
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span>Estado:</span>
                {getPaymentStatusBadge()}
              </div>
              {client.paymentAmount > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>Cuota Mensual:</span>
                    <strong>{formatCurrency(client.paymentAmount)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Próximo Pago:</span>
                    <strong>{formatDate(client.nextPaymentDate)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Días Restantes:</span>
                    <span className={daysUntilDue <= 0 ? 'text-destructive font-semibold' : daysUntilDue <= 7 ? 'text-yellow-600 font-semibold' : ''}>
                      {daysUntilDue <= 0 ? `${Math.abs(daysUntilDue)} días vencido` : `${daysUntilDue} días`}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Información del Contrato */}
          {client.contractValue && client.contractValue > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileTextIcon className="h-5 w-5" />
                  Detalles del Contrato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span>Valor Contrato:</span>
                  <strong>{formatCurrency(client.contractValue)}</strong>
                </div>
                {client.totalWithIva && (
                  <div className="flex justify-between">
                    <span>Total con IVA:</span>
                    <strong>{formatCurrency(client.totalWithIva)}</strong>
                  </div>
                )}
                {client.downPayment && (
                  <div className="flex justify-between">
                    <span>Abono Inicial:</span>
                    <strong>{formatCurrency(client.downPayment)}</strong>
                  </div>
                )}
                {client.financingPlan && client.financingPlan > 0 && (
                  <div className="flex justify-between">
                    <span>Plan Financiación:</span>
                    <strong>{client.financingPlan} meses</strong>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Historial de Pagos */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Historial de Pagos</CardTitle>
            <CardDescription>
              Registro de todos tus pagos realizados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2">Cargando historial...</p>
              </div>
            ) : paymentHistory.length > 0 ? (
              <div className="space-y-4">
                {paymentHistory.map((payment, index) => (
                  <div key={payment.id || index} className="flex justify-between items-center p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{formatCurrency(payment.amountPaid)}</p>
                      <p className="text-sm text-muted-foreground">
                        Registrado: {formatDate(payment.recordedAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        Fecha de Pago: {formatDate(payment.paymentDate)}
                      </p>
                      {payment.siigoInvoiceUrl && (
                        <a 
                          href={payment.siigoInvoiceUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          Ver Factura
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No hay pagos registrados aún.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
}