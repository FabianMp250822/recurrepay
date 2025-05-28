
import type { Client, PaymentRecord } from '@/types';
import { db } from '@/lib/firebase'; // Client SDK for all operations now
import { adminDb } from '@/lib/firebase-admin'; // Admin SDK for server-side writes
import {
  collection,
  getDocs as getDocsClient,
  doc as docClient,
  getDoc as getDocClient,
  addDoc as addDocClient,
  updateDoc as updateDocClient,
  deleteDoc as deleteDocClient,
  query as queryClient,
  orderBy as orderByClient,
  where as whereClient,
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
      throw new Error("Permiso denegado por Firestore al buscar clientes. Verifique las reglas de seguridad y que los datos del administrador (UID y campo 'activo') sean correctos en la colección 'administradores'.");
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
  } catch (error: any)
 {
    console.error("Error fetching client by ID from Firestore (FULL ERROR OBJECT):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
     if (error.code === 'permission-denied') {
      throw new Error(`Permiso denegado por Firestore al buscar cliente por ID '${id}'. Verifique las reglas de seguridad y asegúrese de que el usuario esté autenticado. Si se requieren verificaciones de administrador, verifique el estado del administrador.`);
    }
    throw new Error(`Error al buscar cliente por ID '${id}': ${error.message || 'Error desconocido de Firestore'}`);
  }
}

