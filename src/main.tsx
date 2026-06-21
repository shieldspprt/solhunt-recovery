import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import './index.css'
import { logger } from '@/lib/logger'
import { validateEnvironment } from '@/lib/envValidator'

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

/**
 * Boot-time env validation gate.
 *
 * The validateEnvironment() helper in src/lib/envValidator.ts defines a full
 * audit (RPC URL shape, treasury pubkey, protocol guards) but was never
 * actually called — so a missing or typo'd VITE_HELIUS_RPC_URL silently fell
 * through to the public mainnet-beta endpoint in src/config/solana.ts, which
 * is rate-limited and breaks every scan with no signal of WHY the RPC is
 * failing. Wiring the validator here runs the check once before the React
 * tree mounts, so misconfiguration surfaces as a visible error screen at
 * app boot instead of a silent production degradation.
 *
 * On valid env: nothing changes (the overlay is removed and React mounts).
 * On invalid env: an accessible, focusable error overlay lists every problem
 * (role="alert", aria-live="assertive") so screen readers and operators both
 * see what needs fixing. The error UI is plain HTML — no React, no JSX, no
 * dependencies — so it survives even if a missing env var would have caused
 * the bundler-evaluated modules above to throw.
 */
function renderEnvErrorOverlay(errors: string[]): void {
    const root = document.getElementById('root');
    if (!root) {
        // No DOM root means we cannot show the overlay. Log and bail loudly
        // so the failure is still observable in the dev console / Sentry.
        logger.error('SolHunt env validation failed and no #root element exists to render the error overlay', undefined, { errorsCount: errors.length, firstError: errors[0] ?? '' });
        return;
    }
    // Replace any pre-rendered children with the error UI. Use textContent
    // for each error so the list is never parsed as HTML — defends against
    // a misconfigured env value (e.g. a stray "javascript:..." in
    // VITE_HELIUS_RPC_URL) being injected as markup if the validator regex
    // is ever loosened.
    root.replaceChildren();
    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'alert');
    overlay.setAttribute('aria-live', 'assertive');
    overlay.setAttribute('aria-labelledby', 'solhunt-env-error-title');
    overlay.style.cssText = [
        'min-height:100vh',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'padding:24px',
        'background:#09090b',
        'color:#fafafa',
        'font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
    ].join(';');

    const card = document.createElement('div');
    card.style.cssText = [
        'max-width:640px',
        'width:100%',
        'border:1px solid #3f3f46',
        'border-radius:12px',
        'padding:24px',
        'background:#18181b',
    ].join(';');

    const title = document.createElement('h1');
    title.id = 'solhunt-env-error-title';
    title.textContent = 'SolHunt cannot start: invalid environment configuration';
    title.style.cssText = 'font-size:20px;font-weight:600;margin:0 0 8px 0;color:#fafafa;';

    const subtitle = document.createElement('p');
    subtitle.textContent = 'One or more required environment variables are missing or malformed. Fix the items below and reload the page.';
    subtitle.style.cssText = 'font-size:14px;line-height:1.5;margin:0 0 16px 0;color:#a1a1aa;';

    const list = document.createElement('ul');
    list.style.cssText = 'margin:0;padding-left:20px;font-size:13px;line-height:1.6;color:#e4e4e7;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;';
    for (const err of errors) {
        const li = document.createElement('li');
        // textContent only — never innerHTML — so an env value containing
        // angle brackets, quotes, or scripts cannot execute in the error UI.
        li.textContent = err;
        li.style.marginBottom = '6px';
        list.appendChild(li);
    }

    const hint = document.createElement('p');
    hint.textContent = 'See src/lib/envValidator.ts and the deployment docs for the full env contract.';
    hint.style.cssText = 'font-size:12px;line-height:1.5;margin:16px 0 0 0;color:#71717a;';

    card.appendChild(title);
    card.appendChild(subtitle);
    card.appendChild(list);
    card.appendChild(hint);
    overlay.appendChild(card);
    root.appendChild(overlay);
}

const envResult = validateEnvironment();
if (!envResult.valid) {
    logger.error('SolHunt env validation failed at boot', undefined, { errorsCount: envResult.errors.length, firstError: envResult.errors[0] ?? '' });
    // Visible, screen-reader-accessible error screen instead of silent
    // degradation to the public mainnet-beta endpoint.
    renderEnvErrorOverlay(envResult.errors);
} else {
    createRoot(document.getElementById('root')!).render(
        <App />,
    );
}
