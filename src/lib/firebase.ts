
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore'; // Correct import for client-side Firestore

interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  databaseURL?: string;
  measurementId?: string;
}

// This config object will be populated by environment variables
const firebaseConfig: FirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL, // For Realtime Database
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // For Analytics
};

let app: FirebaseApp | undefined = undefined;
let auth: Auth | undefined = undefined;
let firestore: Firestore | undefined = undefined;

// List of critical Firebase config keys required for core functionality (e.g., Auth)
const criticalConfigKeys: (keyof FirebaseConfig)[] = [
  'apiKey',
  'authDomain',
  'projectId',
  'appId',
];

const missingKeys = criticalConfigKeys.filter(key => {
  const value = firebaseConfig[key];
  return !value || (typeof value === 'string' && value.trim() === '');
});

if (missingKeys.length > 0) {
  console.error(
    "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n" +
    "CRITICAL FIREBASE CONFIGURATION ERROR:\n" +
    `The following Firebase environment variables are MISSING or UNDEFINED in your .env.local file: ${missingKeys.map(key => `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, "_$1").toUpperCase()}`).join(', ')}\n\n` +
    "Please take the following steps:\n" +
    "1. Ensure you have a file named '.env.local' in the ROOT of your project.\n" +
    "2. Ensure this file contains all the required NEXT_PUBLIC_FIREBASE_... variables with their correct values from your Firebase project settings for your WEB APP.\n" +
    "   Example .env.local line: NEXT_PUBLIC_FIREBASE_API_KEY=\"AIzaSyYOURKEYHERE\"\n" +
    "3. AFTER creating or updating .env.local, YOU MUST RESTART your Next.js development server for the changes to take effect.\n\n" +
    "Firebase will NOT be initialized due to missing configuration.\n" +
    "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  );
} else {
  if (!getApps().length) {
    try {
      console.log("Firebase: Attempting to initialize Firebase app with web app config...");
      app = initializeApp(firebaseConfig as any);
      console.log("Firebase: App initialized successfully.");
    } catch (e: any) {
      console.error(
        "Firebase: initializeApp FAILED. Error details:",
        e.message,
        e
      );
      app = undefined;
    }
  } else {
    app = getApp();
  }

  if (app) {
    try {
      auth = getAuth(app);
    } catch (e: any) {
      console.error("Firebase: getAuth(app) FAILED. Error details:", e.message, e);
      auth = undefined;
    }

    try {
      firestore = getFirestore(app);
      console.log("Firebase: Firestore client initialized.");
    } catch (e: any) {
      console.error("Firebase: getFirestore(app) FAILED. Error details:", e.message, e);
      firestore = undefined;
    }

  } else {
    if (missingKeys.length === 0) {
        console.error(
          "Firebase: App object is undefined after attempting initialization, " +
          "even though critical config keys appeared to be present. "
        );
    }
    auth = undefined;
    firestore = undefined;
  }
}

export { app, auth, firestore };
