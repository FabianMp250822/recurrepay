
import type { Client } from '@/types';
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
  orderBy
} from 'firebase/firestore';

const CLIENTS_COLLECTION = 'listapagospendiendes';

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
      // This will make the error more specific when it propagates to the Server Component
      throw new Error("Firestore permission denied when fetching clients. Ensure Firebase security rules allow read access to the 'listapagospendiendes' collection for authenticated admins, and that admin status (e.g., 'activo: true' in 'administradores' collection) is correctly set and accessible by the rules.");
    }
    // For other types of errors, rethrow a generic or more specific error
    throw new Error(`Failed to fetch clients due to Firestore error: ${error.message || 'Unknown Firestore error'}. Code: ${error.code || 'N/A'}`);
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
  } catch (error: any) {
    console.error("Error fetching client by ID from Firestore (FULL ERROR OBJECT):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
     if (error.code === 'permission-denied') {
      throw new Error(`Firestore permission denied when fetching client by ID '${id}'. Check security rules and admin status.`);
    }
    throw new Error(`Failed to fetch client by ID '${id}': ${error.message || 'Unknown Firestore error'}`);
  }
}

export async function addClient(clientData: Omit<Client, 'id'>): Promise<{ client?: Client, error?: string }> {
  try {
    const q = query(collection(db, CLIENTS_COLLECTION), where('email', '==', clientData.email));
    // The getDocs call below also requires read permission. If getClients is failing due to read permissions,
    // this query might also fail silently or contribute to permission issues if rules are very granular.
    // For now, focusing on the explicit error from getClients.
    const emailQuerySnapshot = await getDocs(q);
    if (!emailQuerySnapshot.empty) {
      return { error: "La dirección de correo electrónico ya existe para otro cliente." };
    }

    const docRef = await addDoc(collection(db, CLIENTS_COLLECTION), clientData);
    return { client: { id: docRef.id, ...clientData } };
  } catch (error: any) {
    console.error("Error adding client to Firestore (FULL ERROR OBJECT):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    let userMessage = "Error al agregar el cliente. Inténtelo de nuevo.";
    if (error.code) {
      switch (error.code) {
        case 'permission-denied':
          userMessage = "Permiso denegado por Firestore. Verifique las reglas de seguridad y que los datos del administrador (UID y campo 'activo') sean correctos en la colección 'administradores'.";
          break;
        case 'unavailable':
          userMessage = "No se pudo conectar a Firestore. Verifique su conexión a internet.";
          break;
        case 'invalid-argument':
          userMessage = "Error al agregar el cliente: Uno o más campos tienen datos inválidos o faltantes según Firestore. Revise los datos del formulario.";
           if (error.message && error.message.includes("Unsupported field value: undefined")) {
            userMessage = "Error al agregar el cliente: Se intentó guardar un valor 'undefined' en un campo. Asegúrese de que todos los campos obligatorios tengan valor.";
          }
          break;
        default:
          userMessage = `Error de Firestore al agregar: ${error.message} (Código: ${error.code})`;
      }
    } else if (error instanceof Error) {
      userMessage = error.message;
    }
    return { error: userMessage };
  }
}

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

    const dataToUpdate = {
        ...clientData,
        createdAt: originalClientData.createdAt
    };

    await updateDoc(clientDocRef, dataToUpdate);
    return { client: { id: id, ...dataToUpdate } };

  } catch (error: any) {
    console.error("Error updating client in Firestore (FULL ERROR OBJECT):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    let userMessage = "Error al actualizar el cliente. Inténtelo de nuevo.";
     if (error.code) {
      switch (error.code) {
        case 'permission-denied':
          userMessage = "Permiso denegado por Firestore. Verifique las reglas de seguridad y que los datos del administrador (UID y campo 'activo') sean correctos en la colección 'administradores'.";
          break;
        case 'unavailable':
          userMessage = "No se pudo conectar a Firestore. Verifique su conexión a internet.";
          break;
        case 'invalid-argument':
           userMessage = "Error al actualizar el cliente: Uno o más campos tienen datos inválidos o faltantes según Firestore. Revise los datos del formulario.";
           if (error.message && error.message.includes("Unsupported field value: undefined")) {
            userMessage = "Error al actualizar el cliente: Se intentó guardar un valor 'undefined' en un campo. Asegúrese de que todos los campos obligatorios tengan valor.";
          }
          break;
        default:
          userMessage = `Error de Firestore al actualizar: ${error.message} (Código: ${error.code})`;
      }
    } else if (error instanceof Error) {
      userMessage = error.message;
    }
    return { error: userMessage };
  }
}

export async function deleteClient(id: string): Promise<{ success?: boolean, error?: string }> {
  try {
    const clientDocRef = doc(db, CLIENTS_COLLECTION, id);
    await deleteDoc(clientDocRef);
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting client from Firestore (FULL ERROR OBJECT):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    let userMessage = "Error al eliminar el cliente. Inténtelo de nuevo.";
    if (error.code && error.code === 'permission-denied') {
        userMessage = "Permiso denegado por Firestore para eliminar. Verifique las reglas de seguridad y los datos del administrador.";
    } else if (error instanceof Error) {
        userMessage = error.message;
    }
    return { error: userMessage };
  }
}

    