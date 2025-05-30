
import { z } from 'zod';

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
    .optional().or(z.literal(0)),
  
  paymentDayOfMonth: z.coerce.number().int().min(1, { message: "El día debe estar entre 1 y 31." }).max(31, { message: "El día debe estar entre 1 y 31." }),

  paymentAmount: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : parseFloat(String(val))),
    z.number().positive({message: "El monto de pago recurrente debe ser positivo"}).optional()
  ),

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
        return true; 
    }
    if (data.financingPlan && data.financingPlan !== 0 && data.contractValue && data.contractValue > 0) return true;
    
    if ((data.contractValue === undefined || data.contractValue === 0) && (data.financingPlan === undefined || data.financingPlan === 0)) {
        return data.paymentAmount !== undefined && data.paymentAmount > 0;
    }
    return true;
}, {
    message: "Se requiere un monto de pago recurrente si no hay financiación o valor de contrato.",
    path: ["paymentAmount"],
});

export const registrationSchema = z.object({
  email: z.string().email({ message: "Dirección de correo electrónico inválida." }),
  password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres." }),
  confirmPassword: z.string().min(6, { message: "La confirmación de contraseña debe tener al menos 6 caracteres." }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden.",
  path: ["confirmPassword"],
});


export const publicClientSchema = z.object({
  // El email vendrá del usuario autenticado, no necesita estar aquí para validación de este formulario
  firstName: z.string().min(1, { message: "El nombre es obligatorio." }).max(50, { message: "El nombre debe tener 50 caracteres o menos." }),
  lastName: z.string().min(1, { message: "El apellido es obligatorio." }).max(50, { message: "El apellido debe tener 50 caracteres o menos." }),
  phoneNumber: z.string().min(7, { message: "El número de teléfono debe tener al menos 7 dígitos." }).max(15, { message: "El número de teléfono debe tener 15 dígitos o menos." }).regex(/^\+?[0-9\s-()]+$/, { message: "Formato de número de teléfono inválido."}),
  contractValue: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? 0 : parseFloat(String(val))), // Default to 0 if empty
    z.number().min(0, "El valor del contrato debe ser un número positivo o cero.")
  ),
  financingPlan: z.coerce.number({invalid_type_error: "Debe seleccionar un plan de financiación."})
    .refine(val => typeof val === 'number', { message: "Seleccione un plan de financiación válido."}), 
  paymentDayOfMonth: z.coerce.number().int().min(1, { message: "El día debe estar entre 1 y 31." }).max(31, { message: "El día debe estar entre 1 y 31." }),
}).refine(data => {
  if (data.contractValue > 0 && data.financingPlan === undefined) {
    return false; 
  }
  return true;
}, {
  message: "Debe seleccionar un plan de financiación si ingresa un valor de contrato.",
  path: ["financingPlan"],
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

// Helper for HSL color string validation (e.g., "207 88% 68%")
const hslColorString = z.string()
  .regex(/^\d{1,3}\s\d{1,3}%\s\d{1,3}%$/, "El formato debe ser 'H S% L%' (ej: 207 88% 68%)")
  .optional()
  .or(z.literal(''));

// Schema for general app settings
export const generalSettingsSchema = z.object({
  appName: z.string().min(1, "El nombre de la aplicación es obligatorio.").max(50, "El nombre no puede exceder 50 caracteres.").optional().or(z.literal('')),
  appLogoUrl: z.string().url("Debe ser una URL válida.").optional().or(z.literal('')),
  notificationsEnabled: z.boolean().optional(),
  themePrimary: hslColorString,
  themeSecondary: hslColorString,
  themeAccent: hslColorString,
  themeBackground: hslColorString,
  themeForeground: hslColorString,
});

