
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!serviceAccountJson) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable is not set.');
    }
    const serviceAccount = JSON.parse(serviceAccountJson);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      // Add your databaseURL if you need it for Realtime Database, not typically needed for Firestore Admin SDK
      // databaseURL: `https://${serviceAccount.project_id}.firebaseio.com` 
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error: any) {
    console.error('Firebase Admin SDK initialization error:', error.stack);
    // Optionally, rethrow or handle critical initialization failure
  }
}

const adminDb = admin.firestore();
const adminAuth = admin.auth();
// const adminStorage = admin.storage(); // Uncomment if you need Admin SDK for Storage

export { adminDb, adminAuth, admin };
