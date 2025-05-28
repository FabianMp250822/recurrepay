
import { z } from 'zod';
import { FINANCING_OPTIONS } from './constants';

const planKeys = Object.keys(FINANCING_OPTIONS).map(Number);

export const clientSchema = z.object({
  firstName: z.string().min(1, { message: "El nombre es obligatorio." }).max(50, { message: "El nombre debe tener 50 caracteres o menos." }),
  lastName: z.string().min(1, { message: "El apellido es obligatorio." }).max(50, { message: "El apellido debe tener 50 caracteres o menos." }),
  email: z.string().email({ message: "Dirección de correo electrónico inválida." }),
  phoneNumber: z.string().min(7, { message: "El número de teléfono debe tener al menos 7 dígitos." }).max(15, { message: "El número de teléfono debe tener 15 dígitos o menos." }).regex(/^\+?[0-9\s-()]+$/, { message: "Formato de número de teléfono inválido."}),
  
  // Campos de financiación (opcionales, pero validados si presentes)
  contractValue: z.coerce.number().positive({ message: "El valor del contrato debe ser un número positivo." }).optional().or(z.literal(0)).or(z.literal('')),
  downPayment: z.coerce.number().nonnegative({ message: "El abono no puede ser negativo." }).optional().or(z.literal(0)).or(z.literal('')),
  paymentMethod: z.string().optional().or(z.literal('')),
  financingPlan: z.coerce.number().refine(val => planKeys.includes(val), {
    message: "Seleccione un plan de financiación válido.",
  }).optional().or(z.literal(0)), // 0 para "Sin financiación"
  
  paymentDayOfMonth: z.coerce.number().int().min(1, { message: "El día debe estar entre 1 y 31." }).max(31, { message: "El día debe estar entre 1 y 31." }),

  // paymentAmount (cuota mensual) se calculará en el backend si hay financiación.
  // Si no hay financiación, el usuario podría ingresarlo como "monto de pago recurrente"
  // Por ahora, lo omitimos del schema de validación del formulario directo y lo calculamos/manejamos en la acción.
  // O, si es un servicio recurrente sin financiación, se necesitará un campo para ello.
  // Para esta entrega, nos enfocamos en el flujo de financiación.
  // Si se requiere un "monto de pago recurrente" para servicios sin financiación, se debe agregar un campo específico.
  paymentAmount: z.coerce.number().positive({message: "El monto de pago recurrente debe ser positivo"}).optional(),

}).refine(data => {
  // Si hay valor de contrato, el abono no puede ser mayor que el valor del contrato + IVA (aproximado, cálculo exacto en form/action)
  if (data.contractValue && data.downPayment) {
    // Esta validación es un poco compleja aquí sin el IVA exacto,
    // es mejor manejarla en el form con feedback al usuario o en la acción.
    // Por ahora, una validación simple:
    return data.downPayment <= data.contractValue * 1.2; // Estimación gruesa con IVA
  }
  return true;
}, {
  message: "El abono no puede exceder el valor del contrato (más IVA).",
  path: ["downPayment"],
}).refine(data => {
  // Si se selecciona un plan de financiación (distinto de 0), debe haber un valor de contrato.
  if (data.financingPlan && data.financingPlan !== 0) {
    return data.contractValue && data.contractValue > 0;
  }
  return true;
}, {
  message: "Se requiere un valor de contrato para la financiación.",
  path: ["contractValue"],
});
