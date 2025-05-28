
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from 'date-fns';
import { es } from 'date-fns/locale'; // Import Spanish locale

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
