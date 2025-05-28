import AppLayout from '@/components/layout/app-layout';
import { ClientForm } from '@/components/clients/client-form';
import { getClientById } from '@/lib/store';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { generateReminderSubjectAction } from '@/app/actions/clientActions';
import EmailSubjectGenerator from '@/components/clients/email-subject-generator';

type EditClientPageProps = {
  params: { id: string };
};

export default async function EditClientPage({ params }: EditClientPageProps) {
  const client = await getClientById(params.id);

  if (!client) {
    notFound();
  }

  return (
    <AppLayout>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
           <ClientForm client={client} isEditMode={true} />
        </div>
        <div className="md:col-span-1">
            <EmailSubjectGenerator 
                clientName={`${client.firstName} ${client.lastName}`}
                paymentAmount={client.paymentAmount}
                nextPaymentDate={client.nextPaymentDate}
            />
        </div>
      </div>
    </AppLayout>
  );
}
