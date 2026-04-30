/**
 * SolHunt Service Worker
 * Cache version: 2026-04-30
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope
 */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL, PrecacheEntry } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { logger } from '@/lib/logger';

// ──────────────────────────────────────────────────────
// Type Definitions for Service Worker Events
// ──────────────────────────────────────────────────────

/** 
 * The BeforeInstallPromptEvent is fired when the PWA meets installability criteria.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent
 */
interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
    prompt(): Promise<void>;
}

/**
 * Extends ServiceWorkerGlobalScope with SolHunt-specific additions.
 * Allows the app to access the deferred install prompt captured by the SW.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope
 */
interface SolHuntServiceWorkerGlobalScope extends ServiceWorkerGlobalScope {
    deferredInstallPrompt: BeforeInstallPromptEvent | null;
}

declare let self: SolHuntServiceWorkerGlobalScope;

// ──────────────────────────────────────────────────────
// 1. Precache static build assets (injected by vite-plugin-pwa)
// ──────────────────────────────────────────────────────
precacheAndRoute(self.__WB_MANIFEST as unknown as Array<PrecacheEntry>);
cleanupOutdatedCaches();

// ──────────────────────────────────────────────────────
// 2. SPA navigation fallback
//    All navigation requests → /index.html (client-side router handles them)
//    EXCEPT: /.netlify/functions/*, /api/*, /.well-known/*
// ──────────────────────────────────────────────────────
const navigationRoute = new NavigationRoute(
  createHandlerBoundToURL('/index.html'),
  {
    // Do NOT intercept navigation to these paths
    denylist: [
      /^\/.netlify\//,
      /^\/api\//,
      /^\/.well-known\//,
    ],
  }
);
registerRoute(navigationRoute);

// ──────────────────────────────────────────────────────
// 3. BLOCK caching for all dynamic / blockchain / API traffic
//    These MUST always hit the network to ensure freshness
// ──────────────────────────────────────────────────────
const NETWORK_ONLY_PATTERNS = [
  /\.netlify\/functions\//,         // Netlify serverless functions
  /\/api\//,                         // API proxy routes
  /helius-rpc\.com/,                 // Helius RPC
  /api\.mainnet-beta\.solana\.com/,  // Public Solana RPC
  /api\.devnet\.solana\.com/,        // Devnet RPC
  /firebaseio\.com/,                 // Firebase Realtime DB
  /googleapis\.com/,                 // Firebase / Google APIs
  /api\.dexscreener\.com/,           // DexScreener pricing
  /raydium\.io/,                     // Raydium SDK
  /api\.jup\.ag/,                    // Jupiter aggregator
  /lite-api\.jup\.ag/,               // Jupiter lite
  /price\.jup\.ag/,                  // Jupiter pricing
  /quote-api\.jup\.ag/,              // Jupiter quotes
  /dlmm-api\.meteora\.ag/,           // Meteora DLMM
  /api-mainnet\.magiceden\.dev/,     // Magic Eden
  /sanctum-extra-api/,               // Sanctum
  /block-engine\.jito\.wtf/,         // Jito block engine
  /arweave\.net/,                    // Arweave storage
  /nftstorage\.link/,                // NFT.storage
  /ipfs\.io/,                        // IPFS
  /cloudflare-ipfs\.com/,            // Cloudflare IPFS
];

for (const pattern of NETWORK_ONLY_PATTERNS) {
  registerRoute(pattern, new NetworkOnly());
}

// ──────────────────────────────────────────────────────
// 4. Google Fonts: network-first with fallback to cache
// ──────────────────────────────────────────────────────
registerRoute(
  /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
  new NetworkFirst({ cacheName: 'google-fonts', networkTimeoutSeconds: 5 })
);

// ──────────────────────────────────────────────────────
// 5. App shell: Stale-while-revalidate for faster loads
//    Show cached version immediately, update in background
// ──────────────────────────────────────────────────────
registerRoute(
  /\.(?:js|css)$/,
  new StaleWhileRevalidate({ cacheName: 'static-assets' })
);

// ──────────────────────────────────────────────────────
// 6. Lifecycle: skip waiting + claim clients for fast updates
// ──────────────────────────────────────────────────────
self.skipWaiting();
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ──────────────────────────────────────────────────────
// 7. PWA Install Prompt Capture
//    Defer the native install prompt for better UX timing
// ──────────────────────────────────────────────────────
self.addEventListener('beforeinstallprompt', ((event: BeforeInstallPromptEvent) => {
    // Prevent the mini-infobar from appearing on mobile
    event.preventDefault();
    // Store the event in both places:
    //   1. capturedInstallPrompt — used by the postMessage logic below
    //   2. self.deferredInstallPrompt — read by the app via SW registration
    self.deferredInstallPrompt = event;
    // Notify any listening clients that install is available
    self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => {
            try {
                client.postMessage({
                    type: 'INSTALL_AVAILABLE',
                    data: { available: true }
                });
            } catch (e: unknown) {
                // Client may have disconnected, ignore
                logger.warn('Failed to notify client of install availability:', e instanceof Error ? e.message : String(e));
            }
        });
    }).catch((err: unknown) => {
        // Service worker clients API may not be available in all contexts
        logger.warn('Failed to match clients for install notification:', err instanceof Error ? err.message : String(err));
    });
}) as EventListener);
