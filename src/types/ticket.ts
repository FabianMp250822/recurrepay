export type TicketStatus = 'recibida' | 'en_proceso' | 'pendiente' | 'solucionada' | 'denegada';
export type TicketPriority = 'baja' | 'media' | 'alta' | 'urgente';

export interface TicketMessage {
  id: string;
  message: string;
  sentBy: 'client' | 'admin';
  sentByName: string;
  sentByEmail: string;
  timestamp: string;
  attachments?: string[]; // URLs de archivos adjuntos
}

export interface Ticket {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  createdAt: string;
  updatedAt: string;
  assignedToAdmin?: string;
  assignedToAdminName?: string;
  messages: TicketMessage[];
  isClientRead: boolean;
  isAdminRead: boolean;
}

export type CreateTicketData = Pick<Ticket, 'subject' | 'description' | 'priority' | 'category'>;