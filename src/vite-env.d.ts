/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// ─── Make this file a module (required for global augmentation) ───
export {}

// ─── Service Worker type augmentation ───
declare global {
    interface ServiceWorkerGlobalScope {
        __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
    }
}

interface ImportMetaEnv {
    readonly VITE_HELIUS_RPC_URL: string
    readonly VITE_SOLANA_FALLBACK_RPC: string
    readonly VITE_FIREBASE_API_KEY: string
    readonly VITE_FIREBASE_AUTH_DOMAIN: string
    readonly VITE_FIREBASE_PROJECT_ID: string
    readonly VITE_FIREBASE_STORAGE_BUCKET: string
    readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
    readonly VITE_FIREBASE_APP_ID: string
    readonly VITE_FIREBASE_MEASUREMENT_ID: string
    readonly VITE_TREASURY_WALLET: string
    readonly VITE_SERVICE_FEE_SOL: string
    readonly VITE_APP_ENV: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
