// In a real application, this would be a database (e.g., Firebase Firestore)
import type { Client, ClientFormData } from '@/types';
import { calculateNextPaymentDate } from '@/lib/utils';

// No sample clients by default
let clients: Client[] = [];

export async function getClients(): Promise<Client[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100)); // Reduced delay as there's no data to process
  return [...clients].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getClientById(id: string): Promise<Client | undefined> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return clients.find(client => client.id === id);
}

export async function addClient(clientData: ClientFormData): Promise<{ client?: Client, error?: string }> {
  await new Promise(resolve => setTimeout(resolve, 200));
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
  await new Promise(resolve => setTimeout(resolve, 200));
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
  await new Promise(resolve => setTimeout(resolve, 200));
  const initialLength = clients.length;
  clients = clients.filter(client => client.id !== id);
  if (clients.length === initialLength) {
    return { error: "Client not found." };
  }
  return { success: true };
}
