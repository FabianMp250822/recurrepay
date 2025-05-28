
import { z } from 'zod';

// const planKeys = Object.keys(FINANCING_OPTIONS).map(Number); // Will be dynamic

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
  financingPlan: z.coerce.number()
    // .refine(val => planKeys.includes(val), { // Validation will adapt to dynamic plans
    //   message: "Seleccione un plan de financiación válido.",
    // })
    .optional().or(z.literal(0)),
  
  paymentDayOfMonth: z.coerce.number().int().min(1, { message: "El día debe estar entre 1 y 31." }).max(31, { message: "El día debe estar entre 1 y 31." }),

  paymentAmount: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : parseFloat(String(val))),
    z.number().positive({message: "El monto de pago recurrente debe ser positivo"}).optional()
  ),

  // File URLs and names (will be validated if present, but file objects are handled client-side)
  acceptanceLetterUrl: z.string().url().optional().or(z.literal('')),
  acceptanceLetterFileName: z.string().optional().or(z.literal('')),
  contractFileUrl: z.string().url().optional().or(z.literal('')),
  contractFileName: z.string().optional().or(z.literal('')),

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
        // If there's a contract value but no financing (implying a one-time payment structure handled by contract terms,
        // or potentially a recurring payment for services linked to a contract not financed via RecurPay's plans),
        // paymentAmount should be explicitly set or could be zero if fully paid by down payment.
        // For now, we keep it flexible, the server action logic will determine status based on paymentAmount = 0 and contract paid.
        return true; 
    }
    // If financing is chosen, paymentAmount is calculated, so not required from user for validation here.
    if (data.financingPlan && data.financingPlan !== 0 && data.contractValue && data.contractValue > 0) return true;
    
    // If no contract value and no financing plan, then it's a simple recurring service, paymentAmount is mandatory.
    if ((data.contractValue === undefined || data.contractValue === 0) && (data.financingPlan === undefined || data.financingPlan === 0)) {
        return data.paymentAmount !== undefined && data.paymentAmount > 0;
    }
    return true;
}, {
    message: "Se requiere un monto de pago recurrente si no hay financiación o valor de contrato.",
    path: ["paymentAmount"],
});


// Schema for individual financing plan setting
export const financingPlanSettingSchema = z.object({
  months: z.number().int(),
  label: z.string().min(1, "La etiqueta es requerida."),
  rate: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? 0 : parseFloat(String(val))),
    z.number().min(0, "La tasa no puede ser negativa.").max(1, "La tasa debe ser un decimal entre 0 y 1 (ej. 0.05 para 5%).")
  ),
  isDefault: z.boolean().optional(),
  isConfigurable: z.boolean().optional(),
});

// Schema for the form that edits multiple financing plan settings
export const financingSettingsSchema = z.object({
  plans: z.array(financingPlanSettingSchema),
});

// Schema for general app settings
export const generalSettingsSchema = z.object({
  appName: z.string().min(1, "El nombre de la aplicación es obligatorio.").max(50, "El nombre no puede exceder 50 caracteres.").optional().or(z.literal('')),
  appLogoUrl: z.string().url("Debe ser una URL válida.").optional().or(z.literal('')), // URL will be set after upload
  notificationsEnabled: z.boolean().optional(),
});
