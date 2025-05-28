
import AppLayout from '@/components/layout/app-layout';
import { ClientForm } from '@/components/clients/client-form';
import { getClientById } from '@/lib/store';
import { notFound } from 'next/navigation';

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
      <div className="max-w-2xl mx-auto">
        <ClientForm client={client} isEditMode={true} />
      </div>
    </AppLayout>
  );
}
