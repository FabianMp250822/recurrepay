
import * as admin from 'firebase-admin';

// Initialize to null. They will be assigned if admin SDK initializes.
let adminDbInstance: admin.firestore.Firestore | null = null;
let adminAuthInstance: admin.auth.Auth | null = null;

if (!admin.apps.length) {
  console.log('[Firebase Admin] Attempting to initialize Firebase Admin SDK...');
  const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (!serviceAccountJson || serviceAccountJson.trim() === "") {
    console.error(
      'CRITICAL_FIREBASE_ADMIN_INIT_ERROR: GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable is not set or is empty. Firebase Admin SDK cannot be initialized.'
    );
  } else {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        // Add your databaseURL if you need it for Realtime Database, not typically needed for Firestore Admin SDK
        // databaseURL: `https://${serviceAccount.project_id}.firebaseio.com` 
      });
      console.log('[Firebase Admin] Firebase Admin SDK initialized successfully.');
    } catch (error: any) {
      console.error('CRITICAL_FIREBASE_ADMIN_INIT_ERROR: Firebase Admin SDK initialization failed. Details:');
      console.error('Error Name:', error.name);
      console.error('Error Message:', error.message);
      // Log only a portion of the stack for brevity in console, but full stack is useful for debugging
      console.error('Error Stack (partial):', error.stack ? String(error.stack).substring(0, 500) : 'No stack available');
      if (serviceAccountJson.length < 200) { // Avoid logging very large strings if it's not the key itself
        console.error('Value of GOOGLE_APPLICATION_CREDENTIALS_JSON (check for validity):', serviceAccountJson.substring(0,100) + "...");
      }
    }
  }
} else {
  console.log('[Firebase Admin] Firebase Admin SDK already initialized.');
}

// After attempting initialization, check if an app exists
if (admin.apps.length > 0 && admin.apps[0]) { // Check for default app
  try {
    adminDbInstance = admin.firestore();
    adminAuthInstance = admin.auth();
    console.log('[Firebase Admin] Firebase Admin services (adminDb, adminAuth) are available.');
  } catch (serviceError: any) {
    console.error('CRITICAL_FIREBASE_ADMIN_SERVICE_ERROR: Error getting Firestore/Auth service even after app initialization. This should not happen if app initialized correctly.');
    console.error('Service Error Name:', serviceError.name);
    console.error('Service Error Message:', serviceError.message);
  }
} else {
  console.error(
    'CRITICAL_FIREBASE_ADMIN_INIT_ERROR: Firebase Admin SDK was not initialized successfully (or no default app exists). adminDb and adminAuth will be null. Review server logs for CRITICAL_FIREBASE_ADMIN_INIT_ERROR messages (GOOGLE_APPLICATION_CREDENTIALS_JSON issues or JSON.parse failures).'
  );
}

export const adminDb = adminDbInstance;
export const adminAuth = adminAuthInstance;
// Exporting the admin namespace itself is useful for other admin features if needed
export { admin };
