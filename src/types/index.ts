
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
  downPayment?: number; // Abono inicial
  amountToFinance?: number; // totalWithIva - downPayment
  
  paymentMethod?: string; // Medio de pago del contrato/abono
  financingPlan?: number; // Meses del plan (3, 6, 9, 12)
  financingInterestRateApplied?: number; // Tasa de interés del plan aplicada
  financingInterestAmount?: number; // Monto de interés por financiación
  totalAmountWithInterest?: number; // amountToFinance + financingInterestAmount

  paymentAmount: number; // Cuota Mensual Calculada (anteriormente monto de pago recurrente)
  paymentDayOfMonth: number; // Día del mes para el pago de la cuota
  
  nextPaymentDate: string; // Store as ISO string (para la próxima cuota)
  createdAt: string; // Store as ISO string
}

// FormData para los campos que el usuario ingresa directamente en el formulario
export type ClientFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  contractValue?: number;
  downPayment?: number;
  paymentMethod?: string;
  financingPlan?: number; // 3, 6, 9, 12
  paymentDayOfMonth: number;
  // paymentAmount (cuota mensual) se calculará y no vendrá directamente del form si hay financiación
};

// Extended Firebase User type for our app context if needed,
// but for now, AuthContext will manage isAdmin separately.
export type AppUser = FirebaseUser;
