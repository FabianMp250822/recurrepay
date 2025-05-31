import type { Client, PaymentRecord, AppFinancingSettings, AppGeneralSettings, FinancingPlanSetting } from '@/types';
import type { Ticket, CreateTicketData, TicketMessage, TicketStatus } from '@/types/ticket';
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
import { DEFAULT_FINANCING_OPTIONS } from '@/lib/constants'; // For default structure

const CLIENTS_COLLECTION = 'listapagospendiendes';
const PAYMENT_HISTORY_SUBCOLLECTION = 'paymentHistory';
const APP_SETTINGS_COLLECTION = 'appSettings';
const FINANCING_PLANS_DOC_ID = 'financingPlans';
const GENERAL_SETTINGS_DOC_ID = 'generalSettings';
const TICKETS_COLLECTION = 'tickets';

// Define defaultFinancingPlansData with a 'plans' array directly
const defaultFinancingPlansData: AppFinancingSettings = {
  plans: [
    { months: 0, label: "Sin financiación", rate: 0, isDefault: true, isConfigurable: false },
    { months: 3, label: "3 meses", rate: 0.05, isConfigurable: true },
    { months: 6, label: "6 meses", rate: 0.08, isConfigurable: true },
    { months: 9, label: "9 meses", rate: 0.10, isConfigurable: true },
    { months: 12, label: "12 meses", rate: 0.12, isConfigurable: true },
  ].sort((a, b) => a.months - b.months),
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
    
    // ✅ Usar todos los datos que vienen del paymentData sin modificar status
    const dataToSave: Partial<Omit<PaymentRecord, 'id'>> = {
      paymentDate: paymentData.paymentDate,
      amountPaid: paymentData.amountPaid,
      recordedAt: Timestamp.now().toDate().toISOString(),
      // ✅ Incluir todos los campos nuevos
      status: paymentData.status || 'pending', // ✅ Respetar el status que viene
      submittedBy: paymentData.submittedBy || 'admin',
      proofUrl: paymentData.proofUrl,
      proofFileName: paymentData.proofFileName,
      clientId: paymentData.clientId,
      notes: paymentData.notes,
    };

    // Solo agregar campos opcionales si existen
    if (paymentData.siigoInvoiceUrl) {
      dataToSave.siigoInvoiceUrl = paymentData.siigoInvoiceUrl;
    }
    if (paymentData.validatedAt) {
      dataToSave.validatedAt = paymentData.validatedAt;
    }
    if (paymentData.validatedBy) {
      dataToSave.validatedBy = paymentData.validatedBy;
    }
    if (paymentData.rejectionReason) {
      dataToSave.rejectionReason = paymentData.rejectionReason;
    }

    const docRef = await addDoc(historyCollectionRef, dataToSave);
    return { record: { id: docRef.id, ...dataToSave } as PaymentRecord };
  } catch (error: any) {
    console.error(`Error adding payment to history for client ${clientId}:`, error);
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

export async function updatePaymentRecord(clientId: string, paymentId: string, updates: Partial<PaymentRecord>): Promise<{ success?: boolean, error?: string }> {
  if (!db) {
    console.error("CRITICAL_STORE_ERROR: Firestore client instance (db) is null in updatePaymentRecord.");
    return { error: "Error de la aplicación: La conexión con la base de datos no está inicializada." };
  }
  
  try {
    const paymentDocRef = doc(db, CLIENTS_COLLECTION, clientId, PAYMENT_HISTORY_SUBCOLLECTION, paymentId);
    await updateDoc(paymentDocRef, updates);
    return { success: true };
  } catch (error: any) {
    console.error(`Error updating payment record ${paymentId} for client ${clientId}:`, error);
    return { error: `Error al actualizar el registro de pago: ${error.message}` };
  }
}

export async function getPendingPayments(): Promise<(PaymentRecord & { clientName: string; clientEmail: string })[]> {
  if (!db) {
    console.error("CRITICAL_STORE_ERROR: Firestore client instance (db) is null in getPendingPayments.");
    return [];
  }
  
  try {
    const clients = await getClients();
    const allPendingPayments: (PaymentRecord & { clientName: string; clientEmail: string })[] = [];
    
    for (const client of clients) {
      try {
        const paymentHistory = await getPaymentHistory(client.id);
        const pendingPayments = paymentHistory
          .filter(payment => payment.status === 'pending') // ✅ Solo pendientes
          .map(payment => ({
            ...payment,
            clientName: `${client.firstName} ${client.lastName}`,
            clientEmail: client.email,
            clientId: client.id
          }));
        
        allPendingPayments.push(...pendingPayments);
      } catch (error) {
        console.error(`Error loading pending payments for client ${client.id}:`, error);
      }
    }
    
    // Ordenar por fecha de envío (más recientes primero)
    return allPendingPayments.sort((a, b) => 
      new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    );
  } catch (error: any) {
    console.error('Error fetching pending payments:', error);
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
      const dataFromDb = docSnap.data() as Partial<AppFinancingSettings>;
      
      const dbPlansArray = Array.isArray(dataFromDb.plans) ? dataFromDb.plans : [];

      const defaultPlansMap = (defaultFinancingPlansData.plans || []).reduce((map, plan) => {
        map[plan.months] = plan;
        return map;
      }, {} as { [key: number]: FinancingPlanSetting });

      let mergedPlans = (defaultFinancingPlansData.plans || []).map(defaultPlan => {
        const dbPlan = dbPlansArray.find(p => p.months === defaultPlan.months);
        return {
          ...defaultPlan,
          ...(dbPlan || {}), 
        };
      });
      
      dbPlansArray.forEach(dbPlan => {
        if (!mergedPlans.find(p => p.months === dbPlan.months)) {
          const baseForNewLabel = defaultPlansMap[dbPlan.months] || { months: dbPlan.months, label: `Plan ${dbPlan.months}m`, rate: 0, isConfigurable: true };
          mergedPlans.push({
             ...baseForNewLabel,
             ...dbPlan,
          });
        }
      });
      
      // Filter out any plans that might not be complete or valid (e.g., missing 'months')
      // and ensure isConfigurable and isDefault are booleans
      mergedPlans = mergedPlans.filter(p => typeof p.months === 'number').map(p => ({
        ...p,
        isDefault: typeof p.isDefault === 'boolean' ? p.isDefault : false,
        isConfigurable: typeof p.isConfigurable === 'boolean' ? p.isConfigurable : (p.months !== 0), // Sin financiación is not configurable
      }));

      mergedPlans.sort((a, b) => a.months - b.months);
      return { plans: mergedPlans };
    } else {
      await setDoc(settingsDocRef, defaultFinancingPlansData);
      return defaultFinancingPlansData;
    }
  } catch (error: any) {
    console.error("Error fetching financing plan settings from Firestore:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    if (error.code === 'permission-denied') {
      throw new Error("Permiso denegado por Firestore al obtener la configuración de planes de financiación.");
    }
    console.warn("Falling back to default financing plans due to error.");
    return defaultFinancingPlansData;
  }
}

