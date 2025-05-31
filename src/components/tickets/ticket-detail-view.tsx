'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { addTicketMessage, markTicketAsRead } from '@/lib/store';
import { formatDate } from '@/lib/utils';
import { Ticket, TicketMessage } from '@/types/ticket';
import { 
  Send, 
  User, 
  UserCheck,
  Clock,
  MessageCircle,
  ArrowLeft
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

interface TicketDetailViewProps {
  ticket: Ticket;
  onBack: () => void;
  onTicketUpdate: (updatedTicket: Ticket) => void;
}

export function TicketDetailView({ ticket, onBack, onTicketUpdate }: TicketDetailViewProps) {
  const { client } = useAuth();
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [ticket.messages]);

  useEffect(() => {
    // Marcar como leído si no está leído
    if (!ticket.isClientRead) {
      markTicketAsRead(ticket.id, 'client');
    }
  }, [ticket.id, ticket.isClientRead]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !client) return;

    setIsLoading(true);
    try {
      const result = await addTicketMessage(
        ticket.id,
        newMessage.trim(),
        'client',
        `${client.firstName} ${client.lastName}`,
        client.email
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
              sentBy: 'client' as const,
              sentByName: `${client.firstName} ${client.lastName}`,
              sentByEmail: client.email,
              timestamp: new Date().toISOString(),
            }
          ],
          updatedAt: new Date().toISOString(),
          isClientRead: true,
          isAdminRead: false,
        };
        
        onTicketUpdate(updatedTicket);
        
        toast({
          title: 'Mensaje Enviado',
          description: 'Tu mensaje ha sido enviado correctamente',
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              {ticket.subject}
            </CardTitle>
            <CardDescription>
              Creado el {formatDate(ticket.createdAt)}
            </CardDescription>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={STATUS_CONFIG[ticket.status].color}>
            {STATUS_CONFIG[ticket.status].label}
          </Badge>
          
          <Badge variant="outline" className={PRIORITY_CONFIG[ticket.priority].color}>
            Prioridad: {PRIORITY_CONFIG[ticket.priority].label}
          </Badge>
          
          <Badge variant="outline">
            {ticket.category}
          </Badge>
          
          {ticket.assignedToAdminName && (
            <Badge variant="secondary">
              Asignado a: {ticket.assignedToAdminName}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Área de mensajes */}
        <div className="border rounded-lg mb-4">
          <div className="max-h-96 overflow-y-auto p-4 space-y-4">
            {ticket.messages.map((message, index) => (
              <div
                key={message.id || index}
                className={`flex gap-3 ${
                  message.sentBy === 'client' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.sentBy === 'client' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted'
                }`}>
                  {message.sentBy === 'client' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <UserCheck className="h-4 w-4" />
                  )}
                </div>
                
                <div className={`flex-1 max-w-[70%] ${
                  message.sentBy === 'client' ? 'text-right' : 'text-left'
                }`}>
                  <div className={`inline-block p-3 rounded-lg ${
                    message.sentBy === 'client'
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

        {/* Área de envío de mensajes */}
        {ticket.status !== 'solucionada' && ticket.status !== 'denegada' && (
          <div className="space-y-3">
            <Textarea
              placeholder="Escribe tu mensaje aquí..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              className="min-h-[80px]"
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
                Enviar
              </Button>
            </div>
          </div>
        )}
        
        {(ticket.status === 'solucionada' || ticket.status === 'denegada') && (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">
              Esta solicitud ha sido {ticket.status === 'solucionada' ? 'solucionada' : 'denegada'} y no se pueden enviar más mensajes.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}