
import { z } from 'zod';

export const registrationSchema = z.object({
  email: z.string().email({ message: "Dirección de correo electrónico inválida." }),
  password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres." }),
  confirmPassword: z.string().min(6, { message: "La confirmación de contraseña debe tener al menos 6 caracteres." }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden.",
  path: ["confirmPassword"],
});

export const clientSchema = z.object({
  firstName: z.string().min(1, { message: "El nombre es obligatorio." }).max(50, { message: "El nombre debe tener 50 caracteres o menos." }),
  lastName: z.string().min(1, { message: "El apellido es obligatorio." }).max(50, { message: "El apellido debe tener 50 caracteres o menos." }),
  email: z.string().email({ message: "Dirección de correo electrónico inválida." }),
  phoneNumber: z.string().min(7, { message: "El número de teléfono debe tener al menos 7 dígitos." }).max(15, { message: "El número de teléfono debe tener 15 dígitos o menos." }).regex(/^\+?[0-9\s-()]+$/, { message: "Formato de número de teléfono inválido."}),

  contractValue: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : parseFloat(String(val))),
    z.number().positive({ message: "El valor del contrato debe ser un número positivo." }).optional()
  ),
  applyIva: z.boolean().optional().default(true),
  downPaymentPercentage: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : parseFloat(String(val))),
    z.number().min(20, "El porcentaje de abono no puede ser menor al 20% para contratos de este valor, o 0% si no hay abono.").max(100, "El porcentaje no puede exceder 100.").optional()
  ),
  paymentMethod: z.string().optional().or(z.literal('')),
  financingPlan: z.coerce.number()
    .optional().or(z.literal(0)),

  paymentDayOfMonth: z.coerce.number().int().min(1, { message: "El día debe estar entre 1 y 31." }).max(31, { message: "El día debe estar entre 1 y 31." }),

  paymentAmount: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : parseFloat(String(val))),
    z.number().min(0, "El monto de pago no puede ser negativo.").optional()
  ),

  acceptanceLetterUrl: z.string().url().optional().or(z.literal('')),
  acceptanceLetterFileName: z.string().optional().or(z.literal('')),
  contractFileUrl: z.string().url().optional().or(z.literal('')),
  contractFileName: z.string().optional().or(z.literal('')),

}).superRefine((data, ctx) => {
  const contractValue = data.contractValue ?? 0;
  const CONTRACT_VALUE_THRESHOLD = 1000000;
  const MIN_DOWN_PAYMENT_PERCENTAGE_LARGE_CONTRACT = 20;

  if (contractValue > 0 && contractValue < CONTRACT_VALUE_THRESHOLD) {
    if (data.financingPlan !== 0 && data.financingPlan !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Para contratos menores a $1,000,000, no se ofrece financiación.",
        path: ["financingPlan"],
      });
    }
    if (data.downPaymentPercentage !== 0 && data.downPaymentPercentage !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Para contratos menores a $1,000,000, no se acepta abono inicial.",
        path: ["downPaymentPercentage"],
      });
    }
  } else if (contractValue >= CONTRACT_VALUE_THRESHOLD) {
    if (data.downPaymentPercentage !== undefined && data.downPaymentPercentage !== 0 && data.downPaymentPercentage < MIN_DOWN_PAYMENT_PERCENTAGE_LARGE_CONTRACT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `El porcentaje de abono inicial debe ser 0% o al menos ${MIN_DOWN_PAYMENT_PERCENTAGE_LARGE_CONTRACT}% para contratos de este valor.`,
        path: ["downPaymentPercentage"],
      });
    }
  }

  // Validate paymentAmount based on contract and financing
  if (contractValue === 0 && (data.financingPlan === 0 || data.financingPlan === undefined)) { // Pure service
    if (data.paymentAmount === undefined || data.paymentAmount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Se requiere un monto de pago recurrente positivo si no hay contrato ni financiación.",
        path: ["paymentAmount"],
      });
    }
  } else if (contractValue > 0 && (data.financingPlan === 0 || data.financingPlan === undefined) ) { // Contract, no financing
    if ((data.downPaymentPercentage ?? 0) < 100 && (data.paymentAmount === undefined || data.paymentAmount <= 0) && contractValue < CONTRACT_VALUE_THRESHOLD) {
        // This case is auto-calculated, so paymentAmount might be derived and not directly validated here if Zod preprocesses it
    } else if ((data.downPaymentPercentage ?? 0) < 100 && (data.paymentAmount === undefined || data.paymentAmount <= 0) && contractValue >= CONTRACT_VALUE_THRESHOLD) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Se requiere un monto de pago válido si el contrato no está totalmente cubierto por el abono y no hay financiación.",
            path: ["paymentAmount"],
         });
    }
  }
});


// Base Zod object for public client data, allows .pick() or .omit()
export const basePublicClientObjectSchema = z.object({
  firstName: z.string().min(1, { message: "El nombre es obligatorio." }).max(50, { message: "El nombre debe tener 50 caracteres o menos." }),
  lastName: z.string().min(1, { message: "El apellido es obligatorio." }).max(50, { message: "El apellido debe tener 50 caracteres o menos." }),
  phoneNumber: z.string().min(7, { message: "El número de teléfono debe tener al menos 7 dígitos." }).max(15, { message: "El número de teléfono debe tener 15 dígitos o menos." }).regex(/^\+?[0-9\s-()]+$/, { message: "Formato de número de teléfono inválido."}),
  contractValue: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? 0 : parseFloat(String(val))),
    z.number().min(0, "El valor del contrato debe ser un número positivo o cero.")
  ),
  applyIva: z.boolean().optional().default(true), // This is part of the data model
  financingPlan: z.coerce.number({ required_error: "Debe seleccionar un plan de financiación.", invalid_type_error: "Plan de financiación inválido."}),
  paymentDayOfMonth: z.coerce.number().int().min(1, { message: "El día debe estar entre 1 y 31." }).max(31, { message: "El día debe estar entre 1 y 31." }),
  acceptanceLetterUrl: z.string().url("URL inválida para carta de aceptación.").optional().or(z.literal('')),
  acceptanceLetterFileName: z.string().max(100, "Nombre de archivo muy largo.").optional().or(z.literal('')),
  contractFileUrl: z.string().url("URL inválida para contrato.").optional().or(z.literal('')),
  contractFileName: z.string().max(100, "Nombre de archivo muy largo.").optional().or(z.literal('')),
});

// Full schema for server-side validation or when all data is present
export const publicClientSchema = basePublicClientObjectSchema.refine(data => {
  if (data.contractValue && data.contractValue > 0 && (data.financingPlan === null || data.financingPlan === undefined )) {
    // This refine implies financingPlan is not truly required by its base definition if this check is needed.
    // Given financingPlan is `z.coerce.number({ required_error: ...})`, it should always be a number if valid.
    // This refine might be redundant or indicate `financingPlan` should be optional in `basePublicClientObjectSchema`.
    // For now, assuming the intent is: if there's a contract value, a financing plan must be explicitly selected (even if it's "0 meses").
    // `coerce.number` would throw if not a number.
  }
  return true;
}, {
  message: "Debe seleccionar un plan de financiación si ingresa un valor de contrato.",
  path: ["financingPlan"], // This path might be an issue if the refine condition isn't specific enough
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
