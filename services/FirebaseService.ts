// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAdvYy7PuMBbIZng313HsMHtfF5DRsGJ8w", // TODO: Replace with environment variable
  authDomain: "who-listerning.firebaseapp.com", // TODO: Replace with environment variable
  databaseURL: "https://who-listerning-default-rtdb.europe-west1.firebasedatabase.app", // TODO: Replace with environment variable
  projectId: "who-listerning", // TODO: Replace with environment variable
  storageBucket: "who-listerning.firebasestorage.app", // TODO: Replace with environment variable
  messagingSenderId: "961407398774", // TODO: Replace with environment variable
  appId: "1:961407398774:web:538533300772e04b784057", // TODO: Replace with environment variable
  measurementId: "G-4SSZXSS60J" // TODO: Replace with environment variable
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export { app, analytics };
