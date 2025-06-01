'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageCircle, Search, Calendar, User, ArrowRight, Clock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import AppLayout from '@/components/layout/app-layout';
import { getAllTickets } from '@/lib/store';
import { formatDate } from '@/lib/utils';
import { AdminTicketDetailView } from '@/components/tickets/admin-ticket-detail-view';
import type { Ticket, TicketStatus } from '@/types/ticket';

const STATUS_CONFIG = {
  recibida: { label: 'Recibida', icon: MessageCircle, color: 'bg-blue-100 text-blue-800' },
  en_proceso: { label: 'En Proceso', icon: Clock, color: 'bg-yellow-100 text-yellow-800' },
  pendiente: { label: 'Pendiente', icon: AlertTriangle, color: 'bg-orange-100 text-orange-800' },
  solucionada: { label: 'Solucionada', icon: CheckCircle2, color: 'bg-green-100 text-green-800' },
  denegada: { label: 'Denegada', icon: XCircle, color: 'bg-red-100 text-red-800' },
};

const CATEGORY_LABELS = {
  tecnico: 'Soporte Técnico',
  pago: 'Problemas de Pago',
  facturacion: 'Facturación',
  contrato: 'Contrato/Servicios',
  informacion: 'Solicitud de Información',
  otro: 'Otro'
};

export default function AdminTicketsPage() {
  const { isAdmin, initialLoadComplete } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [categoryFilter, setCategoryFilter] = useState<string>('todos');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    if (!isAdmin) return;
    
    setLoading(true);
    try {
      const allTickets = await getAllTickets();
      setTickets(allTickets);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ FUNCIÓN PARA ACTUALIZAR TICKET
  const handleTicketUpdate = (ticketId: string, updates: Partial<Ticket>) => {
    setTickets(prev => prev.map(ticket => 
      ticket.id === ticketId 
        ? { ...ticket, ...updates }
        : ticket
    ));
    
    // Actualizar también el ticket seleccionado si es el mismo
    if (selectedTicket && selectedTicket.id === ticketId) {
      setSelectedTicket({ ...selectedTicket, ...updates });
    }
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      // Filtro por búsqueda
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          ticket.subject.toLowerCase().includes(searchLower) ||
          ticket.clientEmail.toLowerCase().includes(searchLower) ||
          ticket.description.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Filtro por estado
      if (statusFilter !== 'todos' && ticket.status !== statusFilter) {
        return false;
      }

      // Filtro por categoría
      if (categoryFilter !== 'todos' && ticket.category !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [tickets, searchTerm, statusFilter, categoryFilter]);

  const getTicketStats = () => {
    const stats = {
      total: tickets.length,
      recibida: tickets.filter(t => t.status === 'recibida').length,
      en_proceso: tickets.filter(t => t.status === 'en_proceso').length,
      pendiente: tickets.filter(t => t.status === 'pendiente').length,
      solucionada: tickets.filter(t => t.status === 'solucionada').length,
      denegada: tickets.filter(t => t.status === 'denegada').length,
    };
    return stats;
  };

  const stats = getTicketStats();

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

  if (!isAdmin) {
    return (
      <AppLayout>
        <Alert variant="destructive" className="my-4">
          <AlertTitle>Acceso Denegado</AlertTitle>
          <AlertDescription>
            No tiene permisos de administrador para ver esta página.
          </AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  // ✅ Vista de detalle del ticket
  if (selectedTicket) {
    return (
      <AppLayout>
        <AdminTicketDetailView
          ticket={selectedTicket}
          onBack={() => setSelectedTicket(null)}
          onTicketUpdate={(updates) => handleTicketUpdate(selectedTicket.id, updates)}
        />
      </AppLayout>
    );
  }

  // Vista de lista de tickets
  return (
    <AppLayout>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-100 px-6 py-8 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <MessageCircle className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Tickets</h1>
        </div>
        <p className="text-gray-600">Administre las solicitudes de soporte de los clientes.</p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        {Object.entries(STATUS_CONFIG).map(([status, config]) => {
          const count = stats[status as keyof typeof stats] as number;
          return (
            <Card key={status}>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs text-muted-foreground">{config.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por asunto, email o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los Estados</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                  <SelectItem key={status} value={status}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas las Categorías</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([category, label]) => (
                  <SelectItem key={category} value={category}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Tickets */}
      <Card>
        <CardHeader>
          <CardTitle>Tickets de Soporte</CardTitle>
          <CardDescription>
            {filteredTickets.length} ticket(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-4 text-muted-foreground">Cargando tickets...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-10">
              <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay tickets</h3>
              <p className="text-gray-500">
                {searchTerm || statusFilter !== 'todos' || categoryFilter !== 'todos'
                  ? 'No se encontraron tickets con los filtros aplicados.'
                  : 'No hay tickets de soporte registrados.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTickets.map((ticket) => {
                const statusConfig = STATUS_CONFIG[ticket.status || 'recibida'];
                const StatusIcon = statusConfig.icon;
                
                return (
                  <div 
                    key={ticket.id} 
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <StatusIcon className="h-4 w-4" />
                          <h3 className="font-semibold truncate">{ticket.subject}</h3>
                          <Badge className={statusConfig.color}>
                            {statusConfig.label}
                          </Badge>
                          <Badge variant="outline">
                            {CATEGORY_LABELS[ticket.category as keyof typeof CATEGORY_LABELS]}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground mb-3">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {ticket.clientEmail}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(ticket.createdAt)}
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageCircle className="h-4 w-4" />
                            {(ticket.messages?.length || 0)} respuesta(s)
                          </div>
                        </div>
                        
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {ticket.description}
                        </p>
                      </div>
                      
                      <ArrowRight className="h-5 w-5 text-muted-foreground ml-4" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}