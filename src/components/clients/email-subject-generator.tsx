'use client';

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateReminderSubjectAction } from '@/app/actions/clientActions';
import { Textarea } from '@/components/ui/textarea';
import { getDaysUntilDue, formatDate } from '@/lib/utils';

interface EmailSubjectGeneratorProps {
  clientName: string;
  paymentAmount: number;
  nextPaymentDate: string;
}

export default function EmailSubjectGenerator({ clientName, paymentAmount, nextPaymentDate }: EmailSubjectGeneratorProps) {
  const [subject, setSubject] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const daysUntilDue = getDaysUntilDue(nextPaymentDate);

  const handleGenerateSubject = () => {
    setIsLoading(true);
    setSubject('');
    startTransition(async () => {
      const result = await generateReminderSubjectAction(clientName, paymentAmount, nextPaymentDate);
      if (result.success && result.subject) {
        setSubject(result.subject);
        toast({
          title: 'Subject Generated',
          description: 'AI has crafted a new email subject.',
        });
      } else {
        toast({
          title: 'Error Generating Subject',
          description: result.error || 'Could not generate email subject.',
          variant: 'destructive',
        });
      }
      setIsLoading(false);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Email Subject Generator</CardTitle>
        <CardDescription>
          Generate a reminder email subject for this client. Payment due on {formatDate(nextPaymentDate)} ({daysUntilDue >=0 ? `${daysUntilDue} days` : 'Overdue'}).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleGenerateSubject} disabled={isLoading || isPending || daysUntilDue < 0}>
          {(isLoading || isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Wand2 className="mr-2 h-4 w-4" />
          {daysUntilDue < 0 ? 'Cannot Generate (Overdue)' : 'Generate Subject'}
        </Button>
        {subject && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Generated Subject:</p>
            <Textarea value={subject} readOnly rows={2} className="bg-muted" />
          </div>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          AI helps create engaging subject lines based on payment proximity.
        </p>
      </CardFooter>
    </Card>
  );
}
