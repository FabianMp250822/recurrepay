
import type { Client, ClientFormData } from '@/types';
import { calculateNextPaymentDate } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';

const CLIENTS_COLLECTION = 'listapagospendiendes';

export async function getClients(): Promise<Client[]> {
  try {
    const clientsCollectionRef = collection(db, CLIENTS_COLLECTION);
    const q = query(clientsCollectionRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const clientsList: Client[] = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<Client, 'id'>)
    }));
    return clientsList;
  } catch (error) {
    console.error("Error fetching clients from Firestore:", error);
    return []; // Return empty array on error
  }
}

export async function getClientById(id: string): Promise<Client | undefined> {
  try {
    const clientDocRef = doc(db, CLIENTS_COLLECTION, id);
    const clientDocSnap = await getDoc(clientDocRef);
    if (clientDocSnap.exists()) {
      return { id: clientDocSnap.id, ...(clientDocSnap.data() as Omit<Client, 'id'>) };
    }
    return undefined;
  } catch (error) {
    console.error("Error fetching client by ID from Firestore:", error);
    return undefined;
  }
}

export async function addClient(clientData: ClientFormData): Promise<{ client?: Client, error?: string }> {
  try {
    // Check for existing email
    const q = query(collection(db, CLIENTS_COLLECTION), where('email', '==', clientData.email));
    const emailQuerySnapshot = await getDocs(q);
    if (!emailQuerySnapshot.empty) {
      return { error: "La dirección de correo electrónico ya existe." };
    }

    const newClientData = {
      ...clientData,
      paymentAmount: Number(clientData.paymentAmount), // Ensure it's a number
      paymentDayOfMonth: Number(clientData.paymentDayOfMonth), // Ensure it's a number
      nextPaymentDate: calculateNextPaymentDate(Number(clientData.paymentDayOfMonth)).toISOString(),
      createdAt: new Date().toISOString(),
    };
    const docRef = await addDoc(collection(db, CLIENTS_COLLECTION), newClientData);
    return { client: { id: docRef.id, ...newClientData } };
  } catch (error) {
    console.error("Error adding client to Firestore:", error);
    return { error: "Error al agregar el cliente. Inténtelo de nuevo." };
  }
}

export async function updateClient(id: string, clientData: ClientFormData): Promise<{ client?: Client, error?: string }> {
  try {
    const clientDocRef = doc(db, CLIENTS_COLLECTION, id);
    const clientDocSnap = await getDoc(clientDocRef);

    if (!clientDocSnap.exists()) {
      return { error: "Cliente no encontrado." };
    }

    // Check if email is being changed to one that already exists for another client
    if (clientData.email !== clientDocSnap.data().email) {
      const q = query(collection(db, CLIENTS_COLLECTION), where('email', '==', clientData.email));
      const emailQuerySnapshot = await getDocs(q);
      if (!emailQuerySnapshot.empty) {
        // Check if the found client is different from the one being updated
        const existingClient = emailQuerySnapshot.docs[0];
        if (existingClient.id !== id) {
          return { error: "La dirección de correo electrónico ya existe para otro cliente." };
        }
      }
    }
    
    const updatedData = {
      ...clientData,
      paymentAmount: Number(clientData.paymentAmount),
      paymentDayOfMonth: Number(clientData.paymentDayOfMonth),
      nextPaymentDate: calculateNextPaymentDate(Number(clientData.paymentDayOfMonth)).toISOString(),
      // createdAt should not be updated, keep original
    };

    await updateDoc(clientDocRef, updatedData);
    // Construct the client object to return by merging original with updated data
    const finalClientData = { ...clientDocSnap.data(), ...updatedData } as Omit<Client, 'id'>;
    return { client: { id: id, ...finalClientData } };

  } catch (error) {
    console.error("Error updating client in Firestore:", error);
    return { error: "Error al actualizar el cliente. Inténtelo de nuevo." };
  }
}

export async function deleteClient(id: string): Promise<{ success?: boolean, error?: string }> {
  try {
    const clientDocRef = doc(db, CLIENTS_COLLECTION, id);
    await deleteDoc(clientDocRef);
    return { success: true };
  } catch (error) {
    console.error("Error deleting client from Firestore:", error);
    return { error: "Error al eliminar el cliente. Inténtelo de nuevo." };
  }
}
