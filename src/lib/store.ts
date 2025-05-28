
import type { Client } from '@/types';
import { db } from '@/lib/firebase'; // Client SDK for reads
import { adminDb } from '@/lib/firebase-admin'; // Admin SDK for writes
import {
  collection,
  getDocs as getDocsClient, // Alias to avoid conflict
  doc as docClient,         // Alias to avoid conflict
  getDoc as getDocClient,   // Alias to avoid conflict
  query as queryClient,     // Alias to avoid conflict
  where as whereClient,     // Alias to avoid conflict
  orderBy as orderByClient  // Alias to avoid conflict
} from 'firebase/firestore'; // Client SDK imports

const CLIENTS_COLLECTION = 'listapagospendiendes';

// READ operations use the Client SDK (db) to respect security rules for client-side calls
export async function getClients(): Promise<Client[]> {
  try {
    const clientsCollectionRef = collection(db, CLIENTS_COLLECTION);
    const q = queryClient(clientsCollectionRef, orderByClient('createdAt', 'desc'));
    const querySnapshot = await getDocsClient(q);
    const clientsList: Client[] = querySnapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Client, 'id'>)
    }));
    return clientsList;
  } catch (error: any) {
    console.error("Error fetching clients from Firestore (FULL ERROR OBJECT):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    if (error.code === 'permission-denied') {
      throw new Error("Permiso denegado por Firestore al buscar clientes. Asegúrese de que las reglas de seguridad de Firebase permitan el acceso de lectura a la colección 'listapagospendiendes' para administradores autenticados y activos, y que su cuenta de administrador esté configurada correctamente con el estado 'activo: true'.");
    }
    throw new Error(`Error al buscar clientes de Firestore: ${error.message || 'Error desconocido de Firestore'}. Código: ${error.code || 'N/A'}`);
  }
}

export async function getClientById(id: string): Promise<Client | undefined> {
  try {
    const clientDocRef = docClient(db, CLIENTS_COLLECTION, id);
    const clientDocSnap = await getDocClient(clientDocRef);
    if (clientDocSnap.exists()) {
      return { id: clientDocSnap.id, ...(clientDocSnap.data() as Omit<Client, 'id'>) };
    }
    return undefined;
  } catch (error: any) {
    console.error("Error fetching client by ID from Firestore (FULL ERROR OBJECT):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
     if (error.code === 'permission-denied') {
      throw new Error(`Permiso denegado por Firestore al buscar cliente por ID '${id}'. Verifique las reglas de seguridad y asegúrese de que el usuario esté autenticado. Si se requieren verificaciones de administrador, verifique el estado del administrador.`);
    }
    throw new Error(`Error al buscar cliente por ID '${id}': ${error.message || 'Error desconocido de Firestore'}`);
  }
}

// WRITE operations use the Admin SDK (adminDb) to bypass security rules for server-side calls (Server Actions)
export async function addClient(clientData: Omit<Client, 'id'>): Promise<{ client?: Client, error?: string }> {
  try {
    // Email uniqueness check with Admin SDK
    const clientsCollectionRef = adminDb.collection(CLIENTS_COLLECTION);
    const emailQuerySnapshot = await clientsCollectionRef.where('email', '==', clientData.email).get();
    if (!emailQuerySnapshot.empty) {
      return { error: "La dirección de correo electrónico ya existe para otro cliente." };
    }

    const docRef = await clientsCollectionRef.add(clientData);
    return { client: { id: docRef.id, ...clientData } };
  } catch (error: any) {
    console.error("Error adding client to Firestore (Admin SDK) (FULL ERROR OBJECT):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    let userMessage = "Error al agregar el cliente. Inténtelo de nuevo.";
     if (error.code) { // Admin SDK errors might have different codes or structures
        userMessage = `Error de servidor al agregar cliente: ${error.message || 'Error desconocido del servidor'}. (AdminSDK)`;
     } else if (error instanceof Error) {
        userMessage = error.message;
     }
    return { error: userMessage };
  }
}

export async function updateClient(id: string, clientData: Omit<Client, 'id' | 'createdAt'>): Promise<{ client?: Client, error?: string }> {
  try {
    const clientDocRef = adminDb.collection(CLIENTS_COLLECTION).doc(id);
    const clientDocSnap = await clientDocRef.get();

    if (!clientDocSnap.exists) {
      return { error: "Cliente no encontrado." };
    }

    const originalClientData = clientDocSnap.data() as Client;

    if (clientData.email !== originalClientData.email) {
      const clientsCollectionRef = adminDb.collection(CLIENTS_COLLECTION);
      const emailQuerySnapshot = await clientsCollectionRef.where('email', '==', clientData.email).get();
      if (!emailQuerySnapshot.empty) {
        const existingClientDoc = emailQuerySnapshot.docs[0];
        if (existingClientDoc.id !== id) {
          return { error: "La dirección de correo electrónico ya existe para otro cliente." };
        }
      }
    }

    const dataToUpdate = {
        ...clientData,
        createdAt: originalClientData.createdAt // Preserve original creation date
    };

    await clientDocRef.update(dataToUpdate);
    return { client: { id: id, ...dataToUpdate } };

  } catch (error: any)
   {
    console.error("Error updating client in Firestore (Admin SDK) (FULL ERROR OBJECT):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    let userMessage = "Error al actualizar el cliente. Inténtelo de nuevo.";
    if (error.code) {
        userMessage = `Error de servidor al actualizar cliente: ${error.message || 'Error desconocido del servidor'}. (AdminSDK)`;
    } else if (error instanceof Error) {
        userMessage = error.message;
    }
    return { error: userMessage };
  }
}

export async function deleteClient(id: string): Promise<{ success?: boolean, error?: string }> {
  try {
    const clientDocRef = adminDb.collection(CLIENTS_COLLECTION).doc(id);
    await clientDocRef.delete();
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting client from Firestore (Admin SDK) (FULL ERROR OBJECT):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    let userMessage = "Error al eliminar el cliente. Inténtelo de nuevo.";
    if (error.code) {
        userMessage = `Error de servidor al eliminar cliente: ${error.message || 'Error desconocido del servidor'}. (AdminSDK)`;
    } else if (error instanceof Error) {
        userMessage = error.message;
    }
    return { error: userMessage };
  }
}
