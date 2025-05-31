'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { getClientTickets } from '@/lib/store';
import { formatDate } from '@/lib/utils';
import { Ticket, TicketStatus } from '@/types/ticket';
import { 
  MessageCircle, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Inbox,
  Eye,
  MessageSquare
} from 'lucide-react';

const STATUS_CONFIG = {
  recibida: { label: 'Recibida', icon: Inbox, variant: 'secondary' as const, color: 'bg-blue-100 text-blue-800' },
  en_proceso: { label: 'En Proceso', icon: Clock, variant: 'default' as const, color: 'bg-yellow-100 text-yellow-800' },
  pendiente: { label: 'Pendiente', icon: AlertTriangle, variant: 'outline' as const, color: 'bg-orange-100 text-orange-800' },
  solucionada: { label: 'Solucionada', icon: CheckCircle2, variant: 'default' as const, color: 'bg-green-100 text-green-800' },
  denegada: { label: 'Denegada', icon: XCircle, variant: 'destructive' as const, color: 'bg-red-100 text-red-800' },
};

const PRIORITY_CONFIG = {
  baja: { label: 'Baja', color: 'bg-gray-100 text-gray-800' },
  media: { label: 'Media', color: 'bg-blue-100 text-blue-800' },
  alta: { label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  urgente: { label: 'Urgente', color: 'bg-red-100 text-red-800' },
};

interface ClientTicketsListProps {
  onTicketSelect: (ticket: Ticket) => void;
  selectedTicketId?: string;
}

export function ClientTicketsList({ onTicketSelect, selectedTicketId }: ClientTicketsListProps) {
  const { client } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TicketStatus | 'all'>('all');

  // Siempre ejecutar los hooks, independientemente de las condiciones
  useEffect(() => {
    async function fetchTickets() {
      if (!client?.id) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const clientTickets = await getClientTickets(client.id);
        setTickets(clientTickets);
      } catch (error) {
        console.error('Error fetching tickets:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTickets();
  }, [client?.id]); // Dependencia específica

  const filteredTickets = activeTab === 'all' 
    ? tickets 
    : tickets.filter(ticket => ticket.status === activeTab);

  const getStatusCounts = () => {
    return {
      all: tickets.length,
      recibida: tickets.filter(t => t.status === 'recibida').length,
      en_proceso: tickets.filter(t => t.status === 'en_proceso').length,
      pendiente: tickets.filter(t => t.status === 'pendiente').length,
      solucionada: tickets.filter(t => t.status === 'solucionada').length,
      denegada: tickets.filter(t => t.status === 'denegada').length,
    };
  };

  const counts = getStatusCounts();

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Mis Solicitudes
        </CardTitle>
        <CardDescription>
          Historial de todas tus consultas y solicitudes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TicketStatus | 'all')}>
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="all" className="text-xs">
              Todas ({counts.all})
            </TabsTrigger>
            <TabsTrigger value="recibida" className="text-xs">
              Recibidas ({counts.recibida})
            </TabsTrigger>
            <TabsTrigger value="en_proceso" className="text-xs">
              En Proceso ({counts.en_proceso})
            </TabsTrigger>
            <TabsTrigger value="pendiente" className="text-xs">
              Pendientes ({counts.pendiente})
            </TabsTrigger>
            <TabsTrigger value="solucionada" className="text-xs">
              Solucionadas ({counts.solucionada})
            </TabsTrigger>
            <TabsTrigger value="denegada" className="text-xs">
              Denegadas ({counts.denegada})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {filteredTickets.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {activeTab === 'all' ? 'No tienes solicitudes' : `No hay solicitudes ${STATUS_CONFIG[activeTab as TicketStatus]?.label.toLowerCase()}`}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {activeTab === 'all' 
                    ? 'Crea tu primera solicitud para contactar con soporte'
                    : 'No hay solicitudes en esta categoría'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTickets.map((ticket) => {
                  const StatusIcon = STATUS_CONFIG[ticket.status].icon;
                  const isSelected = selectedTicketId === ticket.id;
                  const hasUnreadMessages = !ticket.isClientRead;
                  
                  return (
                    <div
                      key={ticket.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                      onClick={() => onTicketSelect(ticket)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <StatusIcon className="h-4 w-4" />
                            <h4 className="font-medium truncate">
                              {ticket.subject}
                            </h4>
                            {hasUnreadMessages && (
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            )}
                          </div>
                          
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {ticket.description}
                          </p>
                          
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge 
                              variant={STATUS_CONFIG[ticket.status].variant}
                              className={STATUS_CONFIG[ticket.status].color}
                            >
                              {STATUS_CONFIG[ticket.status].label}
                            </Badge>
                            
                            <Badge 
                              variant="outline"
                              className={PRIORITY_CONFIG[ticket.priority].color}
                            >
                              {PRIORITY_CONFIG[ticket.priority].label}
                            </Badge>
                            
                            <span className="text-xs text-muted-foreground">
                              {formatDate(ticket.createdAt)}
                            </span>
                            
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" />
                              {ticket.messages.length} mensaje{ticket.messages.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}