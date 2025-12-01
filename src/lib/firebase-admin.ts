
'use server';

import * as admin from 'firebase-admin';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

interface FirebaseAdminConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

let auth: Auth | null = null;
let firestore: Firestore | null = null;
let adminInitializationError: string | null = null;

function getFirebaseAdminConfig(): FirebaseAdminConfig | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Private key needs to have its newlines properly escaped in the .env.local file
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  const missingVars: string[] = [];
  if (!projectId) missingVars.push('FIREBASE_PROJECT_ID');
  if (!clientEmail) missingVars.push('FIREBASE_CLIENT_EMAIL');
  if (!privateKey) missingVars.push('FIREBASE_PRIVATE_KEY');

  if (missingVars.length > 0) {
    adminInitializationError =
      '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n' +
      'CRITICAL FIREBASE ADMIN SDK CONFIGURATION ERROR (from firebase-admin.ts):\n' +
      `The following server-side environment variables are MISSING or EMPTY: ${missingVars.join(', ')}.\n\n` +
      'These variables are NOT prefixed with NEXT_PUBLIC_ and must be present in your .env.local file.\n' +
      'Example .env.local format:\n' +
      'FIREBASE_PROJECT_ID="your-project-id"\n' +
      'FIREBASE_CLIENT_EMAIL="firebase-adminsdk-..."\n' +
      'FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...your...key...\\n-----END PRIVATE KEY-----\\n"\n\n' +
      'IMPORTANT: You MUST restart your Next.js development server after creating or modifying the .env.local file.\n' +
      '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!';
    console.error(adminInitializationError);
    return null;
  }

  return { projectId, clientEmail, privateKey };
}

if (admin.apps.length === 0) {
  const config = getFirebaseAdminConfig();
  if (config) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(config),
      });
      console.log('Firebase Admin SDK initialized successfully.');
      auth = admin.auth();
      firestore = admin.firestore();
    } catch (e: any) {
      adminInitializationError = `Firebase Admin SDK initializeApp FAILED. Error: ${e.message}. This can happen if the credential values in your .env.local file are malformed or incorrect.`;
      console.error(adminInitializationError, e);
    }
  }
} else {
  auth = admin.auth();
  firestore = admin.firestore();
}

function getAdminAuth(): Auth {
  if (!auth) {
    throw new Error(
      adminInitializationError || 'Firebase Admin Auth has not been initialized. Check server logs for configuration errors.'
    );
  }
  return auth;
}

function getAdminFirestore(): Firestore {
  if (!firestore) {
    throw new Error(
      adminInitializationError || 'Firebase Admin Firestore has not been initialized. Check server logs for configuration errors.'
    );
  }
  return firestore;
}

export { getAdminAuth, getAdminFirestore, adminInitializationError };