export async function saveFinancingPlanSettings(settings: AppFinancingSettings): Promise<{ success: boolean, error?: string }> {
  if (!db) {
    console.error("CRITICAL_STORE_ERROR: Firestore client instance (db) is null in saveFinancingPlanSettings.");
    return { success: false, error: "Error de la aplicación: La conexión con la base de datos no está inicializada." };
  }
  try {
    const settingsDocRef = doc(db, APP_SETTINGS_COLLECTION, FINANCING_PLANS_DOC_ID);
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
    if (!settings || !Array.isArray(settings.plans) || settings.plans.length === 0) {
        console.warn("getFinancingOptionsMap: No valid plans found or settings.plans is not an array, returning empty map from DEFAULT_FINANCING_OPTIONS.");
        // Fallback to constants if DB fetch is problematic or empty
        return Object.entries(DEFAULT_FINANCING_OPTIONS).reduce((acc, [key, value]) => {
            acc[Number(key)] = value;
            return acc;
        }, {} as { [key: number]: { rate: number; label: string } });
    }
    return settings.plans.reduce((acc, plan) => {
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
  themePrimary: "207 88% 68%", // RecurPay: Serene blue #64B5F6
  themeSecondary: "207 88% 88%", // Lighter blue
  themeAccent: "124 39% 64%", // RecurPay: Gentle green #81C784
  themeBackground: "207 88% 94%", // RecurPay: Light, desaturated blue #E3F2FD
  themeForeground: "210 40% 25%", // RecurPay: Dark blue/gray for text
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

/**
 * Verifica si un usuario es administrador consultando la colección 'administradores'
 * @param userId - UID del usuario de Firebase Auth
 * @returns Promise<boolean> - true si es administrador, false en caso contrario
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    if (!userId) {
      console.warn('isUserAdmin: userId is empty or null');
      return false;
    }

    const adminDocRef = doc(db, 'administradores', userId);
    const adminDoc = await getDoc(adminDocRef);
    
    if (adminDoc.exists()) {
      const adminData = adminDoc.data();
      // Verificar que el administrador esté activo (opcional)
      // Si tienes un campo 'activo' o 'active' en tu documento de administrador
      return adminData?.activo === true || adminData?.active === true || true; // true por defecto si no hay campo de estado
    }
    
    return false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false; // En caso de error, asumir que no es admin por seguridad
  }
}

/**
 * Verifica si un usuario es administrador consultando la colección 'administradores' por email
 * @param email - Email del usuario
 * @returns Promise<boolean> - true si es administrador, false en caso contrario
 */
export async function isEmailAdmin(email: string): Promise<boolean> {
  try {
    if (!email) {
      console.warn('isEmailAdmin: email is empty or null');
      return false;
    }

    const adminQuery = query(
      collection(db, 'administradores'),
      where('email', '==', email)
    );
    
    const adminSnapshot = await getDocs(adminQuery);
    
    if (!adminSnapshot.empty) {
      // Verificar que al menos uno esté activo
      for (const doc of adminSnapshot.docs) {
        const adminData = doc.data();
        if (adminData?.activo === true || adminData?.active === true || true) { // true por defecto
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking admin status by email:', error);
    return false;
  }
}

/**
 * Obtener todos los tickets (para administradores)
 */
export async function getAllTickets(): Promise<Ticket[]> {
  try {
    const ticketsQuery = query(
      collection(db, TICKETS_COLLECTION),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(ticketsQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Ticket));
  } catch (error) {
    console.error('Error fetching tickets:', error);
    throw error;
  }
}

/**
 * Obtener tickets por estado
 */
export async function getTicketsByStatus(status: TicketStatus): Promise<Ticket[]> {
  try {
    const ticketsQuery = query(
      collection(db, TICKETS_COLLECTION),
      where('status', '==', status),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(ticketsQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Ticket));
  } catch (error) {
    console.error('Error fetching tickets by status:', error);
    throw error;
  }
}

/**
 * Obtener tickets de un cliente específico
 */
export async function getClientTickets(clientId: string): Promise<Ticket[]> {
  try {
    const ticketsQuery = query(
      collection(db, TICKETS_COLLECTION),
      where('clientId', '==', clientId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(ticketsQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Ticket));
  } catch (error) {
    console.error('Error fetching client tickets:', error);
    throw error;
  }
}

/**
 * Crear nuevo ticket
 */
export async function createTicket(
  clientId: string,
  clientName: string,
  clientEmail: string,
  ticketData: CreateTicketData
): Promise<{ ticket?: Ticket; error?: string }> {
  try {
    const now = new Date().toISOString();
    
    const newTicket: Omit<Ticket, 'id'> = {
      clientId,
      clientName,
      clientEmail,
      subject: ticketData.subject,
      description: ticketData.description,
      status: 'recibida',
      priority: ticketData.priority,
      category: ticketData.category,
      createdAt: now,
      updatedAt: now,
      messages: [{
        id: crypto.randomUUID(),
        message: ticketData.description,
        sentBy: 'client',
        sentByName: clientName,
        sentByEmail: clientEmail,
        timestamp: now,
      }],
      isClientRead: true,
      isAdminRead: false,
    };

    const docRef = await addDoc(collection(db, TICKETS_COLLECTION), newTicket);
    const ticket = { id: docRef.id, ...newTicket };
    
    return { ticket };
  } catch (error) {
    console.error('Error creating ticket:', error);
    return { error: 'Error al crear el ticket' };
  }
}

/**
 * Agregar mensaje a ticket
 */
export async function addTicketMessage(
  ticketId: string,
  message: string,
  sentBy: 'client' | 'admin',
  sentByName: string,
  sentByEmail: string,
  attachments?: string[]
): Promise<{ success?: boolean; error?: string }> {
  try {
    const ticketRef = doc(db, TICKETS_COLLECTION, ticketId);
    const ticketDoc = await getDoc(ticketRef);
    
    if (!ticketDoc.exists()) {
      return { error: 'Ticket no encontrado' };
    }
    
    const ticketData = ticketDoc.data() as Ticket;
    const now = new Date().toISOString();
    
    const newMessage: TicketMessage = {
      id: crypto.randomUUID(),
      message,
      sentBy,
      sentByName,
      sentByEmail,
      timestamp: now,
      attachments,
    };
    
    const updatedMessages = [...ticketData.messages, newMessage];
    
    await updateDoc(ticketRef, {
      messages: updatedMessages,
      updatedAt: now,
      isClientRead: sentBy === 'client',
      isAdminRead: sentBy === 'admin',
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error adding ticket message:', error);
    return { error: 'Error al enviar el mensaje' };
  }
}

/**
 * Actualizar estado del ticket
 */
export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus,
  assignedToAdmin?: string,
  assignedToAdminName?: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const ticketRef = doc(db, TICKETS_COLLECTION, ticketId);
    const updateData: any = {
      status,
      updatedAt: new Date().toISOString(),
      isAdminRead: true,
    };
    
    if (assignedToAdmin !== undefined) {
      updateData.assignedToAdmin = assignedToAdmin;
      updateData.assignedToAdminName = assignedToAdminName;
    }
    
    await updateDoc(ticketRef, updateData);
    return { success: true };
  } catch (error) {
    console.error('Error updating ticket status:', error);
    return { error: 'Error al actualizar el estado del ticket' };
  }
}

/**
 * Marcar ticket como leído
 */
export async function markTicketAsRead(
  ticketId: string,
  readBy: 'client' | 'admin'
): Promise<{ success?: boolean; error?: string }> {
  try {
    const ticketRef = doc(db, TICKETS_COLLECTION, ticketId);
    const updateData = readBy === 'client' 
      ? { isClientRead: true } 
      : { isAdminRead: true };
    
    await updateDoc(ticketRef, updateData);
    return { success: true };
  } catch (error) {
    console.error('Error marking ticket as read:', error);
    return { error: 'Error al marcar como leído' };
  }
}

/**
 * Obtener ticket por ID
 */
export async function getTicketById(ticketId: string): Promise<Ticket | null> {
  try {
    const ticketRef = doc(db, TICKETS_COLLECTION, ticketId);
    const ticketDoc = await getDoc(ticketRef);
    
    if (!ticketDoc.exists()) {
      return null;
    }
    
    return {
      id: ticketDoc.id,
      ...ticketDoc.data()
    } as Ticket;
  } catch (error) {
    console.error('Error fetching ticket by ID:', error);
    throw error;
  }
}

/**
 * Obtener cliente por Firebase ID
 */
export async function getClientByFirebaseId(firebaseId: string): Promise<Client | undefined> {
  if (!db) {
    console.error("CRITICAL_STORE_ERROR: Firestore client instance (db) is null in getClientByFirebaseId.");
    return undefined;
  }
  try {
    const clientsCollectionRef = collection(db, CLIENTS_COLLECTION);
    const q = query(clientsCollectionRef, where('firebaseId', '==', firebaseId));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return { id: docSnap.id, ...(docSnap.data() as Omit<Client, 'id'>) };
    }
    return undefined;
  } catch (error: any) {
    console.error("Error fetching client by Firebase ID from Firestore:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    if (error.code === 'permission-denied') {
      console.error(`Permission denied when fetching client by Firebase ID '${firebaseId}'. Check Firestore security rules.`);
    }
    return undefined;
  }
}
