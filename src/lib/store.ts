
import type { Client } from '@/types';
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
  Timestamp // For createdAt
} from 'firebase/firestore';

const CLIENTS_COLLECTION = 'listapagospendiendes';

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

// WRITE operations now also use the Client SDK (db)
export async function addClient(clientData: Omit<Client, 'id'>): Promise<{ client?: Client, error?: string }> {
  try {
    const clientsCollectionRef = collection(db, CLIENTS_COLLECTION);
    
    // Check for duplicate email
    const emailQuery = queryClient(clientsCollectionRef, whereClient('email', '==', clientData.email));
    const emailQuerySnapshot = await getDocsClient(emailQuery);
    if (!emailQuerySnapshot.empty) {
      return { error: "La dirección de correo electrónico ya existe para otro cliente." };
    }

    // Add createdAt timestamp if it's not already part of clientData (it should be set by clientActions)
    const dataToSave = {
        ...clientData,
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

export async function updateClient(id: string, clientData: Omit<Client, 'id' | 'createdAt'>): Promise<{ client?: Client, error?: string }> {
  try {
    const clientDocRef = docClient(db, CLIENTS_COLLECTION, id);
    const clientDocSnap = await getDocClient(clientDocRef);

    if (!clientDocSnap.exists()) {
      return { error: "Cliente no encontrado." };
    }

    const originalClientData = clientDocSnap.data() as Client;

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
    
    const dataToUpdate = {
        ...clientData,
        // Ensure createdAt is preserved if it existed or set if it's a full update from partial data
        createdAt: originalClientData.createdAt || Timestamp.now().toDate().toISOString() 
    };

    await updateDocClient(clientDocRef, dataToUpdate);
    // Construct the full client object to return
    const updatedClient : Client = { 
        id: id, 
        firstName: dataToUpdate.firstName ?? originalClientData.firstName,
        lastName: dataToUpdate.lastName ?? originalClientData.lastName,
        email: dataToUpdate.email ?? originalClientData.email,
        phoneNumber: dataToUpdate.phoneNumber ?? originalClientData.phoneNumber,
        contractValue: dataToUpdate.contractValue ?? originalClientData.contractValue,
        ivaRate: dataToUpdate.ivaRate ?? originalClientData.ivaRate,
        ivaAmount: dataToUpdate.ivaAmount ?? originalClientData.ivaAmount,
        totalWithIva: dataToUpdate.totalWithIva ?? originalClientData.totalWithIva,
        downPaymentPercentage: dataToUpdate.downPaymentPercentage ?? originalClientData.downPaymentPercentage,
        downPayment: dataToUpdate.downPayment ?? originalClientData.downPayment,
        amountToFinance: dataToUpdate.amountToFinance ?? originalClientData.amountToFinance,
        paymentMethod: dataToUpdate.paymentMethod ?? originalClientData.paymentMethod,
        financingPlan: dataToUpdate.financingPlan ?? originalClientData.financingPlan,
        financingInterestRateApplied: dataToUpdate.financingInterestRateApplied ?? originalClientData.financingInterestRateApplied,
        financingInterestAmount: dataToUpdate.financingInterestAmount ?? originalClientData.financingInterestAmount,
        totalAmountWithInterest: dataToUpdate.totalAmountWithInterest ?? originalClientData.totalAmountWithInterest,
        paymentAmount: dataToUpdate.paymentAmount ?? originalClientData.paymentAmount,
        paymentDayOfMonth: dataToUpdate.paymentDayOfMonth ?? originalClientData.paymentDayOfMonth,
        nextPaymentDate: dataToUpdate.nextPaymentDate ?? originalClientData.nextPaymentDate,
        createdAt: originalClientData.createdAt, // always preserve original
        acceptanceLetterUrl: dataToUpdate.acceptanceLetterUrl ?? originalClientData.acceptanceLetterUrl,
        acceptanceLetterFileName: dataToUpdate.acceptanceLetterFileName ?? originalClientData.acceptanceLetterFileName,
        contractFileUrl: dataToUpdate.contractFileUrl ?? originalClientData.contractFileUrl,
        contractFileName: dataToUpdate.contractFileName ?? originalClientData.contractFileName,
    };

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
    const clientDocRef = docClient(db, CLIENTS_COLLECTION, id);
    await deleteDocClient(clientDocRef);
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
