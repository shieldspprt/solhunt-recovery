// Workbox module declarations — these packages are bundled by VitePWA at build time
// but are not available during type-checking without explicit declarations.

declare module 'workbox-precaching' {
    export interface PrecacheEntry {
        url: string;
        revision: string | null;
    }
    export const precacheAndRoute: (entries: PrecacheEntry[]) => void;
    export const cleanupOutdatedCaches: () => void;
    export function createHandlerBoundToURL(url: string): unknown;
}

// Extend Workbox's ServiceWorkerGlobalScope with the VitePWA-injected manifest.
// Workbox's __WB_MANIFEST is typed as (string | PrecacheEntry)[] at runtime.
// This augmentation provides a named interface for the manifest entries.
interface WBManifestEntry {
    url: string;
    revision: string | null;
}

declare global {
    interface ServiceWorkerGlobalScope {
        __WB_MANIFEST: (WBManifestEntry | string)[];
    }
}

declare module 'workbox-routing' {
    export class NavigationRoute {
        constructor(handler: unknown, options?: { denylist?: RegExp[]; allowlist?: RegExp[] });
    }
    export const registerRoute: (route: NavigationRoute | RegExp | string, handler?: unknown) => void;
}

declare module 'workbox-strategies' {
    export class NetworkFirst {
        constructor(options?: { cacheName?: string; networkTimeoutSeconds?: number });
    }
    export class NetworkOnly {
        constructor(options?: { cacheName?: string }): void;
    }
    export class StaleWhileRevalidate {
        constructor(options?: { cacheName?: string }): void;
    }
}

declare module 'virtual:pwa-register' {
    export interface RegisterSWOptions {
        immediate?: boolean;
        onNeedRefresh?: () => void;
        onOfflineReady?: () => void;
        onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
        onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
        onRegisterError?: (error: Error) => void;
    }
    export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}
