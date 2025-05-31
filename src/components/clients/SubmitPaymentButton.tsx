'use client';

import { useState, useTransition } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Loader2, Receipt, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { submitClientPaymentAction, updatePaymentWithProofUrl } from '@/app/actions/clientActions';
import { uploadFile } from '@/lib/uploadFile';
import type { Client } from '@/types';

interface SubmitPaymentButtonProps {
  client: Client;
}

export default function SubmitPaymentButton({ client }: SubmitPaymentButtonProps) {
  const [isProcessing, startTransition] = useTransition();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [amountPaid, setAmountPaid] = useState(client.paymentAmount || 0);
  const [notes, setNotes] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'registering' | 'uploading' | 'completed'>('idle');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tamaño de archivo (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Archivo muy grande",
          description: "El archivo no puede ser mayor a 5MB",
          variant: "destructive",
        });
        return;
      }
      
      // Validar tipo de archivo
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Tipo de archivo no permitido",
          description: "Solo se permiten archivos JPG, PNG o PDF",
          variant: "destructive",
        });
        return;
      }
      
      setProofFile(file);
    }
  };

  const handleSubmitPayment = async () => {
    if (!proofFile) {
      toast({
        title: "Comprobante requerido",
        description: "Por favor, suba un comprobante de pago",
        variant: "destructive",
      });
      return;
    }

    if (amountPaid <= 0) {
      toast({
        title: "Monto inválido",
        description: "El monto debe ser mayor a 0",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      try {
        setUploadProgress('registering');

        const formData = new FormData();
        formData.append('clientId', client.id);
        formData.append('paymentDate', paymentDate);
        formData.append('amountPaid', amountPaid.toString());
        formData.append('notes', notes);
        formData.append('proofFile', proofFile);

        // Paso 1: Registrar el pago en el servidor
        const result = await submitClientPaymentAction(formData);
        
        if (!result.success) {
          toast({
            title: "Error al registrar pago",
            description: result.error || "No se pudo registrar el pago",
            variant: "destructive",
          });
          setUploadProgress('idle');
          return;
        }

        // Paso 2: Subir el archivo desde el cliente
        setUploadProgress('uploading');
        
        try {
          const proofUrl = await uploadFile(proofFile, `payment-proofs/${client.id}`);
          
          // Paso 3: Actualizar el pago con la URL del comprobante
          const updateResult = await updatePaymentWithProofUrl(result.paymentId!, client.id, proofUrl);
          
          if (updateResult.success) {
            setUploadProgress('completed');
            toast({
              title: "Pago enviado exitosamente",
              description: "Su pago ha sido enviado para validación. Recibirá una notificación cuando sea procesado.",
            });
            
            // Limpiar formulario después de un breve delay
            setTimeout(() => {
              setIsDialogOpen(false);
              setProofFile(null);
              setNotes('');
              setAmountPaid(client.paymentAmount || 0);
              setUploadProgress('idle');
            }, 2000);
          } else {
            throw new Error(updateResult.error || 'Error al actualizar comprobante');
          }
        } catch (uploadError) {
          console.error('Error uploading file:', uploadError);
          toast({
            title: "Error al subir comprobante",
            description: "El pago se registró pero hubo un error al subir el comprobante. Por favor, inténtelo de nuevo.",
            variant: "destructive",
          });
          setUploadProgress('idle');
        }
      } catch (error) {
        console.error("Error submitting payment:", error);
        toast({
          title: "Error inesperado",
          description: "Ocurrió un error al enviar el pago. Verifique su conexión e inténtelo de nuevo.",
          variant: "destructive",
        });
        setUploadProgress('idle');
      }
    });
  };

  if (client.status === 'completed') {
    return null;
  }

  const getProgressText = () => {
    switch (uploadProgress) {
      case 'registering':
        return 'Registrando pago...';
      case 'uploading':
        return 'Subiendo comprobante...';
      case 'completed':
        return '¡Completado!';
      default:
        return 'Enviar';
    }
  };

  const getProgressIcon = () => {
    switch (uploadProgress) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 mr-2" />;
      case 'registering':
      case 'uploading':
        return <Loader2 className="h-4 w-4 mr-2 animate-spin" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <Receipt className="h-4 w-4 mr-2" />
          Reportar Pago
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reportar Pago Realizado</DialogTitle>
          <DialogDescription>
            Complete la información de su pago para que sea validado por nuestro equipo.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="paymentDate">Fecha del Pago</Label>
            <Input
              id="paymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              disabled={isProcessing}
            />
          </div>

          <div>
            <Label htmlFor="amountPaid">Monto Pagado</Label>
            <Input
              id="amountPaid"
              type="number"
              min="0"
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
              disabled={isProcessing}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Monto esperado: {formatCurrency(client.paymentAmount || 0)}
            </p>
          </div>

          <div>
            <Label htmlFor="proofFile">Comprobante de Pago *</Label>
            <Input
              id="proofFile"
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              disabled={isProcessing}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Suba una imagen o PDF del comprobante (máx. 5MB)
            </p>
            {proofFile && (
              <p className="text-xs text-green-600 mt-1">
                ✓ {proofFile.name}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="notes">Notas adicionales (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Información adicional sobre el pago..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isProcessing}
              rows={3}
            />
          </div>

          {uploadProgress !== 'idle' && (
            <Card className="bg-blue-50">
              <CardContent className="pt-4">
                <div className="flex items-center space-x-2">
                  {getProgressIcon()}
                  <span className="text-sm font-medium text-blue-800">
                    {getProgressText()}
                  </span>
                </div>
                {uploadProgress === 'completed' && (
                  <p className="text-xs text-blue-600 mt-2">
                    ✓ Su pago ha sido enviado para validación exitosamente
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="bg-blue-50">
            <CardContent className="pt-4">
              <p className="text-sm text-blue-800">
                <strong>Importante:</strong> Su pago será revisado por nuestro equipo en un plazo de 24-48 horas. 
                Recibirá una notificación por email cuando sea validado o si requiere alguna corrección.
              </p>
            </CardContent>
          </Card>

          <div className="flex gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              disabled={isProcessing}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmitPayment}
              disabled={isProcessing || !proofFile || uploadProgress === 'completed'}
              className="flex-1"
            >
              {getProgressIcon()}
              {getProgressText()}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}