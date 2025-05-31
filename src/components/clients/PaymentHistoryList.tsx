'use client';

import { formatCurrency, formatDate } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle, Eye, LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PaymentRecord } from '@/types';

interface PaymentHistoryListProps {
  paymentHistory: PaymentRecord[];
}

export function PaymentHistoryList({ paymentHistory }: PaymentHistoryListProps) {
  if (!paymentHistory || paymentHistory.length === 0) {
    return <p className="text-muted-foreground text-center py-4">No hay pagos registrados para este cliente.</p>;
  }

  // ✅ Función para obtener el ícono del estado
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'validated':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
  };

  // ✅ Función para obtener el badge del estado
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'validated':
        return <Badge variant="default">Validado</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pendiente</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rechazado</Badge>;
      default:
        return <Badge variant="default">Validado</Badge>;
    }
  };

  return (
    <ScrollArea className="h-[400px] w-full rounded-md border">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha de Pago</TableHead>
            <TableHead className="text-right">Monto Pagado</TableHead>
            <TableHead className="hidden sm:table-cell">Registrado el</TableHead>
            <TableHead>Comprobante</TableHead>
            <TableHead>Factura Siigo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paymentHistory.map((payment) => {
            const paymentStatus = payment.status || 'validated';
            return (
              <TableRow key={payment.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(paymentStatus)}
                    {getStatusBadge(paymentStatus)}
                  </div>
                </TableCell>
                <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(payment.amountPaid)}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                  {formatDate(payment.recordedAt)}
                </TableCell>
                <TableCell>
                  {payment.proofUrl ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(payment.proofUrl, '_blank')}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {payment.siigoInvoiceUrl ? (
                    <a
                      href={payment.siigoInvoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <LinkIcon size={14} />
                      Ver Factura
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
