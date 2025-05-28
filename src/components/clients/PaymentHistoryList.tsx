
'use client';

import type { PaymentRecord } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PaymentHistoryListProps {
  paymentHistory: PaymentRecord[];
}

export function PaymentHistoryList({ paymentHistory }: PaymentHistoryListProps) {
  if (!paymentHistory || paymentHistory.length === 0) {
    return <p className="text-muted-foreground text-center py-4">No hay pagos registrados para este cliente.</p>;
  }

  return (
    <ScrollArea className="h-[300px] w-full rounded-md border">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead>Fecha de Pago</TableHead>
            <TableHead className="text-right">Monto Pagado</TableHead>
            <TableHead className="hidden sm:table-cell">Registrado el</TableHead>
            {/* <TableHead>Notas</TableHead> */}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paymentHistory.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell>{formatDate(payment.paymentDate)}</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(payment.amountPaid)}</TableCell>
              <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                {formatDate(payment.recordedAt)}
              </TableCell>
              {/* <TableCell>{payment.notes || '-'}</TableCell> */}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
