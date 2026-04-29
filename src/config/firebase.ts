import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAnalytics, Analytics, isSupported } from 'firebase/analytics';
import { getFirestore, Firestore } from 'firebase/firestore';

/**
 * Firebase configuration from environment variables.
 * If Firebase env vars are not set, the app still works — analytics
 * calls will be no-ops (see analytics.ts).
 */
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

/**
 * Check if Firebase is properly configured.
 */
const isFirebaseConfigured = Boolean(
    firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

let app: FirebaseApp | null = null;
let analytics: Analytics | null = null;
let db: Firestore | null = null;

/**
 * Initialize Firebase only if properly configured.
 * This gracefully degrades to no-ops if env vars are missing.
 */
if (isFirebaseConfigured) {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);

        // Analytics requires browser support
        isSupported().then((supported) => {
            if (supported && app) {
                analytics = getAnalytics(app);
            }
        }).catch((_err: unknown) => {
            // Analytics not supported — no-op
        });
    } catch (error: unknown) {
        // Firebase init errors are silently swallowed — Audit §2.11 (no PII in logs)
        // Only swallow — don't rethrow to allow app to continue without analytics
    }
}

export { app, analytics, db, isFirebaseConfigured };
