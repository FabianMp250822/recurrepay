'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { XCircle, Eye, User } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { PaymentRecord } from '@/types';

interface RejectedPaymentsPanelProps {
  rejectedPayments: (PaymentRecord & { clientName: string; clientEmail: string })[];
}

export default function RejectedPaymentsPanel({ rejectedPayments }: RejectedPaymentsPanelProps) {
  if (rejectedPayments.length === 0) {
    return null; // No mostrar si no hay rechazados
  }

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700">
          <XCircle className="h-5 w-5" />
          Pagos Rechazados
          <Badge variant="destructive">{rejectedPayments.length}</Badge>
        </CardTitle>
        <CardDescription>
          Pagos que fueron rechazados y no se contabilizan como ingresos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {rejectedPayments.map((payment) => (
            <Card key={payment.id} className="border-l-4 border-l-red-500">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <h4 className="font-semibold">{payment.clientName}</h4>
                      <Badge variant="destructive">Rechazado</Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">{payment.clientEmail}</p>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Monto:</span> {formatCurrency(payment.amountPaid)}
                      </div>
                      <div>
                        <span className="font-medium">Fecha de Pago:</span> {formatDate(payment.paymentDate)}
                      </div>
                      <div>
                        <span className="font-medium">Rechazado:</span> {payment.validatedAt ? formatDate(payment.validatedAt) : 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Archivo:</span> {payment.proofFileName || 'N/A'}
                      </div>
                    </div>
                    
                    {payment.rejectionReason && (
                      <div className="mt-2">
                        <span className="font-medium text-sm">Motivo del rechazo:</span>
                        <p className="text-sm text-red-700 bg-red-50 p-2 rounded mt-1">
                          {payment.rejectionReason}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    {payment.proofUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(payment.proofUrl, '_blank')}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Ver Comprobante
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}