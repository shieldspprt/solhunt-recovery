import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL, PrecacheEntry } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope;

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
//    Uses native ExtendableEvent from Service Worker DOM spec
// ──────────────────────────────────────────────────────
self.skipWaiting();
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ──────────────────────────────────────────────────────
// 7. PWA Install Prompt Capture
//    Defer the native install prompt for better UX timing
// ──────────────────────────────────────────────────────
let deferredInstallPrompt: Event | null = null;

self.addEventListener('beforeinstallprompt', (event: Event) => {
    // Prevent the mini-infobar from appearing on mobile
    event.preventDefault();
    // Store the event for later use by the app
    deferredInstallPrompt = event;
    // Notify any listening clients that install is available
    self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => {
            client.postMessage({
                type: 'INSTALL_AVAILABLE',
                data: { available: true }
            });
        });
    });
});

// Make the deferred prompt available globally for the app to trigger
(self as unknown as Record<string, unknown>).deferredInstallPrompt = deferredInstallPrompt;
