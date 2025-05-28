
import AppLayout from '@/components/layout/app-layout';
import { ClientForm } from '@/components/clients/client-form';

export default function NewClientPage() {
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <ClientForm isEditMode={false} />
      </div>
    </AppLayout>
  );
}
