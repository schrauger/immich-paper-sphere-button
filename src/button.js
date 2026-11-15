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
  'position:fixed', 'left:16px', 'bottom:100px', // clears the viewer's 83 px thumbnail strip
  'z-index:2147483647', 'display:none',
  'padding:10px 16px', 'border:0', 'border-radius:999px', 'cursor:pointer',
  'font:600 14px/1.2 system-ui,sans-serif', 'color:#fff', 'background:#4250af',
  'box-shadow:0 2px 8px rgba(0,0,0,.4)', 'max-width:calc(100vw - 32px)',
].join(';');

let current = null; // { asset, share, video } for the panorama or panorama video on screen, or null
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

async function postJson(path, body) {
  const res = await fetch(location.origin + path, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
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
    if (id !== lookup) return;
    const video = isPanoramaVideo(asset);
    if (!video && !isPanorama(asset)) return;
    current = { asset, share: where.share, video };
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
  if (current.video) onVideoClick();
  else onPhotoClick();
}

function onPhotoClick() {
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

// --- Panorama videos: too big to hand over, so the generator streams them from a share link ---

function onVideoClick() {
  const { asset, share } = current;
  if (share) {
    // Already on a share: the generator can stream from this one.
    const win = window.open(streamUrl(generatorUrl, shareAssetUrl(location.origin, share, asset.id)), '_blank');
    if (win) win.opener = null;
    else flash('Pop-up blocked — allow pop-ups for this site');
    return;
  }
  showDialog({
    title: 'Make a paper sphere from this video',
    lines: [
      'Videos are too large to hand over directly, so the generator streams this one from a share link.',
      `This creates a share link in your Immich, unless a suitable one already exists. ` +
        `Anyone with the link can view and download this video for ${SHARE_LINK_DAYS} days. ` +
        'You can delete it any time under Sharing → Shared links.',
    ],
    actions: [
      { label: 'Create share link and open', primary: true, run: () => openVideoByNewShare(asset) },
      { label: 'Cancel' },
    ],
  });
}

function openVideoByNewShare(asset) {
  const target = generatorUrl;
  // Open now, within the click, and navigate once the link exists; later would be blocked as a pop-up.
  const win = window.open('about:blank', '_blank');
  refreshGeneratorUrl();
  if (!win) {
    flash('Pop-up blocked — allow pop-ups for this site');
    return;
  }
  win.opener = null;
  busy = true;
  button.disabled = true;
  button.textContent = 'Creating share link…';
  findOrCreateShareLink({ api: { get: getJson, post: postJson }, assetId: asset.id, now: Date.now() })
    .then(
      (link) => {
        win.location.href = streamUrl(target, shareAssetUrl(location.origin, { key: link.key }, asset.id));
        button.textContent = LABEL;
      },
      (err) => {
        win.close();
        button.textContent = LABEL;
        showShareHelp(err, target);
      },
    )
    .finally(() => {
      busy = false;
      button.disabled = false;
      if (!current) show(false);
    });
}

function showShareHelp(err, target) {
  showDialog({
    title: "Couldn't create a share link",
    lines: [
      `${err?.message || err}. You can make one yourself:`,
      '1. With this video open in Immich, choose Share.',
      '2. Create a link with Allow download on and no password.',
      '3. Copy the link and paste it into the generator.',
    ],
    actions: [
      { label: 'Open generator', primary: true, run: () => window.open(target, '_blank') },
      { label: 'Close' },
    ],
  });
}

/** A small modal. Each action closes it, then runs (still inside the click, so it may open a tab). */
function showDialog({ title, lines, actions }) {
  const backdrop = document.createElement('div');
  backdrop.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483647', 'display:flex', 'align-items:center',
    'justify-content:center', 'padding:16px', 'background:rgba(0,0,0,.6)',
  ].join(';');
  const box = document.createElement('div');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.style.cssText = [
    'max-width:440px', 'padding:20px', 'border-radius:12px', 'background:#1f1f24', 'color:#eee',
    'font:14px/1.45 system-ui,sans-serif', 'box-shadow:0 8px 32px rgba(0,0,0,.5)',
  ].join(';');
  const heading = document.createElement('h2');
  heading.textContent = title;
  heading.style.cssText = 'margin:0 0 12px;font-size:17px;font-weight:600';
  box.append(heading);
  for (const line of lines) {
    const p = document.createElement('p');
    p.textContent = line;
    p.style.cssText = 'margin:0 0 8px';
    box.append(p);
  }
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:16px';
  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey, true);
  };
  // Capture Escape before Immich's viewer sees it and closes the asset.
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    e.preventDefault();
    close();
  };
  for (const action of actions) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = action.label;
    b.style.cssText = [
      'padding:8px 14px', 'border-radius:999px', 'cursor:pointer', 'font:600 14px/1.2 system-ui,sans-serif',
      action.primary ? 'border:0;background:#4250af;color:#fff' : 'border:1px solid #666;background:none;color:#eee',
    ].join(';');
    b.addEventListener('click', () => { close(); action.run?.(); });
    row.append(b);
  }
  box.append(row);
  backdrop.append(box);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', onKey, true);
  (document.body || document.documentElement).append(backdrop);
  row.querySelector('button')?.focus();
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
