// In a real application, this would be a database (e.g., Firebase Firestore)
import type { Client, ClientFormData } from '@/types';
import { calculateNextPaymentDate } from '@/lib/utils';

let clients: Client[] = [
  {
    id: '1',
    firstName: 'Alice',
    lastName: 'Smith',
    email: 'alice.smith@example.com',
    phoneNumber: '555-1234',
    paymentAmount: 75.00,
    paymentDayOfMonth: 15,
    nextPaymentDate: calculateNextPaymentDate(15).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    firstName: 'Bob',
    lastName: 'Johnson',
    email: 'bob.johnson@example.com',
    phoneNumber: '555-5678',
    paymentAmount: 120.50,
    paymentDayOfMonth: 1,
    nextPaymentDate: calculateNextPaymentDate(1).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    firstName: 'Carol',
    lastName: 'Williams',
    email: 'carol.williams@example.com',
    phoneNumber: '555-8765',
    paymentAmount: 50.00,
    paymentDayOfMonth: 28,
    nextPaymentDate: calculateNextPaymentDate(28).toISOString(),
    createdAt: new Date().toISOString(),
  },
];

export async function getClients(): Promise<Client[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return [...clients].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getClientById(id: string): Promise<Client | undefined> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return clients.find(client => client.id === id);
}

export async function addClient(clientData: ClientFormData): Promise<{ client?: Client, error?: string }> {
  await new Promise(resolve => setTimeout(resolve, 500));
  if (clients.some(c => c.email === clientData.email)) {
    return { error: "Email address already exists." };
  }
  const newClient: Client = {
    ...clientData,
    id: String(Date.now()), // Simple ID generation for mock
    nextPaymentDate: calculateNextPaymentDate(clientData.paymentDayOfMonth).toISOString(),
    createdAt: new Date().toISOString(),
  };
  clients.push(newClient);
  return { client: newClient };
}

export async function updateClient(id: string, clientData: ClientFormData): Promise<{ client?: Client, error?: string }> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const clientIndex = clients.findIndex(client => client.id === id);
  if (clientIndex === -1) {
    return { error: "Client not found." };
  }
  if (clients.some(c => c.email === clientData.email && c.id !== id)) {
    return { error: "Email address already exists for another client." };
  }
  const updatedClient = {
    ...clients[clientIndex],
    ...clientData,
    nextPaymentDate: calculateNextPaymentDate(clientData.paymentDayOfMonth).toISOString(),
  };
  clients[clientIndex] = updatedClient;
  return { client: updatedClient };
}

export async function deleteClient(id: string): Promise<{ success?: boolean, error?: string }> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const initialLength = clients.length;
  clients = clients.filter(client => client.id !== id);
  if (clients.length === initialLength) {
    return { error: "Client not found." };
  }
  return { success: true };
}
