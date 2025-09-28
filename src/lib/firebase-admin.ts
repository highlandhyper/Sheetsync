
'use client';

import 'dotenv/config';
import * as admin from 'firebase-admin';
import type { App } from 'firebase-admin/app';

// Prefer NEXT_PUBLIC_ variables first as they are guaranteed to be set by the user for the client app.
// Fallback to non-public variables for other environments.
const FIREBASE_ADMIN_PROJECT_ID_RAW = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_ADMIN_PROJECT_ID;
const FIREBASE_ADMIN_CLIENT_EMAIL_RAW = process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const FIREBASE_ADMIN_PRIVATE_KEY_RAW = process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY;

let adminApp: App | null = null;
let adminInitializationError: string | null = null;

export function initializeAdminApp() {
  if (adminApp) {
    return adminApp;
  }
  if (adminInitializationError) {
    console.error("Firebase Admin SDK: Aborting due to previous initialization error:", adminInitializationError);
    throw new Error(adminInitializationError);
  }
  
  // The private key from Firebase Console JSON has literal \n characters.
  // When stored in a .env file, these need to be escaped (\\n), so we replace them back.
  const FIREBASE_ADMIN_PRIVATE_KEY = FIREBASE_ADMIN_PRIVATE_KEY_RAW?.replace(/\\n/g, '\n');

  if (!FIREBASE_ADMIN_PROJECT_ID_RAW || !FIREBASE_ADMIN_CLIENT_EMAIL_RAW || !FIREBASE_ADMIN_PRIVATE_KEY) {
      adminInitializationError = 
        "Firebase Admin SDK: One or more required environment variables are missing. " +
        "Ensure NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL, and NEXT_PUBLIC_FIREBASE_PRIVATE_KEY are set in your .env file. " +
        "These values come from your project's service account JSON key file. The Admin SDK will NOT be initialized.";
      console.error(adminInitializationError);
      throw new Error(adminInitializationError);
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
      console.log("Firebase Admin SDK initialized successfully for project: " + FIREBASE_ADMIN_PROJECT_ID_RAW);
    } else {
      adminApp = admin.apps[0]!;
    }
    return adminApp;
  } catch (error: any) {
    adminInitializationError = `Firebase Admin SDK: Initialization failed. Error: ${error.message}. ` +
      "This often means the service account credentials in .env are incorrect or malformed. " +
      "Please verify the project ID, client email, and especially the private key format.";
    console.error(adminInitializationError, error);
    adminApp = null;
    throw new Error(adminInitializationError);
  }
}

export function getAdminApp() {
    if (!adminApp) {
        // This will now throw an error if not initialized, which is what we want.
        // Initialization should be handled explicitly by the entry point (e.g., the migration script).
        throw new Error("Firebase Admin SDK has not been initialized. Call initializeAdminApp() first.");
    }
    return adminApp;
}
