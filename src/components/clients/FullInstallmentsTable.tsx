'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, CreditCard, AlertCircle, CheckCircle, Receipt, Clock, DollarSign } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { addMonths, parseISO, setDate, getDaysInMonth, isAfter } from 'date-fns';
import type { Client, PaymentRecord } from '@/types';
import SubmitPaymentButton from './SubmitPaymentButton';

interface FullInstallment {
  number: number;
  dueDate: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  paymentRecord?: PaymentRecord;
  remainingBalance: number;
}

interface FullInstallmentsTableProps {
  client: Client;
  paymentHistory: PaymentRecord[];
  onPaymentSubmitted?: () => void;
}

export default function FullInstallmentsTable({ 
  client, 
  paymentHistory,
  onPaymentSubmitted 
}: FullInstallmentsTableProps) {
  
  // Calcular todas las cuotas del contrato
  const calculateAllInstallments = (): FullInstallment[] => {
    const installments: FullInstallment[] = [];
    
    // Solo mostrar tabla si hay un plan de financiación o contrato
    if (!client.financingPlan && !client.contractValue) {
      return [];
    }

    // Determinar el número total de cuotas
    let totalInstallments: number;
    let installmentAmount: number;
    let totalAmountToPay: number;

    if (client.financingPlan && client.financingPlan > 0) {
      // Plan de financiación con cuotas definidas
      totalInstallments = client.financingPlan;
      installmentAmount = client.paymentAmount || 0;
      totalAmountToPay = client.totalAmountWithInterest || client.amountToFinance || 0;
    } else if (client.contractValue && client.contractValue < 1000000) {
      // Contrato pequeño - pago único
      totalInstallments = 1;
      installmentAmount = client.totalWithIva || client.contractValue;
      totalAmountToPay = installmentAmount;
    } else {
      // Pago recurrente sin plan definido - mostrar solo próximas 12 cuotas
      totalInstallments = 12;
      installmentAmount = client.paymentAmount || 0;
      totalAmountToPay = installmentAmount * totalInstallments;
    }

    // Obtener pagos validados ordenados por fecha
    const validatedPayments = paymentHistory
      .filter(p => p.status === 'validated' || !p.status)
      .sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());

    // Generar todas las cuotas
    let currentDate = parseISO(client.nextPaymentDate);
    
    // Retroceder para calcular fechas anteriores según pagos realizados
    const paymentsMade = validatedPayments.length;
    for (let i = 0; i < paymentsMade; i++) {
      currentDate = addMonths(currentDate, -1);
    }

    let remainingBalance = totalAmountToPay;

    for (let i = 1; i <= totalInstallments; i++) {
      // Ajustar fecha
      if (i > 1) {
        currentDate = addMonths(currentDate, 1);
        const targetDay = client.paymentDayOfMonth || new Date(currentDate).getDate();
        const daysInMonth = getDaysInMonth(currentDate);
        currentDate = setDate(currentDate, Math.min(targetDay, daysInMonth));
      }

      // Buscar pago correspondiente a esta cuota
      const paymentRecord = validatedPayments[i - 1];
      
      let status: 'paid' | 'pending' | 'overdue';
      if (paymentRecord) {
        status = 'paid';
        remainingBalance -= paymentRecord.amountPaid;
      } else if (isAfter(new Date(), currentDate)) {
        status = 'overdue';
      } else {
        status = 'pending';
      }

      installments.push({
        number: i,
        dueDate: currentDate.toISOString(),
        amount: installmentAmount,
        status,
        paymentRecord,
        remainingBalance: Math.max(0, remainingBalance)
      });
    }

    return installments;
  };

  const allInstallments = calculateAllInstallments();

  if (allInstallments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plan de Pagos</CardTitle>
          <CardDescription>
            No hay un plan de cuotas definido para este cliente.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Estadísticas
  const paidCount = allInstallments.filter(i => i.status === 'paid').length;
  const pendingCount = allInstallments.filter(i => i.status === 'pending').length;
  const overdueCount = allInstallments.filter(i => i.status === 'overdue').length;
  const totalPaid = allInstallments
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + (i.paymentRecord?.amountPaid || 0), 0);
  const totalPending = allInstallments
    .filter(i => i.status !== 'paid')
    .reduce((sum, i) => sum + i.amount, 0);

  const progressPercentage = client.financingPlan 
    ? Math.round((paidCount / client.financingPlan) * 100)
    : client.contractValue && client.contractValue < 1000000 && paidCount > 0 
    ? 100 
    : Math.round((paidCount / Math.max(paidCount + pendingCount + overdueCount, 1)) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Plan Completo de Cuotas
          <Badge variant="outline">
            {paidCount} de {allInstallments.length} pagadas
          </Badge>
        </CardTitle>
        <CardDescription>
          {client.financingPlan 
            ? `Plan de financiación de ${client.financingPlan} cuotas`
            : client.contractValue && client.contractValue < 1000000
            ? 'Contrato de pago único'
            : 'Plan de pagos recurrentes'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Resumen financiero */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h4 className="font-semibold text-green-700">Pagado</h4>
            </div>
            <p className="text-2xl font-bold text-green-900">
              {formatCurrency(totalPaid)}
            </p>
            <p className="text-sm text-green-600">
              {paidCount} cuotas completadas
            </p>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              <h4 className="font-semibold text-blue-700">Pendiente</h4>
            </div>
            <p className="text-2xl font-bold text-blue-900">
              {formatCurrency(totalPending)}
            </p>
            <p className="text-sm text-blue-600">
              {pendingCount + overdueCount} cuotas restantes
            </p>
          </div>

          {overdueCount > 0 && (
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <h4 className="font-semibold text-red-700">Vencidas</h4>
              </div>
              <p className="text-2xl font-bold text-red-900">
                {overdueCount}
              </p>
              <p className="text-sm text-red-600">
                Requieren atención inmediata
              </p>
            </div>
          )}
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              <h4 className="font-semibold text-purple-700">Progreso</h4>
            </div>
            <p className="text-2xl font-bold text-purple-900">
              {progressPercentage}%
            </p>
            <p className="text-sm text-purple-600">
              Del plan completado
            </p>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Progreso del Plan</span>
            <span>{paidCount} / {allInstallments.length}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-green-500 h-3 rounded-full transition-all duration-300" 
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Tabla de cuotas */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-20">Cuota</TableHead>
                <TableHead>Fecha Vencimiento</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Saldo Restante</TableHead>
                <TableHead className="w-32 text-center">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allInstallments.map((installment) => (
                <TableRow 
                  key={installment.number}
                  className={
                    installment.status === 'paid' ? 'bg-green-50' :
                    installment.status === 'overdue' ? 'bg-red-50' : ''
                  }
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
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className={installment.status === 'overdue' ? 'text-red-600 font-medium' : ''}>
                          {formatDate(installment.dueDate)}
                        </div>
                        {installment.status === 'paid' && installment.paymentRecord && (
                          <div className="text-xs text-green-600">
                            Pagado: {formatDate(installment.paymentRecord.paymentDate)}
                          </div>
                        )}
                        {installment.status === 'overdue' && (
                          <div className="text-xs text-red-500">
                            Vencida hace {Math.floor((Date.now() - new Date(installment.dueDate).getTime()) / (1000 * 60 * 60 * 24))} días
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-right">
                    <div className="font-semibold text-lg">
                      {installment.status === 'paid' && installment.paymentRecord 
                        ? formatCurrency(installment.paymentRecord.amountPaid)
                        : formatCurrency(installment.amount)
                      }
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    {installment.status === 'paid' ? (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Pagada
                      </Badge>
                    ) : installment.status === 'overdue' ? (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Vencida
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        Pendiente
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="font-medium text-blue-700">
                      {formatCurrency(installment.remainingBalance)}
                    </div>
                    {installment.remainingBalance === 0 && (
                      <div className="text-xs text-green-600">
                        ¡Completado!
                      </div>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    {installment.status !== 'paid' ? (
                      <SubmitPaymentButton 
                        client={client}
                        specificInstallment={{
                          number: installment.number,
                          amount: installment.amount,
                          dueDate: installment.dueDate,
                          description: `Cuota ${installment.number}${client.financingPlan ? ` de ${client.financingPlan}` : ''}`,
                          isOverdue: installment.status === 'overdue'
                        }}
                        onPaymentSubmitted={onPaymentSubmitted}
                        variant="table-row"
                      />
                    ) : (
                      <div className="text-center">
                        <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                        <div className="text-xs text-green-600 mt-1">
                          Completada
                        </div>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Información adicional */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h5 className="font-medium text-blue-800 mb-2">Información del Contrato:</h5>
            <ul className="text-sm text-blue-700 space-y-1">
              {client.contractValue && (
                <li>• Valor del contrato: {formatCurrency(client.contractValue)}</li>
              )}
              {client.totalWithIva && (
                <li>• Total con IVA: {formatCurrency(client.totalWithIva)}</li>
              )}
              {client.downPayment && (
                <li>• Abono inicial: {formatCurrency(client.downPayment)} ({client.downPaymentPercentage}%)</li>
              )}
              {client.amountToFinance && (
                <li>• Monto financiado: {formatCurrency(client.amountToFinance)}</li>
              )}
              {client.financingInterestAmount && (
                <li>• Intereses: {formatCurrency(client.financingInterestAmount)} ({((client.financingInterestRateApplied || 0) * 100).toFixed(1)}%)</li>
              )}
            </ul>
          </div>

          <div className="p-4 bg-green-50 rounded-lg">
            <h5 className="font-medium text-green-800 mb-2">Estado del Plan:</h5>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• Cuotas pagadas: {paidCount} de {allInstallments.length}</li>
              <li>• Progreso: {progressPercentage}%</li>
              <li>• Total pagado: {formatCurrency(totalPaid)}</li>
              <li>• Saldo pendiente: {formatCurrency(totalPending)}</li>
              {client.status === 'completed' && (
                <li className="font-medium">• ¡Plan completado exitosamente!</li>
              )}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}