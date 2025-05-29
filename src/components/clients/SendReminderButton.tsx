
'use client';
import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Mail, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendPaymentReminderEmailAction } from '@/app/actions/clientActions';
import type { Client } from '@/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface SendReminderButtonProps {
  client: Client;
  daysUntilDue: number; // daysUntilDue is now explicitly passed
}

export default function SendReminderButton({ client, daysUntilDue }: SendReminderButtonProps) {
  const [isSending, startTransition] = useTransition(); // Use useTransition for pending state
  const { toast } = useToast();

  const handleSendReminder = async () => {
    startTransition(async () => {
      try {
        const result = await sendPaymentReminderEmailAction(client);
        if (result.success) {
          toast({
            title: 'Recordatorio Enviado',
            description: result.message || `Correo de recordatorio de pago enviado a ${client.email}.`,
            variant: 'default',
          });
        } else {
          toast({
            title: 'Error al Enviar Recordatorio',
            description: result.error || 'No se pudo enviar el recordatorio de pago.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error("Error en SendReminderButton:", error);
        toast({
          title: 'Error del Cliente',
          description: 'Ocurrió un error inesperado al intentar enviar el recordatorio.',
          variant: 'destructive',
        });
      }
    });
  };

  // Button is active if within -5 to +5 days due window
  const isReminderPeriodActive = daysUntilDue >= -5 && daysUntilDue <= 5;
  const isDisabled = isSending || !isReminderPeriodActive;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={handleSendReminder}
            disabled={isDisabled}
            aria-label={`Enviar recordatorio de pago a ${client.firstName} ${client.lastName}`}
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isReminderPeriodActive ? <p>Enviar Recordatorio por Correo</p> : <p>Recordatorio por correo no aplicable en esta fecha</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
