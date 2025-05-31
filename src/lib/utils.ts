import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from 'date-fns';
import { es } from 'date-fns/locale'; // Import Spanish locale
import { addMonths, parseISO, setDate, getDaysInMonth, isAfter, isBefore } from 'date-fns';
import type { Client, PaymentRecord, PendingInstallment } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateNextPaymentDate(paymentDayOfMonth: number): Date {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-11
  const currentDate = today.getDate();

  let nextPaymentYear = currentYear;
  let nextPaymentMonth = currentMonth;

  if (currentDate > paymentDayOfMonth) {
    nextPaymentMonth += 1;
    if (nextPaymentMonth > 11) { 
      nextPaymentMonth = 0; 
      nextPaymentYear += 1;
    }
  }
  
  const daysInTargetMonth = new Date(nextPaymentYear, nextPaymentMonth + 1, 0).getDate();
  const actualPaymentDay = Math.min(paymentDayOfMonth, daysInTargetMonth);

  return new Date(nextPaymentYear, nextPaymentMonth, actualPaymentDay);
}

export function formatDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  // Using 'dd MMM yyyy' format with Spanish locale for month names
  return format(date, 'dd MMM yyyy', { locale: es }); 
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', { // Using Colombian Spanish for currency format example
    style: 'currency',
    currency: 'COP', // Changed to COP, assuming Colombian context. Change if needed.
    minimumFractionDigits: 0, // Optional: For COP, often no decimals are used
    maximumFractionDigits: 0, // Optional: For COP
  }).format(amount);
}

export function getDaysUntilDue(dateString: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0); 
  const dueDate = new Date(dateString);
  dueDate.setHours(0, 0, 0, 0); 
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function cleanPhoneNumberForWhatsApp(phoneNumber: string): string {
  // Remover caracteres no numéricos excepto el + inicial si existe
  let cleaned = phoneNumber.replace(/[^\d+]/g, "");
  // Si empieza con +, quitarlo para wa.me, ya que el código de país se asume o se añade sin el +
  // wa.me espera el número sin el +, ej: 573001234567
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  // Aquí podrías añadir lógica para asegurar que tenga el código de país si no lo tiene.
  // Por ejemplo, si es un número colombiano y no empieza con 57, añadirlo.
  // Esta es una simplificación. Para un uso robusto, se necesitaría una validación/formateo más exhaustivo.
  return cleaned;
}

// ✅ NUEVA función para calcular cuotas pendientes
export function calculatePendingInstallments(client: Client, paymentHistory: PaymentRecord[]): PendingInstallment[] {
  const pendingInstallments: PendingInstallment[] = [];
  
  // Si el cliente ya completó el plan, no hay cuotas pendientes
  if (client.status === 'completed') {
    return [];
  }

  // Determinar el tipo de plan
  const isFinancingPlan = client.financingPlan && client.financingPlan > 0;
  const isSinglePayment = !isFinancingPlan && (client.contractValue || 0) < 1000000;
  
  if (isSinglePayment) {
    // Pago único - solo una cuota
    const hasPayment = paymentHistory.some(p => p.status === 'validated');
    if (!hasPayment) {
      pendingInstallments.push({
        number: 1,
        dueDate: client.nextPaymentDate,
        amount: client.paymentAmount,
        status: isAfter(new Date(), parseISO(client.nextPaymentDate)) ? 'overdue' : 'pending',
        description: 'Pago único completo'
      });
    }
  } else if (isFinancingPlan) {
    // Plan de financiación - múltiples cuotas
    const totalInstallments = client.financingPlan!;
    const paymentsMade = client.paymentsMadeCount || 0;
    
    // Calcular cuotas pendientes
    let currentDate = parseISO(client.nextPaymentDate);
    
    for (let i = paymentsMade + 1; i <= totalInstallments; i++) {
      const installmentStatus = isAfter(new Date(), currentDate) ? 'overdue' : 'pending';
      
      pendingInstallments.push({
        number: i,
        dueDate: currentDate.toISOString(),
        amount: client.paymentAmount,
        status: installmentStatus,
        description: `Cuota ${i} de ${totalInstallments}`
      });
      
      // Avanzar al siguiente mes
      currentDate = addMonths(currentDate, 1);
      const targetDay = client.paymentDayOfMonth;
      const daysInNextMonth = getDaysInMonth(currentDate);
      currentDate = setDate(currentDate, Math.min(targetDay, daysInNextMonth));
    }
  } else {
    // Pago recurrente indefinido
    pendingInstallments.push({
      number: (client.paymentsMadeCount || 0) + 1,
      dueDate: client.nextPaymentDate,
      amount: client.paymentAmount,
      status: isAfter(new Date(), parseISO(client.nextPaymentDate)) ? 'overdue' : 'pending',
      description: 'Próximo pago mensual'
    });
  }
  
  return pendingInstallments;
}

// ✅ NUEVA función para obtener el número de cuota del próximo pago
export function getNextInstallmentNumber(client: Client, paymentHistory: PaymentRecord[]): number {
  const validatedPayments = paymentHistory.filter(p => p.status === 'validated').length;
  return validatedPayments + 1;
}

// ✅ NUEVA función para obtener información de cuota para un pago
export function getInstallmentInfo(client: Client, paymentHistory: PaymentRecord[]): {
  installmentNumber: number;
  totalInstallments: number | null;
  installmentType: 'monthly' | 'single' | 'downpayment';
} {
  const validatedPayments = paymentHistory.filter(p => p.status === 'validated').length;
  const nextInstallmentNumber = validatedPayments + 1;
  
  const isFinancingPlan = client.financingPlan && client.financingPlan > 0;
  const isSinglePayment = !isFinancingPlan && (client.contractValue || 0) < 1000000;
  
  if (isSinglePayment) {
    return {
      installmentNumber: 1,
      totalInstallments: 1,
      installmentType: 'single'
    };
  } else if (isFinancingPlan) {
    return {
      installmentNumber: nextInstallmentNumber,
      totalInstallments: client.financingPlan!,
      installmentType: 'monthly'
    };
  } else {
    return {
      installmentNumber: nextInstallmentNumber,
      totalInstallments: null, // Indefinido
      installmentType: 'monthly'
    };
  }
}
