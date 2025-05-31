import { z } from 'zod';

export const ticketMessageSchema = z.object({
  message: z.string().min(1, 'El mensaje no puede estar vacío').max(1000, 'El mensaje es muy largo'),
  attachments: z.array(z.string().url()).optional(),
});

export const createTicketSchema = z.object({
  subject: z.string().min(1, 'El asunto es requerido').max(200, 'El asunto es muy largo'),
  description: z.string().min(10, 'La descripción debe tener al menos 10 caracteres').max(1000, 'La descripción es muy larga'),
  priority: z.enum(['baja', 'media', 'alta', 'urgente']),
  category: z.string().min(1, 'La categoría es requerida'),
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(['recibida', 'en_proceso', 'pendiente', 'solucionada', 'denegada']),
  assignedToAdmin: z.string().optional(),
  assignedToAdminName: z.string().optional(),
});