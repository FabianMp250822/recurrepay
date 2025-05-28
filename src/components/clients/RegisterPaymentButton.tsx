
'use client';

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { registerPaymentAction } from '@/app/actions/clientActions';
import type { Client } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency } from '@/lib/utils';

interface RegisterPaymentButtonProps {
  client: Client;
}

export default function RegisterPaymentButton({ client }: RegisterPaymentButtonProps) {
  const [isProcessing, startTransition] = useTransition();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleRegisterPayment = async () => {
    startTransition(async () => {
      try {
        const result = await registerPaymentAction(client.id);
        if (result.success) {
          toast({
            title: 'Pago Registrado',
            description: result.message || `Pago registrado exitosamente para ${client.firstName} ${client.lastName}.`,
            variant: 'default',
          });
        } else {
          toast({
            title: 'Error al Registrar Pago',
            description: result.error || 'No se pudo registrar el pago.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error("Error en RegisterPaymentButton:", error);
        toast({
          title: 'Error del Cliente',
          description: 'Ocurrió un error inesperado al intentar registrar el pago.',
          variant: 'destructive',
        });
      } finally {
        setIsDialogOpen(false);
      }
    });
  };

  if (client.status === 'completed' || client.paymentAmount === 0) {
    return null; // Do not show button if payments are completed
  }

  return (
    <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
                disabled={isProcessing}
                aria-label={`Registrar pago para ${client.firstName} ${client.lastName}`}
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              </Button>
            </AlertDialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Registrar Pago</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar Registro de Pago</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Está seguro de que desea registrar un pago de <strong>{formatCurrency(client.paymentAmount)}</strong> para el cliente <strong>{client.firstName} {client.lastName}</strong>?
            Esta acción actualizará la próxima fecha de pago y el historial del cliente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRegisterPayment}
            disabled={isProcessing}
            className="bg-primary hover:bg-primary/90"
          >
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Pago
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
