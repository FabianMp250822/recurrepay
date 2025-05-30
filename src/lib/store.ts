
import type { Client, PaymentRecord, AppFinancingSettings, AppGeneralSettings, FinancingPlanSetting } from '@/types';
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
  orderBy,
  where,
  Timestamp,
  setDoc
} from 'firebase/firestore';
// DEFAULT_FINANCING_OPTIONS from constants.ts is an object, not directly used for this default structure anymore
// We define the default AppFinancingSettings structure directly here.

const CLIENTS_COLLECTION = 'listapagospendiendes';
const PAYMENT_HISTORY_SUBCOLLECTION = 'paymentHistory';
const APP_SETTINGS_COLLECTION = 'appSettings';
const FINANCING_PLANS_DOC_ID = 'financingPlans';
const GENERAL_SETTINGS_DOC_ID = 'generalSettings';

// Define defaultFinancingPlansData with a 'plans' array directly
const defaultFinancingPlansData: AppFinancingSettings = {
  plans: [
    { months: 0, label: "Sin financiación", rate: 0, isDefault: true, isConfigurable: false },
    { months: 3, label: "3 meses", rate: 0.05, isConfigurable: true },
    { months: 6, label: "6 meses", rate: 0.08, isConfigurable: true },
    { months: 9, label: "9 meses", rate: 0.10, isConfigurable: true },
    { months: 12, label: "12 meses", rate: 0.12, isConfigurable: true },
  ].sort((a, b) => a.months - b.months), // Ensure sorted
};


// --- Client Operations ---

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
  } catch (error: any) {
    console.error("Error fetching client by ID from Firestore (FULL ERROR OBJECT):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    if (error.code === 'permission-denied') {
      throw new Error(`Permiso denegado por Firestore al buscar cliente por ID '${id}'. Verifique las reglas de seguridad y asegúrese de que el usuario esté autenticado. Si se requieren verificaciones de administrador, verifique el estado del administrador.`);
    }
    throw new Error(`Error al buscar cliente por ID '${id}': ${error.message || 'Error desconocido de Firestore'}`);
  }
}

