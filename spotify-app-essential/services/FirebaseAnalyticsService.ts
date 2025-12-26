import { getAnalytics, logEvent as firebaseLogEvent, Analytics } from 'firebase/analytics';
import { app } from './FirebaseService';

let analytics: Analytics | null = null;

// Only initialize Analytics in a browser environment
if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.error("Firebase Analytics initialization failed:", error);
  }
}

/**
 * Logs an analytics event to Firebase.
 * If Firebase Analytics is not initialized, a warning will be logged.
 * @param eventName The name of the event to log.
 * @param params Optional parameters for the event.
 */
export const logEvent = (eventName: string, params?: { [key: string]: any }) => {
  if (analytics) {
    firebaseLogEvent(analytics, eventName, params);
    console.log(`📊 Firebase Analytics Event: ${eventName}`, params);
  } else {
    console.warn(`⚠️ Firebase Analytics not initialized. Event '${eventName}' not logged.`);
  }
};
