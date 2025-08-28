
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
// import { getFirestore, type Firestore } from 'firebase/firestore'; // Uncomment if using Firestore
// import { getDatabase, type Database } from 'firebase/database'; // Uncomment if using Realtime Database

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
// let firestore: Firestore | undefined = undefined; // Uncomment if using Firestore
// let db: Database | undefined = undefined; // Uncomment if using Realtime Database

// List of critical Firebase config keys required for core functionality (e.g., Auth)
const criticalConfigKeys: (keyof FirebaseConfig)[] = [
  'apiKey',
  'authDomain',
  'projectId',
  'appId',
  // 'databaseURL', // Add if Realtime Database is critical for app bootstrap
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
    "   If using Realtime Database, also ensure NEXT_PUBLIC_FIREBASE_DATABASE_URL is set.\n" +
    "3. AFTER creating or updating .env.local, YOU MUST RESTART your Next.js development server for the changes to take effect.\n\n" +
    "Firebase will NOT be initialized due to missing configuration. Authentication and other Firebase services will not function.\n" +
    "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  );
} else {
  if (!getApps().length) {
    try {
      console.log("Firebase: Attempting to initialize Firebase app with web app config...");
      app = initializeApp(firebaseConfig as any); // Cast as any if some optional ones are truly optional by SDK
      console.log("Firebase: App initialized successfully.");
    } catch (e: any) {
      console.error(
        "Firebase: initializeApp FAILED. This can happen if the environment variables " +
        "(NEXT_PUBLIC_FIREBASE_API_KEY, etc.) in your .env.local file are set, but they still result in an invalid configuration " +
        "according to the Firebase SDK (e.g., API key is malformed, for the wrong project, or project is not set up correctly for this web app).\n" +
        "Error details:",
        e.message,
        e
      );
      app = undefined; // Ensure app is undefined on failure
    }
  } else {
    app = getApp();
    // console.log("Firebase: Using existing Firebase app instance."); // Can be noisy, uncomment if needed
  }

  if (app) {
    try {
      auth = getAuth(app);
      // console.log("Firebase: Auth initialized."); // Can be noisy
    } catch (e: any) {
      console.error("Firebase: getAuth(app) FAILED. Error details:", e.message, e);
      auth = undefined;
    }

    // Initialize Firestore (only if you intend to use it)
    // try {
    //   firestore = getFirestore(app);
    //   console.log("Firebase: Firestore initialized.");
    // } catch (e: any) {
    //   console.error("Firebase: getFirestore(app) FAILED. Error details:", e.message, e);
    //   firestore = undefined;
    // }

    // Initialize Realtime Database if its URL was provided and you intend to use it
    // if (firebaseConfig.databaseURL) {
    //   try {
    //     db = getDatabase(app);
    //     console.log("Firebase: Realtime Database initialized.");
    //   } catch (e: any) {
    //     console.error("Firebase: getDatabase(app) FAILED for Realtime Database. Error details:", e.message, e);
    //     db = undefined;
    //   }
    // } else {
    //   // console.warn( // Only warn if RTDB is expected but URL is missing
    //   //   "Firebase: Realtime Database URL (NEXT_PUBLIC_FIREBASE_DATABASE_URL) was not found in config. " +
    //   //   "Realtime Database functionality (if used directly by app) will not be available."
    //   // );
    //   db = undefined;
    // }
  } else {
    // This block will be reached if initializeApp failed or criticalConfigKeys were missing.
    // The console.error for missingKeys would have already been printed.
    // If missingKeys was empty but app is still undefined, initializeApp itself failed.
    if (missingKeys.length === 0) {
        console.error(
          "Firebase: App object is undefined after attempting initialization, " +
          "even though critical config keys appeared to be present. " +
          "This implies an issue with initializeApp itself (e.g., invalid values in .env.local like malformed API key, " +
          "network issues, or misconfigured Firebase project for this web app). " +
          "Check previous console errors from Firebase SDK. " +
          "Firebase services (Auth, etc.) cannot be initialized."
        );
    }
    auth = undefined;
    // firestore = undefined;
    // db = undefined;
  }
}

// Export only what's confirmed to be initialized and needed.
// Ensure these exports are handled gracefully if undefined by consuming modules.
export { app, auth };
// export { app, auth, firestore, db }; // If using Firestore/RTDB directly

