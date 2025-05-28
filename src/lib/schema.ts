
import { z } from 'zod';
import { FINANCING_OPTIONS } from './constants';

const planKeys = Object.keys(FINANCING_OPTIONS).map(Number);

export const clientSchema = z.object({
  firstName: z.string().min(1, { message: "El nombre es obligatorio." }).max(50, { message: "El nombre debe tener 50 caracteres o menos." }),
  lastName: z.string().min(1, { message: "El apellido es obligatorio." }).max(50, { message: "El apellido debe tener 50 caracteres o menos." }),
  email: z.string().email({ message: "Dirección de correo electrónico inválida." }),
  phoneNumber: z.string().min(7, { message: "El número de teléfono debe tener al menos 7 dígitos." }).max(15, { message: "El número de teléfono debe tener 15 dígitos o menos." }).regex(/^\+?[0-9\s-()]+$/, { message: "Formato de número de teléfono inválido."}),
  
  contractValue: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : parseFloat(String(val))),
    z.number().positive({ message: "El valor del contrato debe ser un número positivo." }).optional()
  ),
  downPaymentPercentage: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : parseFloat(String(val))),
    z.number().min(0, "El porcentaje no puede ser negativo.").max(100, "El porcentaje no puede exceder 100.").optional()
  ),
  paymentMethod: z.string().optional().or(z.literal('')),
  financingPlan: z.coerce.number().refine(val => planKeys.includes(val), {
    message: "Seleccione un plan de financiación válido.",
  }).optional().or(z.literal(0)),
  
  paymentDayOfMonth: z.coerce.number().int().min(1, { message: "El día debe estar entre 1 y 31." }).max(31, { message: "El día debe estar entre 1 y 31." }),

  paymentAmount: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : parseFloat(String(val))),
    z.number().positive({message: "El monto de pago recurrente debe ser positivo"}).optional()
  ),

  // File URLs and names (will be validated if present, but file objects are handled client-side)
  acceptanceLetterUrl: z.string().url().optional(),
  acceptanceLetterFileName: z.string().optional(),
  contractFileUrl: z.string().url().optional(),
  contractFileName: z.string().optional(),

}).refine(data => {
  if (data.financingPlan && data.financingPlan !== 0) {
    return data.contractValue !== undefined && data.contractValue > 0;
  }
  return true;
}, {
  message: "Se requiere un valor de contrato para la financiación.",
  path: ["contractValue"],
}).refine(data => {
    if (data.contractValue !== undefined && data.contractValue > 0 && data.financingPlan === 0) {
        return data.paymentAmount !== undefined && data.paymentAmount > 0;
    }
    // If financing is chosen, paymentAmount is calculated, so not required from user
    if (data.financingPlan && data.financingPlan !== 0) return true;
    // If no contract value and no financing plan, then it's a simple recurring service
    if ((data.contractValue === undefined || data.contractValue === 0) && data.financingPlan === 0) {
        return data.paymentAmount !== undefined && data.paymentAmount > 0;
    }
    return true;
}, {
    message: "Se requiere un monto de pago recurrente si no hay financiación o valor de contrato.",
    path: ["paymentAmount"],
});
