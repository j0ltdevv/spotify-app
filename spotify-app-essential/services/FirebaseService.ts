// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeAuth, 
  getReactNativePersistence, 
  browserLocalPersistence, 
  getAuth 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_DATABASE_URL,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
  FIREBASE_MEASUREMENT_ID
} from '@env';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: FIREBASE_API_KEY,
  authDomain: FIREBASE_AUTH_DOMAIN,
  databaseURL: FIREBASE_DATABASE_URL,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
  appId: FIREBASE_APP_ID,
  measurementId: FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
if (!firebaseConfig.apiKey) {
  console.error('❌ Firebase Configuration Error: API Key is missing. Check your .env file and restart the bundler with --clear.');
}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with platform-specific persistence
let auth;

if (Platform.OS === 'web') {
  // On Web, use standard browser persistence (localStorage/IndexedDB)
  // getAuth() automatically configures this, or we can use initializeAuth with browserLocalPersistence
  try {
    auth = getAuth(app);
    auth.setPersistence(browserLocalPersistence);
  } catch (e) {
    // Fallback if getAuth was already called
    auth = getAuth(app);
  }
} else {
  // On Mobile (iOS/Android), use AsyncStorage
  // We must check if auth is already initialized to avoid "Firebase App already initialized" errors in rare reload cases
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });
  } catch (e: any) {
    if (e.code === 'auth/already-initialized') {
        auth = getAuth(app);
    } else {
        throw e;
    }
  }
}

// Initialize Firestore
const db = getFirestore(app);

export { app, auth, db };