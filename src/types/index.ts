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
