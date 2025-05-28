
import * as admin from 'firebase-admin';

// Initialize to null. They will be assigned if admin SDK initializes.
let adminDbInstance: admin.firestore.Firestore | null = null;
let adminAuthInstance: admin.auth.Auth | null = null;

console.log('[Firebase Admin] Top of firebase-admin.ts. Attempting to initialize...');

if (!admin.apps.length) {
  console.log('[Firebase Admin] No Firebase apps initialized yet. Proceeding with initialization.');
  const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (!serviceAccountJson || serviceAccountJson.trim() === "") {
    console.error(
      'CRITICAL_FIREBASE_ADMIN_INIT_ERROR: GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable is not set or is empty. Firebase Admin SDK CANNOT be initialized. Ensure .env file is correctly set up and server is restarted.'
    );
  } else {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('[Firebase Admin] admin.initializeApp() called successfully.');
    } catch (error: any) {
      console.error('CRITICAL_FIREBASE_ADMIN_INIT_ERROR: Firebase Admin SDK initialization failed during JSON.parse() or admin.initializeApp().');
      console.error('Error Name:', error.name);
      console.error('Error Message:', error.message);
      console.error('Error Stack (partial):', error.stack ? String(error.stack).substring(0, 500) : 'No stack available');
      if (serviceAccountJson.length < 200) {
        console.error('Value of GOOGLE_APPLICATION_CREDENTIALS_JSON (first 100 chars):', serviceAccountJson.substring(0,100) + "...");
      }
    }
  }
} else {
  console.log('[Firebase Admin] Firebase Admin SDK app already initialized or an app exists.');
}

// After attempting initialization, check if an app exists and try to get services
if (admin.apps.length > 0 && admin.apps[0]) {
  console.log('[Firebase Admin] Default app found. Attempting to get Firestore and Auth services.');
  try {
    adminDbInstance = admin.firestore();
    adminAuthInstance = admin.auth();
    console.log('[Firebase Admin] SUCCESS: Firebase Admin services (adminDb, adminAuth) are available and assigned.');
  } catch (serviceError: any) {
    console.error('CRITICAL_FIREBASE_ADMIN_SERVICE_ERROR: Error getting Firestore/Auth service even after app initialization.');
    console.error('Service Error Name:', serviceError.name);
    console.error('Service Error Message:', serviceError.message);
    adminDbInstance = null; // Ensure it's null if service acquisition fails
    adminAuthInstance = null;
  }
} else {
  console.error(
    'CRITICAL_FIREBASE_ADMIN_INIT_FAILURE: No Firebase Admin app was available after initialization attempt. adminDb and adminAuth WILL BE NULL. Review previous logs for reasons (e.g., missing GOOGLE_APPLICATION_CREDENTIALS_JSON or initialization errors).'
  );
  adminDbInstance = null; // Explicitly ensure it's null
  adminAuthInstance = null;
}

export const adminDb = adminDbInstance;
export const adminAuth = adminAuthInstance;
export { admin };
