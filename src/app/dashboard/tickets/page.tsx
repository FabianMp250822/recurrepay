'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Ticket } from '@/types/ticket';
import { MessageCircle, Search, Filter, X, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAllTickets } from '@/lib/store';
import AppLayout from '@/components/layout/app-layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

export default function TicketsPage() {
  const { isAdmin, initialLoadComplete } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialLoadComplete && isAdmin) {
      loadTickets();
    }
  }, [initialLoadComplete, isAdmin]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      const ticketsData = await getAllTickets();
      setTickets(ticketsData);
    } catch (error) {
      console.error('Error loading tickets:', error);
      setError('Error al cargar los tickets');
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = tickets.filter(ticket =>
    ticket.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.clientEmail?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'recibida': { variant: 'default' as const, label: 'Recibida' },
      'en_progreso': { variant: 'secondary' as const, label: 'En Progreso' },
      'resuelta': { variant: 'outline' as const, label: 'Resuelta' },
      'cerrada': { variant: 'destructive' as const, label: 'Cerrada' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['recibida'];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      'baja': { variant: 'outline' as const, label: 'Baja' },
      'media': { variant: 'secondary' as const, label: 'Media' },
      'alta': { variant: 'destructive' as const, label: 'Alta' },
    };
    
    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig['media'];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Estados de carga y error
  if (!initialLoadComplete) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-muted-foreground">Verificando acceso...</p>
        </div>
      </AppLayout>
    );
  }

  if (loading && initialLoadComplete) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-muted-foreground">Cargando tickets...</p>
        </div>
      </AppLayout>
    );
  }

  if (error && initialLoadComplete) {
    return (
      <AppLayout>
        <Alert variant="destructive" className="my-4">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error al Cargar Tickets</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  if (!isAdmin && initialLoadComplete) {
    return (
      <AppLayout>
        <Alert variant="destructive" className="my-4">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Acceso Denegado</AlertTitle>
          <AlertDescription>
            No tiene permisos de administrador para ver esta página.
          </AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Contenedor principal que se ajusta según si hay ticket seleccionado */}
      <div className="flex h-[calc(100vh-8rem)]">
        {/* Panel principal de tickets */}
        <div className={cn(
          "transition-all duration-300 bg-background",
          selectedTicket ? "w-1/2" : "w-full"
        )}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-100 px-6 py-8 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <MessageCircle className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Tickets</h1>
            </div>
            <p className="text-gray-600">Gestione los tickets de soporte de sus clientes.</p>
          </div>

          {/* Contenido */}
          <div className="px-6">
            {/* Sección de tickets */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Tickets de Soporte</h2>
              </div>

              {/* Búsqueda y filtros */}
              <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por asunto, cliente o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                </Button>
              </div>

              {/* Lista de tickets */}
              {filteredTickets.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No hay tickets disponibles</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[50vh] overflow-y-auto">
                  {filteredTickets.map((ticket) => (
                    <Card 
                      key={ticket.id} 
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-md hover:border-blue-300",
                        selectedTicket?.id === ticket.id && "border-blue-500 bg-blue-50/50"
                      )}
                      onClick={() => setSelectedTicket(ticket)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-lg text-gray-900">
                            {ticket.subject || 'Sin asunto'}
                          </CardTitle>
                          <div className="flex gap-2">
                            {getStatusBadge(ticket.status || 'recibida')}
                            {getPriorityBadge(ticket.priority || 'media')}
                          </div>
                        </div>
                        <CardDescription className="text-gray-600">
                          {ticket.clientName || 'Sin nombre'} • {ticket.clientEmail || 'Sin email'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {ticket.description || 'Sin descripción'}
                        </p>
                        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                          <span>Categoría: {ticket.category || 'General'}</span>
                          <span>
                            {ticket.createdAt 
                              ? new Date(ticket.createdAt).toLocaleDateString()
                              : 'Fecha no disponible'
                            }
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Panel lateral de detalles del ticket */}
        {selectedTicket && (
          <div className="w-1/2 border-l bg-white shadow-lg">
            {/* Header del panel lateral */}
            <div className="flex h-16 items-center justify-between px-6 border-b bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Detalles del Ticket</h2>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedTicket(null)}
                className="hover:bg-gray-200"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Contenido del panel lateral */}
            <div className="p-6 space-y-6 overflow-y-auto" style={{ height: 'calc(100vh - 12rem)' }}>
              <div>
                <h3 className="font-semibold text-xl mb-2 text-gray-900">
                  {selectedTicket.subject || 'Sin asunto'}
                </h3>
                <div className="flex gap-2 mb-4">
                  {getStatusBadge(selectedTicket.status || 'recibida')}
                  {getPriorityBadge(selectedTicket.priority || 'media')}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Cliente</label>
                  <p className="text-sm mt-1">{selectedTicket.clientName || 'Sin nombre'}</p>
                  <p className="text-sm text-gray-500">{selectedTicket.clientEmail || 'Sin email'}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Categoría</label>
                  <p className="text-sm mt-1">{selectedTicket.category || 'General'}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Descripción</label>
                  <p className="text-sm mt-1 bg-gray-50 p-3 rounded-md">
                    {selectedTicket.description || 'Sin descripción'}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Fecha de Creación</label>
                  <p className="text-sm mt-1">
                    {selectedTicket.createdAt 
                      ? new Date(selectedTicket.createdAt).toLocaleString()
                      : 'Fecha no disponible'
                    }
                  </p>
                </div>
              </div>

              {/* Mensajes del ticket */}
              <div>
                <h4 className="font-medium mb-3 text-gray-900">Conversación</h4>
                <div className="space-y-3 max-h-96 overflow-y-auto bg-gray-50 p-4 rounded-lg">
                  {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                    selectedTicket.messages.map((message, index) => (
                      <div 
                        key={message.id || index}
                        className={cn(
                          "p-3 rounded-lg max-w-[80%]",
                          message.sentBy === 'client' 
                            ? "bg-white border ml-0 mr-auto" 
                            : "bg-blue-600 text-white ml-auto mr-0"
                        )}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-medium">
                            {message.sentByName || (message.sentBy === 'client' ? 'Cliente' : 'Soporte')}
                          </span>
                          <span className={cn(
                            "text-xs",
                            message.sentBy === 'client' ? "text-gray-500" : "text-blue-100"
                          )}>
                            {message.timestamp 
                              ? new Date(message.timestamp).toLocaleString()
                              : 'Fecha no disponible'
                            }
                          </span>
                        </div>
                        <p className="text-sm">{message.message || 'Mensaje vacío'}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-gray-500 py-4">No hay mensajes en este ticket</p>
                  )}
                </div>
              </div>

              {/* Acciones del ticket */}
              <div className="space-y-2 pt-4 border-t">
                <Button className="w-full">
                  Responder
                </Button>
                <Button variant="outline" className="w-full">
                  Cambiar Estado
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}