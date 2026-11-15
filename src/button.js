// The floating "Make paper sphere" button. Plain script: build.mjs inlines core.js above it,
// and each build target defines getGeneratorUrl() → Promise<string> before this runs.

const READY_TIMEOUT_MS = 20000;
const MESSAGE_MS = 4000;
const LABEL = 'Make paper sphere';

let generatorUrl = DEFAULT_GENERATOR_URL;
const refreshGeneratorUrl = () =>
  getGeneratorUrl().then((u) => { generatorUrl = u || DEFAULT_GENERATOR_URL; }, () => {});
refreshGeneratorUrl();

const button = document.createElement('button');
button.type = 'button';
button.textContent = LABEL;
button.style.cssText = [
  'position:fixed', 'left:16px', 'bottom:16px', 'z-index:2147483647', 'display:none',
  'padding:10px 16px', 'border:0', 'border-radius:999px', 'cursor:pointer',
  'font:600 14px/1.2 system-ui,sans-serif', 'color:#fff', 'background:#4250af',
  'box-shadow:0 2px 8px rgba(0,0,0,.4)', 'max-width:calc(100vw - 32px)',
].join(';');

let current = null; // { asset, share } for the panorama on screen, or null
let busy = false;
let lastPath = null;
let lookup = 0; // ignores answers to lookups made for a page we've since left

function show(visible) {
  button.style.display = visible ? 'block' : 'none';
}

function flash(text) {
  button.textContent = text;
  setTimeout(() => { if (!busy) button.textContent = LABEL; }, MESSAGE_MS);
}

async function getJson(path) {
  const res = await fetch(location.origin + path, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Immich returned ${res.status}`);
  return res.json();
}

async function onLocationChange() {
  if (location.pathname === lastPath) return;
  lastPath = location.pathname;
  const id = ++lookup;
  current = null;
  if (!busy) show(false);
  const where = parseLocation(location.pathname);
  if (!where) return;
  try {
    const q = apiQuery(where.share);
    let asset;
    if (where.assetId) {
      asset = await getJson(`/api/assets/${where.assetId}${q}`);
    } else {
      const link = await getJson(`/api/shared-links/me${q}`);
      if (link.assets?.length !== 1) return;
      asset = link.assets[0];
      // The share listing may leave out details; ask for the asset itself.
      asset = await getJson(`/api/assets/${asset.id}${q}`).catch(() => asset);
    }
    if (id !== lookup || !isPanorama(asset)) return;
    current = { asset, share: where.share };
    show(true);
  } catch {
    // Not viewable with this session (or not an asset): leave the button hidden.
  }
}

async function fetchBlob(path) {
  const res = await fetch(location.origin + path, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  return res.blob();
}

function onClick() {
  if (busy || !current) return;
  const target = generatorUrl;
  // Must open synchronously within the click, or it's treated as a blocked popup.
  const win = window.open(handoffUrl(target), '_blank');
  refreshGeneratorUrl();
  if (!win) {
    flash('Pop-up blocked — allow pop-ups for this site');
    return;
  }
  const origin = new URL(target).origin;
  let onMessage;
  const ready = new Promise((resolve) => {
    onMessage = (e) => { if (isReadyMessage(e, win, origin)) resolve(); };
    window.addEventListener('message', onMessage);
  });
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(resolve, READY_TIMEOUT_MS); });

  busy = true;
  button.disabled = true;
  button.textContent = 'Sending…';
  const { asset, share } = current;
  runHandoff({
    win,
    candidates: downloadCandidates(asset, share),
    fetchBlob,
    ready,
    timeout,
    post: (message) => win.postMessage(message, origin),
  }).then(
    ({ reduced }) => {
      busy = false;
      if (reduced) flash("Sent a reduced-size copy (share doesn't allow downloads)");
      else button.textContent = LABEL;
    },
    (err) => {
      busy = false;
      flash(err?.message || String(err));
    },
  ).finally(() => {
    window.removeEventListener('message', onMessage);
    clearTimeout(timer);
    button.disabled = false;
    if (!current) show(false);
  });
}

button.addEventListener('click', onClick);
(document.body || document.documentElement).appendChild(button);

// Immich is a single-page app: follow its navigation.
for (const method of ['pushState', 'replaceState']) {
  const original = history[method];
  history[method] = function (...args) {
    const result = original.apply(this, args);
    onLocationChange();
    return result;
  };
}
window.addEventListener('popstate', onLocationChange);
setInterval(onLocationChange, 1000);
onLocationChange();
