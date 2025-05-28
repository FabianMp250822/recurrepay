
import type { Client, PaymentRecord } from '@/types';
import { db } from '@/lib/firebase'; // Client SDK for ALL operations now
import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  Timestamp,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';

const CLIENTS_COLLECTION = 'listapagospendiendes';
const PAYMENT_HISTORY_SUBCOLLECTION = 'paymentHistory';


// READ operations use the Client SDK (db)
export async function getClients(): Promise<Client[]> {
  try {
    const clientsCollectionRef = collection(db, CLIENTS_COLLECTION);
    const q = query(clientsCollectionRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const clientsList: Client[] = querySnapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Client, 'id'>)
    }));
    return clientsList;
  } catch (error: any) {
    console.error("Error fetching clients from Firestore (FULL ERROR OBJECT):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
     if (error.code === 'permission-denied') {
      throw new Error("Permiso denegado por Firestore al buscar clientes. Verifique las reglas de seguridad y que los datos del administrador (UID y campo 'activo') sean correctos en la colección 'administradores'.");
    }
    throw new Error(`Error al buscar clientes de Firestore: ${error.message || 'Error desconocido de Firestore'}. Código: ${error.code || 'N/A'}`);
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
  } catch (error: any)
 {
    console.error("Error fetching client by ID from Firestore (FULL ERROR OBJECT):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
     if (error.code === 'permission-denied') {
      throw new Error(`Permiso denegado por Firestore al buscar cliente por ID '${id}'. Verifique las reglas de seguridad y asegúrese de que el usuario esté autenticado. Si se requieren verificaciones de administrador, verifique el estado del administrador.`);
    }
    throw new Error(`Error al buscar cliente por ID '${id}': ${error.message || 'Error desconocido de Firestore'}`);
  }
}

// WRITE operations will now use the Client SDK (db) as well.
// This means they will be subject to Firestore security rules from the client's perspective.
// If called from Server Actions, request.auth will be null in security rules.
export async function addClient(clientData: Omit<Client, 'id'>): Promise<{ client?: Client, error?: string }> {
  try {
    const clientsCollectionRef = collection(db, CLIENTS_COLLECTION);
    
    // Client-side email check (optional, but good practice if rules don't enforce uniqueness server-side)
    const emailQuery = query(clientsCollectionRef, where('email', '==', clientData.email));
    const emailQuerySnapshot = await getDocs(emailQuery);
    if (!emailQuerySnapshot.empty) {
      return { error: "La dirección de correo electrónico ya existe para otro cliente." };
    }

    const dataToSave = {
        ...clientData,
        paymentsMadeCount: clientData.paymentsMadeCount || 0,
        status: clientData.status || 'active',
        createdAt: clientData.createdAt || Timestamp.now().toDate().toISOString() 
    };

    const docRef = await addDoc(clientsCollectionRef, dataToSave);
    return { client: { id: docRef.id, ...dataToSave } };
  } catch (error: any) {
    console.error("Error adding client to Firestore (Client SDK) (FULL ERROR OBJECT):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    let userMessage = "Error al agregar el cliente. Inténtelo de nuevo.";
    if (error.code === 'permission-denied') {
         userMessage = "Permiso denegado por Firestore al intentar guardar el cliente. Verifique las reglas de seguridad. Si las operaciones se realizan desde el servidor (ej. Server Actions), el Firebase Client SDK no tendrá un usuario autenticado, causando este error con reglas que requieran autenticación.";
    } else if (error.code === 'invalid-argument') {
        userMessage = "Error al agregar el cliente: argumento inválido. Verifique los datos enviados.";
    } else if (error instanceof Error && (error.message.includes("undefined") || error.message.includes("NaN"))) {
        userMessage = `Error al agregar cliente: uno o más campos tienen valores inválidos (undefined o NaN). Por favor, revise los datos del formulario y los cálculos. Detalle: ${error.message}`;
    } else if (error instanceof Error) {
        userMessage = `Error al agregar cliente (Client SDK): ${error.message}`;
    }
    return { error: userMessage };
  }
}

export async function updateClient(id: string, clientData: Partial<Omit<Client, 'id'>>): Promise<{ client?: Client, error?: string }> {
  try {
    const clientDocRef = doc(db, CLIENTS_COLLECTION, id);
    const clientDocSnap = await getDoc(clientDocRef);

    if (!clientDocSnap.exists()) {
      return { error: "Cliente no encontrado." };
    }
    const originalClientData = { id: clientDocSnap.id, ...clientDocSnap.data() } as Client;

    if (clientData.email && clientData.email !== originalClientData.email) {
      const clientsCollectionRef = collection(db, CLIENTS_COLLECTION);
      const emailQuery = query(clientsCollectionRef, where('email', '==', clientData.email));
      const emailQuerySnapshot = await getDocs(emailQuery);
      if (!emailQuerySnapshot.empty) {
        const existingClientDoc = emailQuerySnapshot.docs[0];
        if (existingClientDoc.id !== id) {
          return { error: "La dirección de correo electrónico ya existe para otro cliente." };
        }
      }
    }
    
    const dataToUpdate: Partial<Client> = { ...clientData };

    await updateDoc(clientDocRef, dataToUpdate);
    
    const updatedClientSnapshot = await getDoc(clientDocRef);
    const updatedClient = { id: updatedClientSnapshot.id, ...updatedClientSnapshot.data() } as Client;

    return { client: updatedClient };

  } catch (error: any) {
    console.error("Error updating client in Firestore (Client SDK) (FULL ERROR OBJECT):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    let userMessage = "Error al actualizar el cliente. Inténtelo de nuevo.";
    if (error.code === 'permission-denied') {
        userMessage = "Permiso denegado por Firestore al intentar actualizar el cliente. Verifique las reglas de seguridad. Si las operaciones se realizan desde el servidor (ej. Server Actions), el Firebase Client SDK no tendrá un usuario autenticado.";
    } else if (error.code === 'invalid-argument') {
        userMessage = "Error al actualizar el cliente: argumento inválido. Verifique los datos enviados.";
     } else if (error instanceof Error && (error.message.includes("undefined") || error.message.includes("NaN"))) {
        userMessage = `Error al actualizar cliente: uno o más campos tienen valores inválidos (undefined o NaN). Por favor, revise los datos del formulario y los cálculos. Detalle: ${error.message}`;
    } else if (error instanceof Error) {
        userMessage = `Error al actualizar cliente (Client SDK): ${error.message}`;
    }
    return { error: userMessage };
  }
}

export async function deleteClient(id: string): Promise<{ success?: boolean, error?: string }> {
  try {
    const clientDocRef = doc(db, CLIENTS_COLLECTION, id);
    
    // To delete subcollections with the client SDK, you need to list and delete each document.
    // This is more complex than with Admin SDK. For simplicity, skipping subcollection deletion here.
    // If needed, implement recursive deletion logic for paymentHistory.

    await deleteDoc(clientDocRef);
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting client from Firestore (Client SDK) (FULL ERROR OBJECT):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    let userMessage = "Error al eliminar el cliente. Inténtelo de nuevo.";
    if (error.code === 'permission-denied') {
        userMessage = "Permiso denegado por Firestore al intentar eliminar el cliente. Verifique las reglas de seguridad. Si las operaciones se realizan desde el servidor (ej. Server Actions), el Firebase Client SDK no tendrá un usuario autenticado.";
    } else if (error instanceof Error) {
        userMessage = `Error al eliminar cliente (Client SDK): ${error.message}`;
    }
    return { error: userMessage };
  }
}

export async function addPaymentToHistory(clientId: string, paymentData: Omit<PaymentRecord, 'id' | 'recordedAt'>): Promise<{ record?: PaymentRecord, error?: string }> {
  try {
    const historyCollectionRef = collection(db, CLIENTS_COLLECTION, clientId, PAYMENT_HISTORY_SUBCOLLECTION);
    const dataToSave = {
      ...paymentData,
      recordedAt: Timestamp.now().toDate().toISOString(), // Use client-side Timestamp
    };
    const docRef = await addDoc(historyCollectionRef, dataToSave);
    return { record: { id: docRef.id, ...dataToSave } };
  } catch (error: any) {
    console.error(`Error adding payment to history for client ${clientId} (Client SDK):`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    let userMessage = "Error al registrar el pago en el historial.";
    if (error.code === 'permission-denied') {
      userMessage = "Permiso denegado por Firestore al registrar el pago en el historial. Verifique las reglas de seguridad. Si las operaciones se realizan desde el servidor (ej. Server Actions), el Firebase Client SDK no tendrá un usuario autenticado.";
    } else if (error instanceof Error) {
      userMessage = `Error al registrar pago en historial: ${error.message}`;
    }
    return { error: userMessage };
  }
}

export async function getPaymentHistory(clientId: string): Promise<PaymentRecord[]> {
  if (!db) {
    console.error("CRITICAL_STORE_ERROR: Firestore client instance (db) is null in getPaymentHistory.");
    return [];
  }
  try {
    const historyCollectionRef = collection(db, CLIENTS_COLLECTION, clientId, PAYMENT_HISTORY_SUBCOLLECTION);
    const q = query(historyCollectionRef, orderBy('paymentDate', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<PaymentRecord, 'id'>)
    }));
  } catch (error: any) {
    console.error(`Error fetching payment history for client ${clientId} (Client SDK):`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    if (error.code === 'permission-denied') {
      throw new Error(`Permiso denegado por Firestore al buscar historial de pagos para el cliente ${clientId}. Verifique las reglas de seguridad.`);
    }
    return [];
  }
}

    