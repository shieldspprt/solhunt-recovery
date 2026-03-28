import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import './index.css'

// Firebase is initialized proactively via this import if the env vars are set
import '@/config/firebase'

// Register service worker with auto-update (polls every 60s for new builds)
if ('serviceWorker' in navigator) {
    registerSW({
        immediate: true,
        onRegisteredSW(_swUrl: string, registration: ServiceWorkerRegistration | undefined) {
            if (registration) {
                setInterval(() => {
                    registration.update();
                }, 60_000);
            }
        },
        onOfflineReady() {
            console.log('[SolHunt] App shell cached for offline.');
        },
    });
}

createRoot(document.getElementById('root')!).render(
    <App />,
)
