import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import './index.css'
import { logger } from '@/lib/logger'

// Firebase is initialized proactively via this import if the env vars are set
import '@/config/firebase'

// Service worker update interval in milliseconds (60 seconds)
const SW_UPDATE_INTERVAL_MS = 60_000

// Register service worker with auto-update (polls every 60s for new builds)
if ('serviceWorker' in navigator) {
    registerSW({
        immediate: true,
        onRegisteredSW(swUrl: string, registration: ServiceWorkerRegistration | undefined) {
            logger.log('[SolHunt] Service Worker registered:', swUrl);
            if (registration) {
                setInterval(() => {
                    registration.update();
                }, SW_UPDATE_INTERVAL_MS);
            }
        },
        onOfflineReady() {
            logger.log('[SolHunt] App shell cached for offline.');
        },
    });
}

createRoot(document.getElementById('root')!).render(
    <App />,
)
