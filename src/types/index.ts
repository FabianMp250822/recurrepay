import type { User as FirebaseUser } from 'firebase/auth';
import type { z } from 'zod';
import type { publicClientSchema } from '@/lib/schema';


export interface PaymentRecord {
  id: string;
  paymentDate: string; // ISO string - Date the payment was made or recorded as made
  amountPaid: number;
  recordedAt: string; // ISO string - Timestamp of when the record was created in the system
  paymentMethod?: string; // Optional: Method used for this specific payment
  notes?: string; // Optional: Any notes for this specific payment
  siigoInvoiceUrl?: string; // Optional: Link to the Siigo e-invoice
  
  // ✅ Campos para el sistema de validación
  status: 'pending' | 'validated' | 'rejected'; // Estado del pago
  proofUrl?: string; // URL del comprobante subido por el cliente
  proofFileName?: string; // Nombre del archivo del comprobante
  submittedBy: 'client' | 'admin'; // Quien registró el pago
  clientId?: string; // ID del cliente (para pagos subidos por clientes)
  
  // ✅ Campos para validación por admin
  validatedAt?: string; // Fecha de validación por el admin
  validatedBy?: string; // ID del admin que validó
  rejectionReason?: string; // Razón de rechazo si aplica
  
  // ✅ NUEVO: Información de cuotas
  installmentNumber?: number; // Número de cuota (1, 2, 3, etc.)
  totalInstallments?: number; // Total de cuotas del plan
  installmentType?: 'monthly' | 'single' | 'downpayment'; // Tipo de cuota
}

// ✅ NUEVO: Interface para cuotas pendientes
export interface PendingInstallment {
  number: number;
  dueDate: string;
  amount: number;
  status: 'pending' | 'overdue';
  description: string;
}

export interface Client {
  id:string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  firebaseId?: string; // ✅ Asegurarse de que este campo existe

  contractValue?: number;
  applyIva?: boolean; 
  ivaRate?: number; 
  ivaAmount?: number; 
  totalWithIva?: number; 

  downPaymentPercentage?: number; 
  downPayment?: number; 
  
  amountToFinance?: number; 
  
  paymentMethod?: string; 
  financingPlan?: number; 
  financingInterestRateApplied?: number; 
  financingInterestAmount?: number; 
  totalAmountWithInterest?: number; 

  paymentAmount: number; 
  paymentDayOfMonth: number; 
  
  nextPaymentDate: string; 
  createdAt: string; 

  acceptanceLetterUrl?: string;
  acceptanceLetterFileName?: string;
  contractFileUrl?: string;
  contractFileName?: string;

  paymentsMadeCount?: number; 
  status?: 'active' | 'completed' | 'defaulted' | 'pending_approval';
}

export type ClientFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  contractValue?: number;
  applyIva?: boolean;
  downPaymentPercentage?: number; 
  paymentMethod?: string;
  financingPlan?: number; 
  paymentDayOfMonth: number;
  paymentAmount?: number; 

  acceptanceLetterFile?: File | null;
  contractFileFile?: File | null;

  acceptanceLetterUrl?: string;
  acceptanceLetterFileName?: string;
  contractFileUrl?: string;
  contractFileName?: string;
};

export type PublicClientFormData = z.infer<typeof publicClientSchema> & {
  email: string; // Email is added here after user registration step
  applyIva?: boolean; // Added for self-registration
  acceptanceLetterUrl?: string;
  acceptanceLetterFileName?: string;
  contractFileUrl?: string;
  contractFileName?: string;
};


export type AppUser = FirebaseUser;

export interface FinancingPlanSetting {
  months: number;
  label: string;
  rate: number; 
  isDefault?: boolean; 
  isConfigurable?: boolean; 
}

export interface AppFinancingSettings {
  plans: FinancingPlanSetting[];
}

export interface AppGeneralSettings {
  appName?: string;
  appLogoUrl?: string;
  notificationsEnabled?: boolean;
  themePrimary?: string; 
  themeSecondary?: string; 
  themeAccent?: string; 
  themeBackground?: string; 
  themeForeground?: string; 
}

export type AppGeneralSettingsFormData = {
  appName?: string;
  appLogoFile?: File | null; 
  appLogoUrl?: string; 
  notificationsEnabled?: boolean;
  themePrimary?: string;
  themeSecondary?: string;
  themeAccent?: string;
  themeBackground?: string;
  themeForeground?: string;
};

