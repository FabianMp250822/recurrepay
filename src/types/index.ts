
import type { User as FirebaseUser } from 'firebase/auth';

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;

  // Campos de financiación y contrato
  contractValue?: number; // Valor del contrato antes de IVA
  ivaRate?: number; // Tasa de IVA aplicada (ej: 0.19)
  ivaAmount?: number; // Monto de IVA calculado
  totalWithIva?: number; // contractValue + ivaAmount

  downPaymentPercentage?: number; // Porcentaje de abono ingresado por el usuario
  downPayment?: number; // Abono inicial (calculado monetariamente)
  
  amountToFinance?: number; // totalWithIva - downPayment
  
  paymentMethod?: string; // Medio de pago del contrato/abono
  financingPlan?: number; // Meses del plan (3, 6, 9, 12)
  financingInterestRateApplied?: number; // Tasa de interés del plan aplicada
  financingInterestAmount?: number; // Monto de interés por financiación
  totalAmountWithInterest?: number; // amountToFinance + financingInterestAmount

  paymentAmount: number; // Cuota Mensual Calculada
  paymentDayOfMonth: number; // Día del mes para el pago de la cuota
  
  nextPaymentDate: string; // Store as ISO string
  createdAt: string; // Store as ISO string

  // File uploads
  acceptanceLetterUrl?: string;
  acceptanceLetterFileName?: string;
  contractFileUrl?: string;
  contractFileName?: string;
}

// FormData para los campos que el usuario ingresa directamente en el formulario
export type ClientFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  contractValue?: number;
  downPaymentPercentage?: number; // Usuario ingresa porcentaje
  paymentMethod?: string;
  financingPlan?: number; // 3, 6, 9, 12
  paymentDayOfMonth: number;
  paymentAmount?: number; // Monto de pago recurrente (si no hay financiación)

  // File objects (not directly part of schema for submission, handled separately)
  acceptanceLetterFile?: File | null;
  contractFileFile?: File | null;

  // URLs (passed to server action after upload)
  acceptanceLetterUrl?: string;
  acceptanceLetterFileName?: string;
  contractFileUrl?: string;
  contractFileName?: string;
};

export type AppUser = FirebaseUser;
