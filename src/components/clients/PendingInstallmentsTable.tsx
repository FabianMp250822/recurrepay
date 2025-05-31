'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, CreditCard, AlertCircle, CheckCircle, Receipt } from 'lucide-react';
import { formatCurrency, formatDate, calculatePendingInstallments } from '@/lib/utils';
import type { Client, PaymentRecord, PendingInstallment } from '@/types';
import SubmitPaymentButton from './SubmitPaymentButton';

interface PendingInstallmentsTableProps {
  client: Client;
  paymentHistory: PaymentRecord[];
  onPaymentSubmitted?: () => void;
}

export default function PendingInstallmentsTable({ 
  client, 
  paymentHistory,
  onPaymentSubmitted 
}: PendingInstallmentsTableProps) {
  const pendingInstallments = calculatePendingInstallments(client, paymentHistory);
  
  if (client.status === 'completed') {
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

  if (pendingInstallments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sin Cuotas Pendientes</CardTitle>
          <CardDescription>
            No hay cuotas pendientes por pagar en este momento.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const overduePendingCount = pendingInstallments.filter(i => i.status === 'overdue').length;
  const totalPendingAmount = pendingInstallments.reduce((sum, i) => sum + i.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Cuotas Pendientes de Pago
          <Badge variant={overduePendingCount > 0 ? "destructive" : "secondary"}>
            {pendingInstallments.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          {client.financingPlan && client.financingPlan > 0 
            ? `Plan de ${client.financingPlan} cuotas - ${client.paymentsMadeCount || 0} pagadas, ${pendingInstallments.length} pendientes`
            : `${pendingInstallments.length} pagos pendientes por realizar`
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Resumen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-700">Total Pendiente</h4>
            <p className="text-2xl font-bold text-blue-900">
              {formatCurrency(totalPendingAmount)}
            </p>
          </div>
          
          {overduePendingCount > 0 && (
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="font-semibold text-red-700">Cuotas Vencidas</h4>
              <p className="text-2xl font-bold text-red-900">
                {overduePendingCount}
              </p>
            </div>
          )}
          
          {client.financingPlan && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-700">Progreso</h4>
              <p className="text-2xl font-bold text-green-900">
                {Math.round(((client.paymentsMadeCount || 0) / client.financingPlan) * 100)}%
              </p>
              <p className="text-sm text-green-600">
                {client.paymentsMadeCount || 0} de {client.financingPlan}
              </p>
            </div>
          )}
        </div>

        {/* Tabla de cuotas */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-20">Cuota</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Fecha Vencimiento</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="w-24">Estado</TableHead>
                <TableHead className="w-32 text-center">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingInstallments.map((installment) => (
                <TableRow 
                  key={installment.number}
                  className={installment.status === 'overdue' ? 'bg-red-50' : ''}
                >
                  <TableCell>
                    <div className="text-center">
                      <div className="font-semibold text-lg">
                        #{installment.number}
                      </div>
                      {client.financingPlan && (
                        <div className="text-xs text-muted-foreground">
                          de {client.financingPlan}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div>
                      <p className="font-medium">{installment.description}</p>
                      {installment.number === 1 && client.financingPlan && (
                        <p className="text-xs text-blue-600">
                          Primera cuota del plan
                        </p>
                      )}
                      {installment.status === 'overdue' && (
                        <div className="flex items-center gap-1 text-red-600 text-xs mt-1">
                          <AlertCircle className="h-3 w-3" />
                          Pago vencido
                        </div>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className={installment.status === 'overdue' ? 'text-red-600 font-medium' : ''}>
                        {formatDate(installment.dueDate)}
                      </span>
                    </div>
                    {installment.status === 'overdue' && (
                      <p className="text-xs text-red-500 mt-1">
                        Vencida hace {Math.floor((Date.now() - new Date(installment.dueDate).getTime()) / (1000 * 60 * 60 * 24))} días
                      </p>
                    )}
                  </TableCell>
                  
                  <TableCell className="text-right">
                    <div className="font-semibold text-lg">
                      {formatCurrency(installment.amount)}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <Badge 
                      variant={installment.status === 'overdue' ? "destructive" : "outline"}
                      className="text-xs"
                    >
                      {installment.status === 'overdue' ? (
                        <>
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Vencida
                        </>
                      ) : (
                        'Pendiente'
                      )}
                    </Badge>
                  </TableCell>
                  
                  <TableCell>
                    <SubmitPaymentButton 
                      client={client}
                      specificInstallment={{
                        number: installment.number,
                        amount: installment.amount,
                        dueDate: installment.dueDate,
                        description: installment.description,
                        isOverdue: installment.status === 'overdue'
                      }}
                      onPaymentSubmitted={onPaymentSubmitted}
                      variant="table-row"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Nota informativa */}
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h5 className="font-medium text-blue-800 mb-2">Información Importante:</h5>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Puede pagar cualquier cuota haciendo clic en "Reportar Pago"</li>
            <li>• Los pagos serán validados por nuestro equipo en 24-48 horas</li>
            <li>• Las cuotas vencidas pueden generar intereses adicionales</li>
            <li>• Puede pagar múltiples cuotas por adelantado</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}