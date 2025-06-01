export type TicketStatus = "recibida" | "en_proceso" | "pendiente" | "solucionada" | "denegada";

export interface TicketMessage {
  id: string;
  message: string;
  sentBy: 'client' | 'admin';
  sentByName: string;
  sentByEmail: string;
  timestamp: string | Date;
  attachments?: string[];
}

export interface Ticket {
  id: string;
  subject: string;
  description: string;
  category: string;
  priority: 'baja' | 'media' | 'alta' | 'urgente';
  status: TicketStatus;
  clientId: string;
  clientName: string;
  clientEmail: string;
  assignedToAdmin?: string;
  assignedToAdminName?: string;
  messages: TicketMessage[];
  createdAt: string | Date;
  updatedAt: string | Date;
  // ✅ AGREGAR ESTOS CAMPOS:
  isClientRead: boolean;
  isAdminRead: boolean;
}

export interface CreateTicketData {
  subject: string;
  description: string;
  category: string;
  priority: 'baja' | 'media' | 'alta' | 'urgente';
}