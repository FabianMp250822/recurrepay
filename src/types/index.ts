
import type { User as FirebaseUser } from 'firebase/auth';

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  paymentAmount: number;
  paymentDayOfMonth: number;
  nextPaymentDate: string; // Store as ISO string
  createdAt: string; // Store as ISO string
}

export type ClientFormData = Omit<Client, 'id' | 'nextPaymentDate' | 'createdAt'>;

// Extended Firebase User type for our app context if needed,
// but for now, AuthContext will manage isAdmin separately.
export type AppUser = FirebaseUser;