// WRITE operations use Admin SDK for Server Actions
export async function addClient(clientData: Omit<Client, 'id'>): Promise<{ client?: Client, error?: string }> {
  if (!adminDb) {
    const errorMessage = "Error de servidor: La conexión con la base de datos (admin) no está inicializada. Por favor, revise los logs del servidor y contacte al administrador.";
    console.error("CRITICAL_STORE_ERROR (addClient): adminDb is null. Firebase Admin SDK might not be initialized correctly. Ensure GOOGLE_APPLICATION_CREDENTIALS_JSON is set and the server was restarted.");
    return { error: errorMessage };
  }
  try {
    const clientsCollectionRef = adminDb.collection(CLIENTS_COLLECTION);
    
    const emailQuery = await clientsCollectionRef.where('email', '==', clientData.email).get();
    if (!emailQuery.empty) {
      return { error: "La dirección de correo electrónico ya existe para otro cliente." };
    }

    const dataToSave = {
        ...clientData,
        paymentsMadeCount: clientData.paymentsMadeCount || 0,
        status: clientData.status || 'active',
        createdAt: clientData.createdAt || adminDb.Timestamp.now().toDate().toISOString() 
    };

    const docRef = await clientsCollectionRef.add(dataToSave);
    return { client: { id: docRef.id, ...dataToSave } };
  } catch (error: any) {
    console.error("Error adding client to Firestore (Admin SDK) (FULL ERROR OBJECT):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    let userMessage = "Error al agregar el cliente. Inténtelo de nuevo.";
    if (error.code === 'permission-denied') {
         userMessage = "Permiso denegado por Firestore al intentar guardar el cliente. Esto es inesperado si se usa el SDK de Admin, verifique la inicialización del SDK de Admin y los logs del servidor.";
    } else if (error.code === 'invalid-argument') {
        userMessage = "Error al agregar el cliente: argumento inválido. Verifique los datos enviados.";
    } else if (error instanceof Error && (error.message.includes("undefined") || error.message.includes("NaN"))) {
        userMessage = `Error al agregar cliente: uno o más campos tienen valores inválidos (undefined o NaN). Por favor, revise los datos del formulario y los cálculos. Detalle: ${error.message}`;
    } else if (error instanceof Error) {
        userMessage = `Error al agregar cliente (Admin SDK): ${error.message}`;
    }
    return { error: userMessage };
  }
}

export async function updateClient(id: string, clientData: Partial<Omit<Client, 'id'>>): Promise<{ client?: Client, error?: string }> {
  if (!adminDb) {
    const errorMessage = "Error de servidor: La conexión con la base de datos (admin) no está inicializada. Por favor, revise los logs del servidor y contacte al administrador.";
    console.error("CRITICAL_STORE_ERROR (updateClient): adminDb is null.");
    return { error: errorMessage };
  }
  try {
    const clientDocRef = adminDb.collection(CLIENTS_COLLECTION).doc(id);
    const clientDocSnap = await clientDocRef.get();

    if (!clientDocSnap.exists) {
      return { error: "Cliente no encontrado." };
    }

    const originalClientData = { id: clientDocSnap.id, ...clientDocSnap.data() } as Client;

    if (clientData.email && clientData.email !== originalClientData.email) {
      const clientsCollectionRef = adminDb.collection(CLIENTS_COLLECTION);
      const emailQuery = await clientsCollectionRef.where('email', '==', clientData.email).get();
      if (!emailQuery.empty) {
        const existingClientDoc = emailQuery.docs[0];
        if (existingClientDoc.id !== id) {
          return { error: "La dirección de correo electrónico ya existe para otro cliente." };
        }
      }
    }
    
    const dataToUpdate: Partial<Client> = { ...clientData };

    await clientDocRef.update(dataToUpdate);
    
    const updatedClientSnapshot = await clientDocRef.get();
    const updatedClient = { id: updatedClientSnapshot.id, ...updatedClientSnapshot.data() } as Client;

    return { client: updatedClient };

  } catch (error: any) {
    console.error("Error updating client in Firestore (Admin SDK) (FULL ERROR OBJECT):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    let userMessage = "Error al actualizar el cliente. Inténtelo de nuevo.";
    if (error.code === 'permission-denied') {
        userMessage = "Permiso denegado por Firestore al intentar actualizar el cliente. Inesperado con SDK de Admin.";
    } else if (error.code === 'invalid-argument') {
        userMessage = "Error al actualizar el cliente: argumento inválido. Verifique los datos enviados.";
     } else if (error instanceof Error && (error.message.includes("undefined") || error.message.includes("NaN"))) {
        userMessage = `Error al actualizar cliente: uno o más campos tienen valores inválidos (undefined o NaN). Por favor, revise los datos del formulario y los cálculos. Detalle: ${error.message}`;
    } else if (error instanceof Error) {
        userMessage = `Error al actualizar cliente (Admin SDK): ${error.message}`;
    }
    return { error: userMessage };
  }
}

export async function deleteClient(id: string): Promise<{ success?: boolean, error?: string }> {
  if (!adminDb) {
    const errorMessage = "Error de servidor: La conexión con la base de datos (admin) no está inicializada. Por favor, revise los logs del servidor y contacte al administrador.";
    console.error("CRITICAL_STORE_ERROR (deleteClient): adminDb is null.");
    return { error: errorMessage };
  }
  try {
    const clientDocRef = adminDb.collection(CLIENTS_COLLECTION).doc(id);
    
    // Optional: Delete paymentHistory subcollection. This requires a batched write or recursive delete function.
    // For simplicity, this example only deletes the main client document.
    // Consider implementing subcollection deletion if strict data removal is required.
    // Example (simple, may need adjustment for large subcollections):
    // const paymentHistoryRef = clientDocRef.collection(PAYMENT_HISTORY_SUBCOLLECTION);
    // const paymentHistorySnapshot = await paymentHistoryRef.get();
    // const batch = adminDb.batch();
    // paymentHistorySnapshot.docs.forEach(doc => batch.delete(doc.ref));
    // await batch.commit();

    await clientDocRef.delete();
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting client from Firestore (Admin SDK) (FULL ERROR OBJECT):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    let userMessage = "Error al eliminar el cliente. Inténtelo de nuevo.";
    if (error.code === 'permission-denied') {
        userMessage = "Permiso denegado por Firestore al intentar eliminar el cliente. Inesperado con SDK de Admin.";
    } else if (error instanceof Error) {
        userMessage = `Error al eliminar cliente (Admin SDK): ${error.message}`;
    }
    return { error: userMessage };
  }
}

export async function addPaymentToHistory(clientId: string, paymentData: Omit<PaymentRecord, 'id' | 'recordedAt'>): Promise<{ record?: PaymentRecord, error?: string }> {
  if (!adminDb) {
     const errorMessage = "Error de servidor: La conexión con la base de datos (admin) no está inicializada. Por favor, revise los logs del servidor y contacte al administrador.";
    console.error("CRITICAL_STORE_ERROR (addPaymentToHistory): adminDb is null.");
    return { error: errorMessage };
  }
  try {
    const historyCollectionRef = adminDb.collection(CLIENTS_COLLECTION).doc(clientId).collection(PAYMENT_HISTORY_SUBCOLLECTION);
    const dataToSave = {
      ...paymentData,
      recordedAt: adminDb.Timestamp.now().toDate().toISOString(),
    };
    const docRef = await historyCollectionRef.add(dataToSave);
    return { record: { id: docRef.id, ...dataToSave } };
  } catch (error: any) {
    console.error(`Error adding payment to history for client ${clientId} (Admin SDK):`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    let userMessage = "Error al registrar el pago en el historial.";
    if (error.code === 'permission-denied') {
      userMessage = "Permiso denegado por Firestore al registrar el pago en el historial. Inesperado con SDK de Admin.";
    } else if (error instanceof Error) {
      userMessage = `Error al registrar pago en historial: ${error.message}`;
    }
    return { error: userMessage };
  }
}

// Uses Client SDK as this will be called from a client component or a server component that needs user context for rules
export async function getPaymentHistory(clientId: string): Promise<PaymentRecord[]> {
  if (!db) {
    console.error("CRITICAL_STORE_ERROR: Firestore client instance (db) is null in getPaymentHistory.");
    return [];
  }
  try {
    const historyCollectionRef = collection(db, CLIENTS_COLLECTION, clientId, PAYMENT_HISTORY_SUBCOLLECTION);
    const q = queryClient(historyCollectionRef, orderByClient('paymentDate', 'desc'));
    const querySnapshot = await getDocsClient(q);
    return querySnapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<PaymentRecord, 'id'>)
    }));
  } catch (error: any) {
    console.error(`Error fetching payment history for client ${clientId} (Client SDK):`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    if (error.code === 'permission-denied') {
      throw new Error(`Permiso denegado por Firestore al buscar historial de pagos para el cliente ${clientId}. Verifique las reglas de seguridad.`);
    }
    // Depending on how you want to handle this, you could throw or return empty array with a console warning
    return [];
  }
}
