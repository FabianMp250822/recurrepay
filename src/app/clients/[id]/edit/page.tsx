
import AppLayout from '@/components/layout/app-layout';
import { ClientForm } from '@/components/clients/client-form';
import { getClientById, getPaymentHistory } from '@/lib/store';
import { notFound } from 'next/navigation';
import { PaymentHistoryList } from '@/components/clients/PaymentHistoryList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PaymentRecord } from '@/types';

type EditClientPageProps = {
  params: { id: string };
};

export default async function EditClientPage({ params }: EditClientPageProps) {
  const client = await getClientById(params.id);

  if (!client) {
    notFound();
  }

  let paymentHistory: PaymentRecord[] = [];
  try {
    paymentHistory = await getPaymentHistory(params.id);
  } catch (error) {
    console.error("Error fetching payment history for edit page:", error);
    // Optionally, show a message to the user or handle gracefully
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <ClientForm client={client} isEditMode={true} />
        
        <Card>
          <CardHeader>
            <CardTitle>Historial de Pagos</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentHistoryList paymentHistory={paymentHistory} />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
