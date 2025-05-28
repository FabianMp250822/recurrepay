
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
      ...(doc.data() as Omit<Client, 'id'>) // Casting to ensure all fields are recognized
    }));
    return clientsList;
  } catch (error) {
    console.error("Error fetching clients from Firestore:", error);
    return []; 
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

// addClient now expects a more complete Client object (excluding id) after calculations in actions
export async function addClient(clientData: Omit<Client, 'id'>): Promise<{ client?: Client, error?: string }> {
  try {
    // Check for existing email (already in schema, but good to double check if needed, though schema validation should be primary)
    const q = query(collection(db, CLIENTS_COLLECTION), where('email', '==', clientData.email));
    const emailQuerySnapshot = await getDocs(q);
    if (!emailQuerySnapshot.empty) {
      return { error: "La dirección de correo electrónico ya existe." };
    }

    const docRef = await addDoc(collection(db, CLIENTS_COLLECTION), clientData);
    return { client: { id: docRef.id, ...clientData } };
  } catch (error) {
    console.error("Error adding client to Firestore:", error);
    return { error: "Error al agregar el cliente. Inténtelo de nuevo." };
  }
}

// updateClient now expects a more complete Client object (excluding id, createdAt) after calculations in actions
export async function updateClient(id: string, clientData: Omit<Client, 'id' | 'createdAt'>): Promise<{ client?: Client, error?: string }> {
  try {
    const clientDocRef = doc(db, CLIENTS_COLLECTION, id);
    const clientDocSnap = await getDoc(clientDocRef);

    if (!clientDocSnap.exists()) {
      return { error: "Cliente no encontrado." };
    }

    const originalClientData = clientDocSnap.data() as Client;

    if (clientData.email !== originalClientData.email) {
      const q = query(collection(db, CLIENTS_COLLECTION), where('email', '==', clientData.email));
      const emailQuerySnapshot = await getDocs(q);
      if (!emailQuerySnapshot.empty) {
        const existingClient = emailQuerySnapshot.docs[0];
        if (existingClient.id !== id) {
          return { error: "La dirección de correo electrónico ya existe para otro cliente." };
        }
      }
    }
    
    // Merge with existing createdAt
    const dataToUpdate = {
        ...clientData,
        createdAt: originalClientData.createdAt // Preserve original creation date
    };

    await updateDoc(clientDocRef, dataToUpdate);
    return { client: { id: id, ...dataToUpdate } };

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