export async function getClientByEmail(email: string): Promise<Client | undefined> {
  try {
    const clientsCollectionRef = collection(db, CLIENTS_COLLECTION);
    const q = query(clientsCollectionRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return { id: docSnap.id, ...(docSnap.data() as Omit<Client, 'id'>) };
    }
    return undefined;
  } catch (error: any) {
    console.error("Error fetching client by email from Firestore (FULL ERROR OBJECT):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    return undefined;
  }
}


export async function addClient(clientData: Omit<Client, 'id'>): Promise<{ client?: Client, error?: string }> {
  if (!db) {
    console.error("CRITICAL_STORE_ERROR: Firestore client instance (db) is null in addClient. Firebase might not be initialized correctly on the client/server where this is called.");
    return { error: "Error de la aplicación: La conexión con la base de datos no está inicializada. Por favor, contacte al administrador." };
  }
  try {
    const clientsCollectionRef = collection(db, CLIENTS_COLLECTION);
    
    const dataToSave = {
        ...clientData,
        paymentsMadeCount: clientData.paymentsMadeCount || 0,
        status: clientData.status || 'active',
        createdAt: clientData.createdAt || Timestamp.now().toDate().toISOString()
    };
    
    Object.keys(dataToSave).forEach(key => (dataToSave as any)[key] === undefined && delete (dataToSave as any)[key]);

    const docRef = await addDoc(clientsCollectionRef, dataToSave);
    return { client: { id: docRef.id, ...dataToSave } as Client };
  } catch (error: any) {
    console.error("Error adding client to Firestore (Client SDK) (FULL ERROR OBJECT):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    let userMessage = "Error al agregar el cliente. Inténtelo de nuevo.";
    if (error.code === 'permission-denied') {
        userMessage = "Permiso denegado por Firestore al intentar guardar el cliente. Verifique las reglas de seguridad. Si las operaciones se realizan desde el servidor (ej. Server Actions), el Firebase Client SDK no tendrá un usuario autenticado, causando este error con reglas que requieran autenticación.";
    } else if (error.code === 'invalid-argument' || (error instanceof Error && (error.message.includes("undefined") || error.message.includes("NaN") || error.message.toLowerCase().includes("invalid data")))) {
        userMessage = `Error al agregar el cliente: Datos inválidos. Por favor, revise los campos. Detalle: ${error.message}`;
    } else if (error instanceof Error) {
        userMessage = `Error al agregar cliente (Client SDK): ${error.message}`;
    }
    return { error: userMessage };
  }
}

export async function updateClient(id: string, clientData: Partial<Omit<Client, 'id' | 'createdAt'>>): Promise<{ client?: Client, error?: string }> {
  if (!db) {
    console.error("CRITICAL_STORE_ERROR: Firestore client instance (db) is null in updateClient.");
    return { error: "Error de la aplicación: La conexión con la base de datos no está inicializada. Por favor, contacte al administrador." };
  }
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
    
    const dataToUpdate: Partial<Omit<Client, 'id' | 'createdAt'>> = { ...clientData };
    Object.keys(dataToUpdate).forEach(key => (dataToUpdate as any)[key] === undefined && delete (dataToUpdate as any)[key]);


    await updateDoc(clientDocRef, dataToUpdate);
    
    const updatedClientSnapshot = await getDoc(clientDocRef);
    const updatedClient = { id: updatedClientSnapshot.id, ...updatedClientSnapshot.data() } as Client;

    return { client: updatedClient };

  } catch (error: any)
 {
    console.error("Error updating client in Firestore (Client SDK) (FULL ERROR OBJECT):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    let userMessage = "Error al actualizar el cliente. Inténtelo de nuevo.";
    if (error.code === 'permission-denied') {
        userMessage = "Permiso denegado por Firestore al intentar actualizar el cliente. Verifique las reglas de seguridad. Si las operaciones se realizan desde el servidor (ej. Server Actions), el Firebase Client SDK no tendrá un usuario autenticado.";
    } else if (error.code === 'invalid-argument' || (error instanceof Error && (error.message.includes("undefined") || error.message.includes("NaN") || error.message.toLowerCase().includes("invalid data")))) {
        userMessage = `Error al actualizar el cliente: Datos inválidos. Por favor, revise los campos. Detalle: ${error.message}`;
    } else if (error instanceof Error) {
        userMessage = `Error al actualizar cliente (Client SDK): ${error.message}`;
    }
    return { error: userMessage };
  }
}

export async function deleteClient(id: string): Promise<{ success?: boolean, error?: string }> {
   if (!db) {
    console.error("CRITICAL_STORE_ERROR: Firestore client instance (db) is null in deleteClient.");
    return { error: "Error de la aplicación: La conexión con la base de datos no está inicializada. Por favor, contacte al administrador." };
  }
  try {
    const clientDocRef = doc(db, CLIENTS_COLLECTION, id);
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

// --- Payment History Operations ---

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
    const docRef = await addDoc(historyCollectionRef, dataToSave);
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


// --- App Settings Operations ---

export async function getFinancingPlanSettings(): Promise<AppFinancingSettings> {
  if (!db) {
    console.error("CRITICAL_STORE_ERROR: Firestore client instance (db) is null in getFinancingPlanSettings. Returning default plans.");
    return defaultFinancingPlansData;
  }
  try {
    const settingsDocRef = doc(db, APP_SETTINGS_COLLECTION, FINANCING_PLANS_DOC_ID);
    const docSnap = await getDoc(settingsDocRef);
    if (docSnap.exists()) {
      const dataFromDb = docSnap.data() as Partial<AppFinancingSettings>; // Data from DB might be partial or malformed
      
      // Ensure dataFromDb.plans is an array before trying to use array methods on it
      const dbPlansArray = Array.isArray(dataFromDb.plans) ? dataFromDb.plans : [];

      // Create a map of default plans for easy lookup and merging
      const defaultPlansMap = defaultFinancingPlansData.plans.reduce((map, plan) => {
        map[plan.months] = plan;
        return map;
      }, {} as { [key: number]: FinancingPlanSetting });

      // Merge DB plans with defaults: prioritize DB values but ensure all default structure is there
      const mergedPlans = defaultFinancingPlansData.plans.map(defaultPlan => {
        const dbPlan = dbPlansArray.find(p => p.months === defaultPlan.months);
        return {
          ...defaultPlan, // Start with default structure (months, label, default rate, isConfigurable, isDefault)
          ...(dbPlan || {}), // Override with DB values if they exist (label, rate primarily)
        };
      });
      
      // Add any plans from DB that weren't in the defaults (e.g., custom plans added later)
      // This part is tricky if DB plans don't have all fields, ensure they are valid FinancingPlanSetting
      dbPlansArray.forEach(dbPlan => {
        if (!mergedPlans.find(p => p.months === dbPlan.months)) {
          // Ensure it has the basic structure, using defaults from a similar default plan if possible
          // or some sane values if it's a completely new month key
          const baseForNewLabel = defaultPlansMap[dbPlan.months] || { months: dbPlan.months, label: `Plan ${dbPlan.months}m`, rate: 0, isConfigurable: true };
          mergedPlans.push({
             ...baseForNewLabel,
             ...dbPlan, // Override with what's in DB
          });
        }
      });

      mergedPlans.sort((a, b) => a.months - b.months);
      return { plans: mergedPlans };
    } else {
      // If doc doesn't exist, create it with defaultFinancingPlansData (which has a 'plans' array)
      await setDoc(settingsDocRef, defaultFinancingPlansData);
      return defaultFinancingPlansData;
    }
  } catch (error: any) {
    console.error("Error fetching financing plan settings from Firestore:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    if (error.code === 'permission-denied') {
      throw new Error("Permiso denegado por Firestore al obtener la configuración de planes de financiación.");
    }
    console.warn("Falling back to default financing plans due to error.");
    return defaultFinancingPlansData; // This has a 'plans' array
  }
}

export async function saveFinancingPlanSettings(settings: AppFinancingSettings): Promise<{ success: boolean, error?: string }> {
  if (!db) {
    console.error("CRITICAL_STORE_ERROR: Firestore client instance (db) is null in saveFinancingPlanSettings.");
    return { success: false, error: "Error de la aplicación: La conexión con la base de datos no está inicializada." };
  }
  try {
    const settingsDocRef = doc(db, APP_SETTINGS_COLLECTION, FINANCING_PLANS_DOC_ID);
    // Ensure settings.plans is an array before saving
    const dataToSave = {
        plans: Array.isArray(settings.plans) ? settings.plans : defaultFinancingPlansData.plans
    };
    await setDoc(settingsDocRef, dataToSave, { merge: true });
    return { success: true };
  } catch (error: any) {
    console.error("Error saving financing plan settings to Firestore:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    let userMessage = "Error al guardar la configuración de planes de financiación.";
    if (error.code === 'permission-denied') {
      userMessage = "Permiso denegado por Firestore al guardar la configuración de planes de financiación.";
    }
    return { success: false, error: userMessage };
  }
}

export async function getFinancingOptionsMap(): Promise<{ [key: number]: { rate: number; label: string } }> {
    const settings = await getFinancingPlanSettings();
    // Ensure settings and settings.plans are valid before reducing
    if (!settings || !Array.isArray(settings.plans) || settings.plans.length === 0) {
        console.warn("getFinancingOptionsMap: No valid plans found or settings.plans is not an array, returning empty map.");
        return {};
    }
    return settings.plans.reduce((acc, plan) => {
      // Ensure plan is an object and has months, rate, label
      if (plan && typeof plan.months === 'number' && typeof plan.rate === 'number' && typeof plan.label === 'string') {
        acc[plan.months] = { rate: plan.rate, label: plan.label };
      } else {
        console.warn("getFinancingOptionsMap: Skipping invalid plan object during reduce:", plan);
      }
      return acc;
    }, {} as { [key: number]: { rate: number; label: string } });
}


// --- General App Settings Operations ---
const defaultGeneralSettings: AppGeneralSettings = {
  appName: "RecurPay",
  appLogoUrl: "",
  notificationsEnabled: false,
  themePrimary: "207 88% 68%",
  themeSecondary: "207 88% 88%",
  themeAccent: "124 39% 64%",
  themeBackground: "207 88% 94%",
  themeForeground: "210 40% 25%",
};

export async function getGeneralSettings(): Promise<AppGeneralSettings> {
  if (!db) {
    console.error("CRITICAL_STORE_ERROR: Firestore client instance (db) is null in getGeneralSettings. Returning default settings.");
    return defaultGeneralSettings;
  }
  try {
    const settingsDocRef = doc(db, APP_SETTINGS_COLLECTION, GENERAL_SETTINGS_DOC_ID);
    const docSnap = await getDoc(settingsDocRef);
    if (docSnap.exists()) {
      const fetchedData = docSnap.data();
      return { ...defaultGeneralSettings, ...fetchedData } as AppGeneralSettings;
    } else {
      await setDoc(settingsDocRef, defaultGeneralSettings);
      return defaultGeneralSettings;
    }
  } catch (error: any) {
    console.error("Error fetching general settings from Firestore:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    if (error.code === 'permission-denied') {
      throw new Error("Permiso denegado por Firestore al obtener la configuración general.");
    }
    console.warn("Falling back to default general settings due to error.");
    return defaultGeneralSettings;
  }
}

export async function saveGeneralSettings(settings: Partial<AppGeneralSettings>): Promise<{ success: boolean, error?: string }> {
  if (!db) {
    console.error("CRITICAL_STORE_ERROR: Firestore client instance (db) is null in saveGeneralSettings.");
    return { success: false, error: "Error de la aplicación: La conexión con la base de datos no está inicializada." };
  }
  try {
    const settingsDocRef = doc(db, APP_SETTINGS_COLLECTION, GENERAL_SETTINGS_DOC_ID);
    
    const settingsToSave: Partial<AppGeneralSettings> = {
        appName: settings.appName !== undefined ? settings.appName : defaultGeneralSettings.appName,
        appLogoUrl: settings.appLogoUrl !== undefined ? settings.appLogoUrl : defaultGeneralSettings.appLogoUrl,
        notificationsEnabled: typeof settings.notificationsEnabled === 'boolean' ? settings.notificationsEnabled : defaultGeneralSettings.notificationsEnabled,
        themePrimary: settings.themePrimary !== undefined ? settings.themePrimary : defaultGeneralSettings.themePrimary,
        themeSecondary: settings.themeSecondary !== undefined ? settings.themeSecondary : defaultGeneralSettings.themeSecondary,
        themeAccent: settings.themeAccent !== undefined ? settings.themeAccent : defaultGeneralSettings.themeAccent,
        themeBackground: settings.themeBackground !== undefined ? settings.themeBackground : defaultGeneralSettings.themeBackground,
        themeForeground: settings.themeForeground !== undefined ? settings.themeForeground : defaultGeneralSettings.themeForeground,
    };
    Object.keys(settingsToSave).forEach(key => (settingsToSave as any)[key] === undefined && delete (settingsToSave as any)[key]);

    await setDoc(settingsDocRef, settingsToSave, { merge: true });
    return { success: true };
  } catch (error: any) {
    console.error("Error saving general settings to Firestore:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    let userMessage = "Error al guardar la configuración general.";
    if (error.code === 'permission-denied') {
      userMessage = "Permiso denegado por Firestore al guardar la configuración general.";
    } else if (error.message && error.message.includes("undefined")) {
        userMessage = "Error al guardar la configuración: se intentó guardar un valor indefinido. Por favor, revise los campos.";
    }
    return { success: false, error: userMessage };
  }
}
