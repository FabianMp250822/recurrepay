'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addTicketMessage, updateTicketStatus, markTicketAsRead } from '@/lib/store';
import { formatDate } from '@/lib/utils';
import { Ticket, TicketMessage, TicketStatus } from '@/types/ticket';
import { 
  Send, 
  User, 
  UserCheck,
  Clock,
  MessageCircle,
  ArrowLeft,
  AlertTriangle,
  Settings
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'recibida', label: 'Recibida' },
  { value: 'en_proceso', label: 'En Proceso' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'solucionada', label: 'Solucionada' },
  { value: 'denegada', label: 'Denegada' },
];

const STATUS_CONFIG = {
  recibida: { label: 'Recibida', color: 'bg-blue-100 text-blue-800' },
  en_proceso: { label: 'En Proceso', color: 'bg-yellow-100 text-yellow-800' },
  pendiente: { label: 'Pendiente', color: 'bg-orange-100 text-orange-800' },
  solucionada: { label: 'Solucionada', color: 'bg-green-100 text-green-800' },
  denegada: { label: 'Denegada', color: 'bg-red-100 text-red-800' },
};

const PRIORITY_CONFIG = {
  baja: { label: 'Baja', color: 'bg-gray-100 text-gray-800' },
  media: { label: 'Media', color: 'bg-blue-100 text-blue-800' },
  alta: { label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  urgente: { label: 'Urgente', color: 'bg-red-100 text-red-800' },
};

interface AdminTicketDetailViewProps {
  ticket: Ticket;
  onBack: () => void;
  onTicketUpdate: (updatedTicket: Ticket) => void;
}

export function AdminTicketDetailView({ ticket, onBack, onTicketUpdate }: AdminTicketDetailViewProps) {
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [newStatus, setNewStatus] = useState<TicketStatus>(ticket.status);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [ticket.messages]);

  useEffect(() => {
    // Marcar como leído si no está leído
    if (!ticket.isAdminRead) {
      markTicketAsRead(ticket.id, 'admin');
    }
  }, [ticket.id, ticket.isAdminRead]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    setIsLoading(true);
    try {
      const result = await addTicketMessage(
        ticket.id,
        newMessage.trim(),
        'admin',
        'Administrador', // Aquí podrías obtener el nombre del admin del contexto
        'admin@recurrepay.com' // Aquí podrías obtener el email del admin del contexto
      );

      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        setNewMessage('');
        
        // Actualizar el ticket con el nuevo mensaje
        const updatedTicket = {
          ...ticket,
          messages: [
            ...ticket.messages,
            {
              id: crypto.randomUUID(),
              message: newMessage.trim(),
              sentBy: 'admin' as const,
              sentByName: 'Administrador',
              sentByEmail: 'admin@recurrepay.com',
              timestamp: new Date().toISOString(),
            }
          ],
          updatedAt: new Date().toISOString(),
          isClientRead: false,
          isAdminRead: true,
        };
        
        onTicketUpdate(updatedTicket);
        
        toast({
          title: 'Mensaje Enviado',
          description: 'Tu respuesta ha sido enviada al cliente',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Ocurrió un error al enviar el mensaje',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (newStatus === ticket.status) return;

    setIsUpdatingStatus(true);
    try {
      const result = await updateTicketStatus(ticket.id, newStatus);

      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        const updatedTicket = {
          ...ticket,
          status: newStatus,
          updatedAt: new Date().toISOString(),
          isAdminRead: true,
        };
        
        onTicketUpdate(updatedTicket);
        
        toast({
          title: 'Estado Actualizado',
          description: `El ticket ha sido marcado como ${STATUS_CONFIG[newStatus].label.toLowerCase()}`,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Ocurrió un error al actualizar el estado',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{ticket.subject}</h1>
          <p className="text-muted-foreground">
            Ticket de {ticket.clientName} • Creado el {formatDate(ticket.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Información del ticket */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Conversación
            </CardTitle>
          </CardHeader>
          
          <CardContent>
            {/* Área de mensajes */}
            <div className="border rounded-lg mb-4">
              <div className="max-h-96 overflow-y-auto p-4 space-y-4">
                {ticket.messages.map((message, index) => (
                  <div
                    key={message.id || index}
                    className={`flex gap-3 ${
                      message.sentBy === 'admin' ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.sentBy === 'admin' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted'
                    }`}>
                      {message.sentBy === 'admin' ? (
                        <UserCheck className="h-4 w-4" />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                    </div>
                    
                    <div className={`flex-1 max-w-[70%] ${
                      message.sentBy === 'admin' ? 'text-right' : 'text-left'
                    }`}>
                      <div className={`inline-block p-3 rounded-lg ${
                        message.sentBy === 'admin'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}>
                        <p className="text-sm">{message.message}</p>
                      </div>
                      
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <span>{message.sentByName}</span>
                        <span>•</span>
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(message.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Área de respuesta */}
            <div className="space-y-3">
              <Textarea
                placeholder="Escribe tu respuesta al cliente..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="min-h-[100px]"
                disabled={isLoading}
              />
              
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  Presiona Enter para enviar, Shift+Enter para nueva línea
                </p>
                
                <Button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || isLoading}
                  size="sm"
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Enviar Respuesta
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Panel lateral */}
        <div className="space-y-6">
          {/* Estado del ticket */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Gestión del Ticket
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Estado actual</label>
                <Select value={newStatus} onValueChange={(value: TicketStatus) => setNewStatus(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {newStatus !== ticket.status && (
                <Button 
                  onClick={handleStatusUpdate}
                  disabled={isUpdatingStatus}
                  className="w-full"
                  size="sm"
                >
                  {isUpdatingStatus ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : null}
                  Actualizar Estado
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Información del cliente */}
          <Card>
            <CardHeader>
              <CardTitle>Información del Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nombre</label>
                <p className="text-sm">{ticket.clientName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <p className="text-sm">{ticket.clientEmail}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Prioridad</label>
                <Badge variant="outline" className={PRIORITY_CONFIG[ticket.priority].color}>
                  {PRIORITY_CONFIG[ticket.priority].label}
                </Badge>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Categoría</label>
                <p className="text-sm">{ticket.category}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Creado</label>
                <p className="text-sm">{formatDate(ticket.createdAt)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Última actualización</label>
                <p className="text-sm">{formatDate(ticket.updatedAt)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}