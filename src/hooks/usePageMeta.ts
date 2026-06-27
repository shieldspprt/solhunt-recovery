/**
 * usePageMeta — Centralized SEO meta tag management.
 *
 * Every SolHunt page needs the same set of meta tags updated on mount:
 *   - document.title
 *   - <meta name="description">
 *   - <meta property="og:title">
 *   - <meta property="og:description">
 *   - <meta property="og:image">
 *   - <meta name="twitter:title">
 *   - <meta name="twitter:description">
 *   - <meta name="robots">
 *
 * Open Graph and Twitter cards are updated together because Slack/Discord/Facebook
 * prefer og:* and Twitter/X prefers twitter:* — but most non-Twitter scrapers
 * (iMessage, Signal, LinkedIn, Notion link previews) fall back to og:* and many
 * Twitter clients fall back to og:* when twitter:title is missing. Previously
 * only the og:* tags were synced, so a shared URL on Twitter showed the default
 * site title/description from index.html even after navigating to a page that
 * called usePageMeta({ title: 'Buffer Recovery' }).
 *
 * Before this hook, every page had the same 8–10 line useEffect duplicating
 * querySelector/setAttribute calls. That's 14 pages × ~10 lines = ~140 lines
 * of boilerplate, plus 4+ querySelector calls per page (56+ DOM lookups) on
 * every route change.
 *
 * This hook:
 *   1. Caches the result of each querySelector in module scope (singleton
 *      per element). The meta tags live in index.html and never change at
 *      runtime, so a single lookup at module load is enough.
 *   2. Sets all tags in one place — guarantees consistency across pages.
 *   3. Accepts a `noindex` flag so pages with wallet-specific scan results
 *      stay out of search engines by default.
 *   4. Updates tags in a single microtask via setAttribute on cached nodes.
 *
 * Usage:
 *   usePageMeta({
 *     title: 'Buffer Recovery | SolHunt',
 *     description: 'Recover locked SOL from Solana program buffer accounts…',
 *     noindex: true,
 *   });
 */
import { useEffect } from 'react';

const DEFAULT_OG_IMAGE = 'https://solhunt.dev/solhunt_og_preview.png';

export interface PageMeta {
    /** Page title (without "| SolHunt" suffix — added automatically if missing). */
    title: string;
    /** Meta description. Falls back to the page title when omitted. */
    description?: string;
    /**
     * When true, sets <meta name="robots" content="noindex, follow">.
     * Use for pages that may display wallet-specific content (e.g. /scan).
     * Defaults to false (indexable).
     */
    noindex?: boolean;
}

// Module-scope cache of the meta tag nodes. They exist from the initial HTML
// parse and persist for the lifetime of the page, so we only need to look
// them up once. Each entry is `null` if the corresponding tag is missing.
let cachedNodes: {
    description: HTMLMetaElement | null;
    ogTitle: HTMLMetaElement | null;
    ogDescription: HTMLMetaElement | null;
    ogImage: HTMLMetaElement | null;
    twitterTitle: HTMLMetaElement | null;
    twitterDescription: HTMLMetaElement | null;
    twitterImage: HTMLMetaElement | null;
    robots: HTMLMetaElement | null;
} | null = null;

function getNodes() {
    if (cachedNodes !== null) return cachedNodes;
    cachedNodes = {
        description: document.querySelector('meta[name="description"]'),
        ogTitle: document.querySelector('meta[property="og:title"]'),
        ogDescription: document.querySelector('meta[property="og:description"]'),
        ogImage: document.querySelector('meta[property="og:image"]'),
        twitterTitle: document.querySelector('meta[name="twitter:title"]'),
        twitterDescription: document.querySelector('meta[name="twitter:description"]'),
        twitterImage: document.querySelector('meta[name="twitter:image"]'),
        robots: document.querySelector('meta[name="robots"]'),
    };
    return cachedNodes;
}

/**
 * Updates document.title and the standard SEO/OG/Twitter meta tags for the
 * current page. Safe to call during SSR (guards document access) and gracefully
 * no-ops when individual meta tags are missing from the document head.
 */
export function setPageMeta(meta: PageMeta): void {
    if (typeof document === 'undefined') return;

    const normalizedTitle = meta.title.includes('| SolHunt')
        ? meta.title
        : `${meta.title} | SolHunt`;
    const fallbackDescription = meta.title.replace(/\s*\|\s*SolHunt$/, '').trim() || normalizedTitle;
    const normalizedDescription = meta.description?.trim() || fallbackDescription;

    // Title is special — direct property assignment is the only way.
    document.title = normalizedTitle;

    const nodes = getNodes();

    // og:title always reflects the current page title — this is independent
    // of the description. Previously this was nested inside the description
    // branch, so a page that called usePageMeta({ title: '...' }) without a
    // description left og:title at the previous page's value. Link-preview
    // scrapers (Slack, Twitter, Discord) read og:title directly from the
    // static HTML on first render, so a stale value persists for the whole
    // share window even if document.title updates.
    if (nodes.ogTitle) nodes.ogTitle.setAttribute('content', normalizedTitle);
    // Mirror to twitter:title so Twitter/X card scrapers see the per-page
    // title. Twitter falls back to og:title when twitter:title is absent,
    // but most Twitter clients (TweetDeck, Tweetbot, official X web) honor
    // twitter:title explicitly. Keeping them in sync prevents divergent
    // previews between Slack (og:*) and Twitter (twitter:*).
    if (nodes.twitterTitle) nodes.twitterTitle.setAttribute('content', normalizedTitle);

    // Always write a description so we never leave a stale previous-route
    // description behind when a page omits one. Existing pages that provide
    // their own description keep that text; omitted descriptions fall back
    // to the page title, which is a better default than stale metadata.
    if (nodes.description) nodes.description.setAttribute('content', normalizedDescription);
    if (nodes.ogDescription) nodes.ogDescription.setAttribute('content', normalizedDescription);
    // Mirror to twitter:description for the same reason as twitter:title.
    if (nodes.twitterDescription) nodes.twitterDescription.setAttribute('content', normalizedDescription);
    // OG and Twitter images are global (set once in index.html), but force
    // them to the canonical URL every time to defend against any future code
    // path that may have replaced the node (e.g. a future dynamic-image
    // experiment). Cheap, idempotent, and prevents link-previews from
    // showing a 404 for a removed or moved asset.
    if (nodes.ogImage) nodes.ogImage.setAttribute('content', DEFAULT_OG_IMAGE);
    if (nodes.twitterImage) nodes.twitterImage.setAttribute('content', DEFAULT_OG_IMAGE);
    if (nodes.robots) {
        nodes.robots.setAttribute('content', meta.noindex === true ? 'noindex, follow' : 'index, follow');
    }
}

/**
 * React hook wrapper for setPageMeta. Runs once on mount (or when deps change)
 * and leaves the meta tags in their last state — the next page mount will
 * overwrite them.
 *
 * For pages that need dynamic titles (e.g. EngineHowItWorksPage where the
 * title depends on the route param), pass the dynamic values directly and
 * include them in the deps array.
 */
export function usePageMeta(
    meta: PageMeta,
    deps: ReadonlyArray<unknown> = []
): void {
    useEffect(() => {
        setPageMeta(meta);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
}
