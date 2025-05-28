
import { z } from 'zod';

export const clientSchema = z.object({
  firstName: z.string().min(1, { message: "El nombre es obligatorio." }).max(50, { message: "El nombre debe tener 50 caracteres o menos." }),
  lastName: z.string().min(1, { message: "El apellido es obligatorio." }).max(50, { message: "El apellido debe tener 50 caracteres o menos." }),
  email: z.string().email({ message: "Dirección de correo electrónico inválida." }),
  phoneNumber: z.string().min(7, { message: "El número de teléfono debe tener al menos 7 dígitos." }).max(15, { message: "El número de teléfono debe tener 15 dígitos o menos." }).regex(/^\+?[0-9\s-()]+$/, { message: "Formato de número de teléfono inválido."}),
  paymentAmount: z.coerce.number().min(0.01, { message: "El monto del pago debe ser mayor que 0." }),
  paymentDayOfMonth: z.coerce.number().int().min(1, { message: "El día debe estar entre 1 y 31." }).max(31, { message: "El día debe estar entre 1 y 31." }),
});
