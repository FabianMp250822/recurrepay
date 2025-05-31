'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CreateTicketForm } from '@/components/tickets/create-ticket-form';
import { ClientTicketsList } from '@/components/tickets/client-tickets-list';
import { TicketDetailView } from '@/components/tickets/ticket-detail-view';
import { Ticket } from '@/types/ticket';
import { Plus, ArrowLeft } from 'lucide-react';
import ClientLayout from '@/components/layout/client-layout';

type ViewMode = 'list' | 'create' | 'detail';

export default function ClientTicketsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleTicketCreated = () => {
    setViewMode('list');
    setRefreshTrigger(prev => prev + 1); // Trigger refresh of tickets list
  };

  const handleTicketSelect = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setViewMode('detail');
  };

  const handleTicketUpdate = (updatedTicket: Ticket) => {
    setSelectedTicket(updatedTicket);
    setRefreshTrigger(prev => prev + 1); // Trigger refresh of tickets list
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedTicket(null);
  };

  return (
    <ClientLayout>
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {viewMode === 'create' ? 'Nueva Solicitud' : 
                 viewMode === 'detail' ? 'Detalle de Solicitud' : 
                 'Mis Solicitudes'}
              </h1>
              <p className="mt-2 text-sm sm:text-base text-muted-foreground">
                {viewMode === 'create' ? 'Crea una nueva consulta o solicitud' :
                 viewMode === 'detail' ? 'Conversación con el equipo de soporte' :
                 'Gestiona tus consultas y solicitudes de soporte'}
              </p>
            </div>
            
            {viewMode === 'list' && (
              <Button onClick={() => setViewMode('create')}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Solicitud
              </Button>
            )}
            
            {(viewMode === 'create' || viewMode === 'detail') && (
              <Button variant="outline" onClick={handleBackToList}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {viewMode === 'list' && (
          <ClientTicketsList 
            onTicketSelect={handleTicketSelect}
            selectedTicketId={selectedTicket?.id}
            key={refreshTrigger} // Force re-render when tickets are updated
          />
        )}

        {viewMode === 'create' && (
          <CreateTicketForm onTicketCreated={handleTicketCreated} />
        )}

        {viewMode === 'detail' && selectedTicket && (
          <TicketDetailView 
            ticket={selectedTicket}
            onBack={handleBackToList}
            onTicketUpdate={handleTicketUpdate}
          />
        )}

        {viewMode === 'list' && (
          <Card className="mt-6">
            <CardContent className="text-center py-8">
              <h3 className="text-lg font-medium mb-2">¿Necesitas ayuda?</h3>
              <p className="text-muted-foreground mb-4">
                Nuestro equipo de soporte está aquí para ayudarte con cualquier consulta
              </p>
              <Button onClick={() => setViewMode('create')}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Nueva Solicitud
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </ClientLayout>
  );
}