'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useIsClient } from '@/hooks/use-is-client';
import type { Client, PaymentRecord } from '@/types';

interface PaymentProgressChartProps {
  client: Client;
  paymentHistory: PaymentRecord[];
}

interface ProgressData {
  name: string;
  value: number;
  color: string;
  amount: number;
}

export default function PaymentProgressChart({ client, paymentHistory }: PaymentProgressChartProps) {
  const isClient = useIsClient();

  // Calcular progreso del plan
  const calculateProgress = () => {
    const validatedPayments = paymentHistory.filter(p => p.status === 'validated' || !p.status);
    
    let totalInstallments = 0;
    let totalAmount = 0;
    let paidInstallments = validatedPayments.length;
    let paidAmount = validatedPayments.reduce((sum, p) => sum + p.amountPaid, 0);
    
    if (client.financingPlan && client.financingPlan > 0) {
      // Plan de financiación definido
      totalInstallments = client.financingPlan;
      totalAmount = client.totalAmountWithInterest || (client.paymentAmount * client.financingPlan);
    } else if (client.contractValue && client.contractValue < 1000000) {
      // Contrato pequeño - pago único
      totalInstallments = 1;
      totalAmount = client.totalWithIva || client.contractValue;
    } else {
      // Plan recurrente - usar 12 cuotas como referencia
      totalInstallments = 12;
      totalAmount = client.paymentAmount * 12;
    }

    const remainingInstallments = Math.max(0, totalInstallments - paidInstallments);
    const remainingAmount = Math.max(0, totalAmount - paidAmount);
    const progressPercentage = totalInstallments > 0 ? (paidInstallments / totalInstallments) * 100 : 0;

    return {
      totalInstallments,
      paidInstallments,
      remainingInstallments,
      totalAmount,
      paidAmount,
      remainingAmount,
      progressPercentage
    };
  };

  const progress = calculateProgress();

  // Datos para el gráfico de pie
  const pieData: ProgressData[] = [
    {
      name: 'Cuotas Pagadas',
      value: progress.paidInstallments,
      color: '#22c55e',
      amount: progress.paidAmount
    },
    {
      name: 'Cuotas Pendientes',
      value: progress.remainingInstallments,
      color: '#64748b',
      amount: progress.remainingAmount
    }
  ];

  // Solo renderizar el gráfico en el cliente para evitar problemas de hidratación
  const renderChart = () => {
    if (!isClient) {
      return (
        <div className="flex items-center justify-center h-[200px]">
          <div className="animate-pulse rounded-full h-32 w-32 bg-muted"></div>
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: any, name: any, props: any) => [
              `${value} cuotas (${formatCurrency(props.payload.amount)})`,
              name
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          Progreso del Plan de Pagos
        </CardTitle>
        <CardDescription>
          Avance actual de tu plan de financiación o contrato
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico circular */}
          <div className="flex flex-col items-center">
            {renderChart()}
            
            {/* Leyenda personalizada */}
            <div className="flex gap-4 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-muted-foreground">Pagadas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-slate-500 rounded-full"></div>
                <span className="text-sm text-muted-foreground">Pendientes</span>
              </div>
            </div>
          </div>

          {/* Estadísticas detalladas */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progreso General</span>
                <span className="font-medium">{progress.progressPercentage.toFixed(1)}%</span>
              </div>
              <Progress value={progress.progressPercentage} className="h-3" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">Completado</span>
                </div>
                <p className="text-lg font-bold text-green-900">
                  {progress.paidInstallments}
                </p>
                <p className="text-xs text-green-600">
                  de {progress.totalInstallments} cuotas
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">Pendiente</span>
                </div>
                <p className="text-lg font-bold text-slate-900">
                  {progress.remainingInstallments}
                </p>
                <p className="text-xs text-slate-600">
                  cuotas restantes
                </p>
              </div>
            </div>

            <div className="pt-3 border-t">
              <h4 className="text-sm font-medium mb-3">Resumen Financiero</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total del Plan:</span>
                  <span className="font-medium">{formatCurrency(progress.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pagado:</span>
                  <span className="font-medium text-green-600">{formatCurrency(progress.paidAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saldo Pendiente:</span>
                  <span className="font-medium text-slate-600">{formatCurrency(progress.remainingAmount)}</span>
                </div>
              </div>
            </div>

            {progress.progressPercentage === 100 && (
              <div className="bg-green-100 border border-green-200 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    ¡Plan Completado Exitosamente!
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}