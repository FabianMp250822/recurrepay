
import type { Client, PaymentRecord } from '@/types';
import { db } from '@/lib/firebase'; // Client SDK for all operations now
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
      throw new Error("Permiso denegado por Firestore al buscar clientes. Verifique las reglas de seguridad.");
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

// WRITE operations now also use the Client SDK (db)
export async function addClient(clientData: Omit<Client, 'id'>): Promise<{ client?: Client, error?: string }> {
   if (!db) {
    console.error("CRITICAL_STORE_ERROR: Firestore client instance (db) is null in addClient. Firebase may not be initialized correctly on the client-side or the import is failing.");
    return { error: "Error de la aplicación: La conexión con la base de datos no está inicializada. Contacte al administrador." };
  }
  try {
    const clientsCollectionRef = collection(db, CLIENTS_COLLECTION);
    
    const emailQuery = queryClient(clientsCollectionRef, whereClient('email', '==', clientData.email));
    const emailQuerySnapshot = await getDocsClient(emailQuery);
    if (!emailQuerySnapshot.empty) {
      return { error: "La dirección de correo electrónico ya existe para otro cliente." };
    }

    const dataToSave = {
        ...clientData,
        paymentsMadeCount: clientData.paymentsMadeCount || 0,
        status: clientData.status || 'active',
        createdAt: clientData.createdAt || Timestamp.now().toDate().toISOString() 
    };

    const docRef = await addDocClient(clientsCollectionRef, dataToSave);
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
   if (!db) {
    console.error("CRITICAL_STORE_ERROR: Firestore client instance (db) is null in updateClient. Firebase may not be initialized correctly on the client-side or the import is failing.");
    return { error: "Error de la aplicación: La conexión con la base de datos no está inicializada. Contacte al administrador." };
  }
  try {
    const clientDocRef = docClient(db, CLIENTS_COLLECTION, id);
    const clientDocSnap = await getDocClient(clientDocRef);

    if (!clientDocSnap.exists()) {
      return { error: "Cliente no encontrado." };
    }

    const originalClientData = { id: clientDocSnap.id, ...clientDocSnap.data() } as Client;

    if (clientData.email && clientData.email !== originalClientData.email) {
      const clientsCollectionRef = collection(db, CLIENTS_COLLECTION);
      const emailQuery = queryClient(clientsCollectionRef, whereClient('email', '==', clientData.email));
      const emailQuerySnapshot = await getDocsClient(emailQuery);
      if (!emailQuerySnapshot.empty) {
        const existingClientDoc = emailQuerySnapshot.docs[0];
        if (existingClientDoc.id !== id) {
          return { error: "La dirección de correo electrónico ya existe para otro cliente." };
        }
      }
    }
    
    // Ensure all fields that could be partial are handled correctly
    // by merging with original data.
    const dataToUpdate: Partial<Client> = {
      ...clientData, // incoming partial data
    };

    await updateDocClient(clientDocRef, dataToUpdate);
    
    const updatedClientSnapshot = await getDocClient(clientDocRef);
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
   if (!db) {
    console.error("CRITICAL_STORE_ERROR: Firestore client instance (db) is null in deleteClient. Firebase may not be initialized correctly on the client-side or the import is failing.");
    return { error: "Error de la aplicación: La conexión con la base de datos no está inicializada. Contacte al administrador." };
  }
  try {
    const clientDocRef = docClient(db, CLIENTS_COLLECTION, id);
    await deleteDocClient(clientDocRef);
    // Optionally, delete paymentHistory subcollection if needed, but this requires more complex logic
    // For now, we only delete the client document.
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
  if (!db) {
    console.error("CRITICAL_STORE_ERROR: Firestore client instance (db) is null in addPaymentToHistory.");
    return { error: "Error de la aplicación: La conexión con la base de datos no está inicializada." };
  }
  try {
    const historyCollectionRef = collection(db, CLIENTS_COLLECTION, clientId, PAYMENT_HISTORY_SUBCOLLECTION);
    const dataToSave = {
      ...paymentData,
      recordedAt: Timestamp.now().toDate().toISOString(),
    };
    const docRef = await addDocClient(historyCollectionRef, dataToSave);
    return { record: { id: docRef.id, ...dataToSave } };
  } catch (error: any) {
    console.error(`Error adding payment to history for client ${clientId} (Client SDK):`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    let userMessage = "Error al registrar el pago en el historial.";
    if (error.code === 'permission-denied') {
      userMessage = "Permiso denegado por Firestore al registrar el pago en el historial. Verifique las reglas de seguridad.";
    } else if (error instanceof Error) {
      userMessage = `Error al registrar pago en historial: ${error.message}`;
    }
    return { error: userMessage };
  }
}

export async function getPaymentHistory(clientId: string): Promise<PaymentRecord[]> {
  if (!db) {
    console.error("CRITICAL_STORE_ERROR: Firestore client instance (db) is null in getPaymentHistory.");
    return []; // Or throw an error
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
    // Depending on how you want to handle this, you could throw or return empty array with a console warning
    return [];
  }
}

