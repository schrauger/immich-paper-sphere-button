// Pure helpers shared by the userscript and the extension.
// build.mjs strips the `export ` keywords and inlines this file ahead of button.js.

export const DEFAULT_GENERATOR_URL = 'https://sphere.schrauger.com/web/';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PHOTO_RE = new RegExp(`/photos/(${UUID})(?:/|$)`, 'i');
const SHARE_RE = /^\/(share|s)\/([^/]+)/;

/**
 * Which asset (if any) and which share (if any) an Immich page is showing.
 * Returns null on pages where the button can never apply.
 */
export function parseLocation(pathname) {
  const photo = pathname.match(PHOTO_RE);
  const shareMatch = pathname.match(SHARE_RE);
  const share = shareMatch ? { [shareMatch[1] === 'share' ? 'key' : 'slug']: shareMatch[2] } : null;
  if (!photo && !share) return null;
  return { assetId: photo ? photo[1] : null, share };
}

/** The query string that authorises API calls on a share page ('' when logged in). */
export function apiQuery(share) {
  if (share?.key) return `?key=${encodeURIComponent(share.key)}`;
  if (share?.slug) return `?slug=${encodeURIComponent(share.slug)}`;
  return '';
}

/** A panorama is an equirectangular image; with no projection known, an exactly 2:1 image counts. */
export function isPanorama(asset) {
  return asset?.type === 'IMAGE' && isEquirectangular(asset);
}

/** A panorama video: the same test as a panorama, for a video. */
export function isPanoramaVideo(asset) {
  return asset?.type === 'VIDEO' && isEquirectangular(asset);
}

function isEquirectangular(asset) {
  const projection = asset.exifInfo?.projectionType;
  if (projection) return projection.toUpperCase() === 'EQUIRECTANGULAR';
  const w = asset.width ?? asset.exifInfo?.exifImageWidth;
  const h = asset.height ?? asset.exifInfo?.exifImageHeight;
  return w > 0 && h > 0 && w === 2 * h;
}

const BROWSER_READY = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * The files to try, best first. A browser-ready original is preferred; anything else
 * (HEIC, RAW, …) goes as Immich's full-size JPEG rendition. Later entries are fallbacks
 * for shares that don't allow downloading the original.
 */
export function downloadCandidates(asset, share) {
  const base = `/api/assets/${asset.id}`;
  const q = apiQuery(share);
  const thumb = (size) => `${base}/thumbnail${q ? q + '&' : '?'}size=${size}`;
  const fileName = asset.originalFileName || 'panorama.jpg';
  const originalOk = BROWSER_READY.includes(asset.originalMimeType);
  const jpgName = originalOk ? fileName : fileName.replace(/\.[^.]*$/, '') + '.jpg';
  const list = [];
  if (originalOk) list.push({ path: `${base}/original${q}`, name: fileName, reduced: false });
  list.push({ path: thumb('fullsize'), name: jpgName, reduced: originalOk });
  list.push({ path: thumb('preview'), name: jpgName, reduced: true });
  return list;
}

function httpUrl(input) {
  try {
    const url = new URL(String(input).trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/** A typed generator URL, the default when left blank, or null when it isn't an http(s) URL. */
export function normalizeGeneratorUrl(input) {
  if (!String(input ?? '').trim()) return DEFAULT_GENERATOR_URL;
  return httpUrl(input)?.href ?? null;
}

/** The origin of a typed Immich host address, or null when it isn't an http(s) URL. */
export function immichOrigin(input) {
  return httpUrl(input)?.origin ?? null;
}

/** The generator address that asks it to wait for a handoff. */
export function handoffUrl(generatorUrl) {
  return generatorUrl.replace(/#.*$/, '') + '#from-opener';
}

// --- Panorama videos: opened by share link (docs/adr/0002) ---

export const SHARE_LINK_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * An existing share link the generator can stream this video from: it shows only this video,
 * allows downloads, has no password, and has at least a day left.
 */
export function reusableShareLink(links, assetId, now) {
  if (!Array.isArray(links)) return undefined;
  return links.find((l) =>
    l.type === 'INDIVIDUAL' && l.allowDownload && !l.password && l.key &&
    l.assets?.length === 1 && l.assets[0].id === assetId &&
    (!l.expiresAt || Date.parse(l.expiresAt) > now + DAY_MS));
}

/** The body for POST /api/shared-links. Metadata (location, camera) stays hidden. */
export function newShareLinkBody(assetId, now) {
  return {
    type: 'INDIVIDUAL', assetIds: [assetId], allowDownload: true, showMetadata: false,
    expiresAt: new Date(now + SHARE_LINK_DAYS * DAY_MS).toISOString(),
  };
}

/** The Immich page for one asset inside a share, which tells the generator which asset to load. */
export function shareAssetUrl(origin, share, assetId) {
  const base = share.key ? `/share/${encodeURIComponent(share.key)}` : `/s/${encodeURIComponent(share.slug)}`;
  return `${origin}${base}/photos/${assetId}`;
}

/** The generator address that streams from a share link. */
export function streamUrl(generatorUrl, shareUrl) {
  const url = new URL(generatorUrl);
  url.hash = '';
  url.searchParams.set('url', shareUrl);
  return url.href;
}

/** Reuse a matching share link of the video, or create one. `api` does same-origin JSON calls. */
export async function findOrCreateShareLink({ api, assetId, now }) {
  const existing = reusableShareLink(await api.get('/api/shared-links').catch(() => null), assetId, now);
  if (existing) return existing;
  const created = await api.post('/api/shared-links', newShareLinkBody(assetId, now));
  if (!created?.key) throw new Error('Immich returned no share key');
  return created;
}

/** Only the tab this click opened, at the configured generator origin, may ask for the photo. */
export function isReadyMessage(event, win, generatorOrigin) {
  return event.source === win && event.origin === generatorOrigin && event.data?.type === 'paper-sphere-ready';
}

/**
 * Download the panorama and send it to the generator tab once it is ready.
 * - every download fails → close the tab and throw that error
 * - `timeout` settles before `ready` → throw, leaving the tab open
 * Resolves with whether a reduced-size copy was sent.
 */
export async function runHandoff({ win, candidates, fetchBlob, ready, timeout, post }) {
  const download = (async () => {
    let lastError;
    for (const c of candidates) {
      try {
        return { blob: await fetchBlob(c.path), candidate: c };
      } catch (e) {
        lastError = e;
      }
    }
    win.close();
    throw lastError;
  })();
  const readyOrTimeout = Promise.race([
    ready,
    timeout.then(() => { throw new Error("Generator didn't respond — check the generator URL"); }),
  ]);
  const [{ blob, candidate }] = await Promise.all([download, readyOrTimeout]);
  post({ type: 'paper-sphere-image', name: candidate.name, blob });
  return { reduced: candidate.reduced };
}
