'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';
import { formatCurrency, formatDate, calculatePendingInstallments } from '@/lib/utils';
import type { Client, PaymentRecord, PendingInstallment } from '@/types';

interface PendingInstallmentsPanelProps {
  client: Client;
  paymentHistory: PaymentRecord[];
}

export default function PendingInstallmentsPanel({ client, paymentHistory }: PendingInstallmentsPanelProps) {
  const pendingInstallments = calculatePendingInstallments(client, paymentHistory);
  
  if (pendingInstallments.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            Plan Completado
          </CardTitle>
          <CardDescription>
            ¡Felicitaciones! Has completado todos los pagos de tu plan.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const overduePendingCount = pendingInstallments.filter(i => i.status === 'overdue').length;
  const nextInstallment = pendingInstallments[0];

  return (
    <Card className={overduePendingCount > 0 ? "border-red-200" : "border-blue-200"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Cuotas Pendientes
          <Badge variant={overduePendingCount > 0 ? "destructive" : "secondary"}>
            {pendingInstallments.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          {client.financingPlan && client.financingPlan > 0 
            ? `Plan de ${client.financingPlan} cuotas - ${client.paymentsMadeCount || 0} pagadas`
            : 'Pagos pendientes por realizar'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Próxima cuota destacada */}
        <div className={`p-4 rounded-lg mb-4 ${
          nextInstallment.status === 'overdue' 
            ? 'bg-red-50 border border-red-200' 
            : 'bg-blue-50 border border-blue-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-lg">
                Próxima Cuota: #{nextInstallment.number}
              </h4>
              <p className="text-sm text-muted-foreground">
                {nextInstallment.description}
              </p>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">
                    Vence: {formatDate(nextInstallment.dueDate)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <CreditCard className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {formatCurrency(nextInstallment.amount)}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <Badge variant={nextInstallment.status === 'overdue' ? "destructive" : "outline"}>
                {nextInstallment.status === 'overdue' ? (
                  <>
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Vencida
                  </>
                ) : (
                  'Pendiente'
                )}
              </Badge>
            </div>
          </div>
        </div>

        {/* Lista de todas las cuotas pendientes */}
        {pendingInstallments.length > 1 && (
          <div>
            <h5 className="font-medium mb-3">Todas las Cuotas Pendientes</h5>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {pendingInstallments.map((installment) => (
                <div 
                  key={installment.number}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <div className="text-sm font-medium">#{installment.number}</div>
                      {client.financingPlan && (
                        <div className="text-xs text-muted-foreground">
                          de {client.financingPlan}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {formatCurrency(installment.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Vence: {formatDate(installment.dueDate)}
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant={installment.status === 'overdue' ? "destructive" : "outline"}
                    className="text-xs"
                  >
                    {installment.status === 'overdue' ? 'Vencida' : 'Pendiente'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resumen */}
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total Pendiente:</span>
              <p className="font-semibold">
                {formatCurrency(pendingInstallments.reduce((sum, i) => sum + i.amount, 0))}
              </p>
            </div>
            {client.financingPlan && (
              <div>
                <span className="text-muted-foreground">Progreso:</span>
                <p className="font-semibold">
                  {client.paymentsMadeCount || 0} de {client.financingPlan} cuotas
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}