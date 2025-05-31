'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CheckCircle, XCircle, Eye, Clock, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import { validatePaymentAction } from '@/app/actions/clientActions';
import type { PaymentRecord } from '@/types';

interface PendingPaymentsPanelProps {
  pendingPayments: (PaymentRecord & { clientName: string; clientEmail: string })[];
  onPaymentProcessed?: () => void; // ✅ NUEVO: Callback para recargar datos
}

export default function PendingPaymentsPanel({ pendingPayments, onPaymentProcessed }: PendingPaymentsPanelProps) {
  const [isProcessing, startTransition] = useTransition();
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleValidatePayment = (paymentId: string, clientId: string, action: 'validate' | 'reject') => {
    startTransition(async () => {
      try {
        const result = await validatePaymentAction(
          paymentId, 
          clientId, 
          action,
          action === 'reject' ? rejectionReason : undefined
        );
        
        if (result.success) {
          toast({
            title: action === 'validate' ? "Pago Validado" : "Pago Rechazado",
            description: result.message,
          });
          setDialogOpen(false);
          setRejectionReason('');
          setSelectedPayment(null);
          
          // ✅ NUEVO: Llamar callback para recargar datos
          if (onPaymentProcessed) {
            onPaymentProcessed();
          }
        } else {
          toast({
            title: "Error",
            description: result.error || "No se pudo procesar la validación",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Error inesperado",
          description: "Ocurrió un error al procesar la validación",
          variant: "destructive",
        });
      }
    });
  };

  if (pendingPayments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pagos Pendientes de Validación
          </CardTitle>
          <CardDescription>
            No hay pagos pendientes de validación
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <p className="text-muted-foreground">
              ¡Excelente! No hay pagos pendientes por revisar.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Pagos Pendientes de Validación
          <Badge variant="secondary">{pendingPayments.length}</Badge>
        </CardTitle>
        <CardDescription>
          Pagos enviados por clientes que requieren validación
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pendingPayments.map((payment) => (
            <Card key={payment.id} className="border-l-4 border-l-yellow-500">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <h4 className="font-semibold">{payment.clientName}</h4>
                      <Badge variant="secondary">Pendiente</Badge>
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
                        <span className="font-medium">Enviado:</span> {formatDate(payment.recordedAt)}
                      </div>
                      <div>
                        <span className="font-medium">Archivo:</span> {payment.proofFileName}
                      </div>
                      {/* ✅ NUEVO: Mostrar información de cuota */}
                      {payment.installmentNumber && (
                        <div className="col-span-2">
                          <span className="font-medium">Cuota:</span> #{payment.installmentNumber}
                          {payment.totalInstallments && ` de ${payment.totalInstallments}`}
                          {payment.installmentType && ` (${payment.installmentType === 'single' ? 'Pago único' : 'Mensual'})`}
                        </div>
                      )}
                    </div>
                    
                    {payment.notes && (
                      <div className="mt-2">
                        <span className="font-medium text-sm">Notas:</span>
                        <p className="text-sm text-muted-foreground bg-muted p-2 rounded mt-1">
                          {payment.notes}
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
                    
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleValidatePayment(payment.id, payment.clientId!, 'validate')}
                      disabled={isProcessing}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Validar
                    </Button>
                    
                    <Dialog open={dialogOpen && selectedPayment?.id === payment.id} onOpenChange={setDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setSelectedPayment(payment)}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Rechazar
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Rechazar Pago</DialogTitle>
                          <DialogDescription>
                            Especifique el motivo del rechazo para {payment.clientName}
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                          <Textarea
                            placeholder="Motivo del rechazo (ej: Comprobante ilegible, monto incorrecto, etc.)"
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                          />
                          
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              onClick={() => {
                                setDialogOpen(false);
                                setRejectionReason('');
                                setSelectedPayment(null);
                              }}
                            >
                              Cancelar
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => handleValidatePayment(payment.id, payment.clientId!, 'reject')}
                              disabled={isProcessing || !rejectionReason.trim()}
                            >
                              Rechazar Pago
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
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