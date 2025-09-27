
import * as admin from 'firebase-admin';
import type { App } from 'firebase-admin/app';

const FIREBASE_ADMIN_CLIENT_EMAIL_RAW = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.NEXT_PUBLIC_FIREBASE_ADMIN_CLIENT_EMAIL;
const FIREBASE_ADMIN_PRIVATE_KEY_RAW = process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.NEXT_PUBLIC_FIREBASE_ADMIN_PRIVATE_KEY;
const FIREBASE_ADMIN_PROJECT_ID_RAW = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

let adminApp: App | null = null;
let adminInitializationError: string | null = null;

function initializeAdminApp() {
  if (adminApp) {
    return;
  }
  if (adminInitializationError) {
    console.error("Firebase Admin SDK: Aborting due to previous initialization error:", adminInitializationError);
    return;
  }
  
  const FIREBASE_ADMIN_PRIVATE_KEY = FIREBASE_ADMIN_PRIVATE_KEY_RAW?.replace(/\\n/g, '\n');

  if (!FIREBASE_ADMIN_PROJECT_ID_RAW || !FIREBASE_ADMIN_CLIENT_EMAIL_RAW || !FIREBASE_ADMIN_PRIVATE_KEY) {
      adminInitializationError = 
        "Firebase Admin SDK: One or more required environment variables are missing (PROJECT_ID, CLIENT_EMAIL, PRIVATE_KEY). " +
        "Ensure FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY (or their NEXT_PUBLIC_ variants) are set in .env.local. " +
        "The Admin SDK will NOT be initialized.";
      console.error(adminInitializationError);
      return;
  }

  try {
    if (admin.apps.length === 0) {
      adminApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: FIREBASE_ADMIN_PROJECT_ID_RAW,
          clientEmail: FIREBASE_ADMIN_CLIENT_EMAIL_RAW,
          privateKey: FIREBASE_ADMIN_PRIVATE_KEY,
        }),
      });
      console.log("Firebase Admin SDK initialized successfully.");
    } else {
      adminApp = admin.apps[0];
      // console.log("Firebase Admin SDK: Using existing instance.");
    }
  } catch (error: any) {
    adminInitializationError = `Firebase Admin SDK: Initialization failed. Error: ${error.message}. ` +
      "This often means the service account credentials in .env.local are incorrect or malformed. " +
      "Please verify the project ID, client email, and especially the private key format.";
    console.error(adminInitializationError, error);
    adminApp = null;
  }
}

initializeAdminApp();

export function getAdminApp() {
    if (!adminApp) {
        // This attempts a re-init if the first one failed, e.g., in a serverless function cold start.
        initializeAdminApp(); 
        if (!adminApp) {
            throw new Error(adminInitializationError || "Firebase Admin SDK could not be initialized.");
        }
    }
    return adminApp;
}

// You can also export specific admin services if needed, e.g.:
// export const adminAuth = getAdminApp() ? admin.auth(getAdminApp()) : null;
// export const adminDb = getAdminApp() ? admin.firestore(getAdminApp()) : null;
