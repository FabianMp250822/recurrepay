import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from 'date-fns';

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

  // Determine if the payment day for this month has passed
  if (currentDate > paymentDayOfMonth) {
    nextPaymentMonth += 1;
    if (nextPaymentMonth > 11) { // Month overflow to next year
      nextPaymentMonth = 0; // January
      nextPaymentYear += 1;
    }
  }
  
  // Calculate the number of days in the target month to handle cases like Feb 30th
  const daysInTargetMonth = new Date(nextPaymentYear, nextPaymentMonth + 1, 0).getDate();
  const actualPaymentDay = Math.min(paymentDayOfMonth, daysInTargetMonth);

  return new Date(nextPaymentYear, nextPaymentMonth, actualPaymentDay);
}

export function formatDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return format(date, 'MMM dd, yyyy');
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function getDaysUntilDue(dateString: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize today to start of day
  const dueDate = new Date(dateString);
  dueDate.setHours(0, 0, 0, 0); // Normalize due date to start of day
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}
