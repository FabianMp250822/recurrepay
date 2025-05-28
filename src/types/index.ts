
import type { User as FirebaseUser } from 'firebase/auth';

export interface PaymentRecord {
  id: string;
  paymentDate: string; // ISO string - Date the payment was made or recorded as made
  amountPaid: number;
  recordedAt: string; // ISO string - Timestamp of when the record was created in the system
  paymentMethod?: string; // Optional: Method used for this specific payment
  notes?: string; // Optional: Any notes for this specific payment
}

export interface Client {
  id:string;
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
  
  paymentMethod?: string; // Medio de pago del contrato/abono inicial
  financingPlan?: number; // Meses del plan (0, 3, 6, 9, 12)
  financingInterestRateApplied?: number; // Tasa de interés del plan aplicada
  financingInterestAmount?: number; // Monto de interés por financiación
  totalAmountWithInterest?: number; // amountToFinance + financingInterestAmount

  paymentAmount: number; // Cuota Mensual Calculada (o monto recurrente si no hay financiación)
  paymentDayOfMonth: number; // Día del mes para el pago de la cuota
  
  nextPaymentDate: string; // Store as ISO string
  createdAt: string; // Store as ISO string

  // File uploads
  acceptanceLetterUrl?: string;
  acceptanceLetterFileName?: string;
  contractFileUrl?: string;
  contractFileName?: string;

  // Payment tracking
  paymentsMadeCount?: number; // Number of installments paid for a financing plan
  status?: 'active' | 'completed' | 'defaulted'; // Status of the client/contract
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
  financingPlan?: number; // 0, 3, 6, 9, 12
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
