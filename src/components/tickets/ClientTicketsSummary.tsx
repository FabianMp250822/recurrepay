'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageCircle, Plus, CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsClient } from '@/hooks/use-is-client';
import { getClientTickets } from '@/lib/store';
import { formatDate } from '@/lib/utils';
import type { Ticket } from '@/types/ticket';
import Link from 'next/link';

const STATUS_CONFIG = {
  recibida: { label: 'Recibida', icon: MessageCircle, color: 'bg-blue-100 text-blue-800' },
  en_proceso: { label: 'En Proceso', icon: Clock, color: 'bg-yellow-100 text-yellow-800' },
  pendiente: { label: 'Pendiente', icon: AlertTriangle, color: 'bg-orange-100 text-orange-800' },
  solucionada: { label: 'Solucionada', icon: CheckCircle2, color: 'bg-green-100 text-green-800' },
  denegada: { label: 'Denegada', icon: XCircle, color: 'bg-red-100 text-red-800' },
};

export default function ClientTicketsSummary() {
  const { client } = useAuth();
  const isClient = useIsClient();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTickets() {
      if (!client?.id || !isClient) {
        setLoading(false);
        return;
      }

      try {
        const clientTickets = await getClientTickets(client.id);
        setTickets(clientTickets);
      } catch (error) {
        console.error('Error fetching client tickets:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTickets();
  }, [client?.id, isClient]);

  // Calcular estadísticas
  const getTicketStats = () => {
    const stats = {
      total: tickets.length,
      recibida: tickets.filter(t => t.status === 'recibida').length,
      en_proceso: tickets.filter(t => t.status === 'en_proceso').length,
      pendiente: tickets.filter(t => t.status === 'pendiente').length,
      solucionada: tickets.filter(t => t.status === 'solucionada').length,
      denegada: tickets.filter(t => t.status === 'denegada').length,
    };

    const activeTickets = stats.recibida + stats.en_proceso + stats.pendiente;
    const resolvedTickets = stats.solucionada + stats.denegada;

    return { ...stats, activeTickets, resolvedTickets };
  };

  const stats = getTicketStats();
  const recentTickets = tickets
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  if (loading || !isClient) {
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
          <MessageCircle className="h-5 w-5 text-blue-600" />
          Estado de Soporte y Tickets
        </CardTitle>
        <CardDescription>
          Resumen de tus consultas y solicitudes de soporte
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Estadísticas generales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
              <div className="text-xs text-blue-600">Total Tickets</div>
            </div>
            
            <div className="bg-yellow-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-700">{stats.activeTickets}</div>
              <div className="text-xs text-yellow-600">Activos</div>
            </div>
            
            <div className="bg-green-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-700">{stats.solucionada}</div>
              <div className="text-xs text-green-600">Solucionados</div>
            </div>
            
            <div className="bg-purple-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-700">
                {stats.total > 0 ? Math.round((stats.solucionada / stats.total) * 100) : 0}%
              </div>
              <div className="text-xs text-purple-600">Tasa Resolución</div>
            </div>
          </div>

          {/* Tickets por estado */}
          {stats.total > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3">Distribución por Estado</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                  const count = stats[status as keyof typeof stats] as number;
                  if (count === 0) return null;
                  
                  const Icon = config.icon;
                  return (
                    <div key={status} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="text-sm">{config.label}</span>
                      </div>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tickets recientes */}
          {recentTickets.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3">Tickets Recientes</h4>
              <div className="space-y-2">
                {recentTickets.map((ticket) => {
                  const statusConfig = STATUS_CONFIG[ticket.status || 'recibida'];
                  const StatusIcon = statusConfig.icon;
                  
                  return (
                    <div key={ticket.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <StatusIcon className="h-4 w-4" />
                          <span className="font-medium text-sm">{ticket.subject}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatDate(ticket.createdAt)}</span>
                          <span>•</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Acción para crear nuevo ticket */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Button asChild className="flex-1">
              <Link href="/client-dashboard/tickets">
                <MessageCircle className="h-4 w-4 mr-2" />
                Ver Todos los Tickets
              </Link>
            </Button>
            
            <Button variant="outline" asChild className="flex-1">
              <Link href="/client-dashboard/tickets?create=true">
                <Plus className="h-4 w-4 mr-2" />
                Nueva Solicitud
              </Link>
            </Button>
          </div>

          {/* Mensaje si no hay tickets */}
          {stats.total === 0 && (
            <div className="text-center py-6">
              <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-medium mb-2">No tienes tickets de soporte</h3>
              <p className="text-muted-foreground text-sm mb-4">
                ¿Tienes alguna consulta o necesitas ayuda? Crea tu primera solicitud.
              </p>
              <Button asChild>
                <Link href="/client-dashboard/tickets?create=true">
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primera Solicitud
                </Link>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}