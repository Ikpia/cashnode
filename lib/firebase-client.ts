import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

function getFirebaseConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

  if (!apiKey || !authDomain || !projectId || !appId || !messagingSenderId) {
    throw new Error("Missing Firebase web config. Add the NEXT_PUBLIC_FIREBASE_* values to .env.local.");
  }

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    messagingSenderId,
    ...(storageBucket ? { storageBucket } : {}),
    ...(measurementId ? { measurementId } : {})
  };
}

export function getFirebaseClientApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(getFirebaseConfig());
}

export function getFirebaseClientAuth() {
  const auth = getAuth(getFirebaseClientApp());
  auth.languageCode = "en";
  return auth;
}
