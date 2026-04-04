
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

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

export const firebaseConfig: FirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp | undefined = undefined;
let auth: Auth | undefined = undefined;

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
  console.error("Firebase: Missing configuration keys in .env.local");
} else {
  if (!getApps().length) {
    try {
      app = initializeApp(firebaseConfig as any);
    } catch (e: any) {
      console.error("Firebase: initializeApp FAILED.", e.message);
    }
  } else {
    app = getApp();
  }

  if (app) {
    try {
      auth = getAuth(app);
    } catch (e: any) {
      console.error("Firebase: getAuth FAILED.", e.message);
    }
  }
}

export { app, auth };
