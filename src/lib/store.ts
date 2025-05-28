
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
    const clientsList: Client[] = querySnapshot.docs.map(docSnap => ({ // Renamed doc to docSnap to avoid conflict
      id: docSnap.id,
      ...(docSnap.data() as Omit<Client, 'id'>)
    }));
    return clientsList;
  } catch (error: any) {
    console.error("Error fetching clients from Firestore:", error);
    // Consider returning a more specific error or an empty array with a status
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
  } catch (error: any) {
    console.error("Error fetching client by ID from Firestore:", error);
    return undefined;
  }
}

export async function addClient(clientData: Omit<Client, 'id'>): Promise<{ client?: Client, error?: string }> {
  try {
    const q = query(collection(db, CLIENTS_COLLECTION), where('email', '==', clientData.email));
    const emailQuerySnapshot = await getDocs(q);
    if (!emailQuerySnapshot.empty) {
      return { error: "La dirección de correo electrónico ya existe para otro cliente." };
    }

    const docRef = await addDoc(collection(db, CLIENTS_COLLECTION), clientData);
    return { client: { id: docRef.id, ...clientData } };
  } catch (error: any) {
    console.error("Error adding client to Firestore:", error);
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
    console.error("Error updating client in Firestore:", error);
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
    console.error("Error deleting client from Firestore:", error);
    let userMessage = "Error al eliminar el cliente. Inténtelo de nuevo.";
    if (error.code && error.code === 'permission-denied') {
        userMessage = "Permiso denegado por Firestore para eliminar. Verifique las reglas de seguridad y los datos del administrador.";
    } else if (error instanceof Error) {
        userMessage = error.message;
    }
    return { error: userMessage };
  }
}
