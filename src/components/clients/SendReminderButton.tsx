
'use client';
import React, { useState } from 'react';
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
}

export default function SendReminderButton({ client }: SendReminderButtonProps) {
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const handleSendReminder = async () => {
    setIsSending(true);
    try {
      const result = await sendPaymentReminderEmailAction(client);
      if (result.success) {
        toast({
          title: 'Reminder Sent',
          description: result.message || `Payment reminder email sent to ${client.email}.`,
          variant: 'default', // Use 'default' which has a green accent in this theme
        });
      } else {
        toast({
          title: 'Error Sending Reminder',
          description: result.error || 'Could not send payment reminder.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error("Error in SendReminderButton:", error);
      toast({
        title: 'Client-side Error',
        description: 'An unexpected error occurred while trying to send the reminder.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={handleSendReminder}
            disabled={isSending}
            aria-label={`Send payment reminder to ${client.firstName} ${client.lastName}`}
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Send Payment Reminder</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
