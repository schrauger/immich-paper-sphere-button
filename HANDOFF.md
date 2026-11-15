# Immich → paper-sphere button: handoff for a fresh session

This repo will hold a **userscript** and a **browser extension (Chrome and Firefox, one Manifest V3 codebase)**. They add a "Make paper sphere" button to equirectangular (360°) photos in Immich. Clicking it opens the paper-sphere generator web app with that photo already loaded.

The generator lives in a separate repo, `../360-paper-sphere-generator`. Its public site is `https://sphere.schrauger.com/web/`. The generator-side half of this feature (the receiving end of the handoff below) is built there, on branch `feat/load-from-url`. Its design doc is `../360-paper-sphere-generator/docs/superpowers/specs/2026-11-14-load-from-url-design.md`. Read the "Immich button" section; it was written before the button moved to this repo.

Vocabulary is in `GLOSSARY.md` (Panorama, Generator, Button, Immich host, Generator URL, Handoff). Why the handoff uses `postMessage` instead of share links is in `docs/adr/0001-handoff-by-postmessage-not-share-links.md`.

## What the user asked for, and the decisions made

- **One click from Immich.** Immich has no UI plugin system (its plugins are server-side workflow automations only). That is why this is a userscript plus an extension.
- **The userscript and the extension share one codebase.** Write one shared content script, then a small build script that emits both the `.user.js` and the unpacked extension folder. Commit the generated outputs so they can be installed without building.
- **Both the Immich host and the generator host are configurable.** The generator defaults to `https://sphere.schrauger.com/web/`. The user will publish this repo, so don't hard-code their Immich hostname.
- **The button floats** (fixed position, bottom left) rather than being added to Immich's toolbar. Immich's markup changes between releases.
- **The photo goes from tab to tab with `postMessage`.** There is no server or proxy, and no share link is created (ADR 0001).
- **License: AGPL-3.0**, matching the generator. Copy its `LICENSE`.
- **One Immich host for now**, but always a setting (extension options page; userscript `@match` / user match), never hard-coded.
- **Later phase, not now:** publishing to the Chrome Web Store and Firefox AMO (including AMO signing so Firefox keeps it across restarts). Get everything working well first.

## Button behaviour (decided)

- **When it shows:** only on a photo page whose asset is a panorama; otherwise fully hidden. Photo pages are any path with `/photos/<assetId>` (timeline, albums, and share pages `/share/<key>/photos/<id>` and `/s/<slug>/photos/<id>`), plus a single-asset share at `/share/<key>` or `/s/<slug>` with no asset id, resolved via `GET /api/shared-links/me?key=…` (or `slug=…`) when the share holds exactly one asset.
- **Share pages:** every API call on a share page carries `?key=<key>` (or `?slug=<slug>`).
- **Panorama check:** `exifInfo.projectionType === 'EQUIRECTANGULAR'`; if the projection is unknown (no `exifInfo`, e.g. a share with metadata hidden, or a stitched export without the tag), fall back to the image being exactly 2:1.
- **Which file:** the original when its MIME type is JPEG, PNG or WebP; otherwise `/api/assets/<id>/thumbnail?size=fullsize`, named with a `.jpg` extension. If a share blocks the original (no downloads allowed), fall back to full-size, then preview, and say "Sent a reduced-size copy (share doesn't allow downloads)" on the button for 4 s.
- **While sending:** the button is disabled and shows `Sending…`. Each new click after that opens a new generator tab.
- **Download fails after the tab opened:** close that tab and show the error on the button for 4 s.
- **No ready message within 20 s:** show "Generator didn't respond — check the generator URL" on the button for 4 s and leave the tab open.
- **Trust:** act on the ready message only if `event.source` is the window this click opened and `event.origin` is the generator URL's origin; post the image with that origin as `targetOrigin`.
- **Risk to check during end-to-end testing:** if the Immich host sends `Cross-Origin-Opener-Policy: same-origin`, `window.opener` is cut and the handoff can't work.

## The handoff protocol (must match the generator)

1. On click, synchronously `window.open('<generatorUrl>#from-opener')`. It has to open synchronously so it isn't treated as a blocked popup. `#from-opener` replaces any existing hash.
2. Fetch `/api/assets/<id>/original` as a Blob. This is same-origin, using the user's Immich session.
3. The generator, opened with `#from-opener`, posts `{ type: 'paper-sphere-ready' }` to `window.opener`.
4. When the opener gets that message from the window it opened, it posts `{ type: 'paper-sphere-image', name: <originalFileName>, blob }` to it. The target origin is the generator URL's origin.
5. The generator loads the first such image and ignores later ones.

## Immich details

- **Photo page URLs:** `/photos/<assetId>`, including inside albums (`/albums/<albumId>/photos/<assetId>`). Immich is a SPA, so watch for URL changes: patch `history.pushState` and `replaceState`, listen for `popstate`, and keep a ~1 s poll as a fallback.
- **Equirectangular check:** `GET /api/assets/<id>` (same-origin, the session cookie works) → `exifInfo.projectionType === 'EQUIRECTANGULAR'`.
- **Server version:** the user's Immich is v3.4.0.

## Design so far (from the generator repo's plan; adapt freely)

- **Shared code:**
  - `src/core.js`: pure helpers as an ES module, tested with `node --test`. It holds (names are suggestions):
    - path parsing → asset id and/or share key/slug
    - `isPanorama(asset) → boolean` (projection type, then 2:1 fallback)
    - choosing the file to send from the asset's MIME type
    - `DEFAULT_GENERATOR_URL`
    - `handoffUrl(generatorUrl) → string`
  - `src/button.js`: the DOM and the handoff, as plain script, using `getGeneratorUrl()`, which each build target supplies.
- **`build.mjs`:** strips `export ` from `core.js`, concatenates it with `button.js`, and wraps the result in an IIFE.
  - **Userscript:** header with `@match https://immich.example.com/*` (the user edits this, or adds a user match in their manager), `@updateURL` and `@downloadURL` pointing at the committed file on `https://raw.githubusercontent.com/schrauger/immich-paper-sphere-button/main/…`, `@grant GM_getValue`, `GM_setValue` and `GM_registerMenuCommand`, plus a "Set sphere generator URL…" menu command.
  - **Extension:** reads its settings from `chrome.storage.sync`.
- **Extension:**
  - The options page has two fields: the Immich URL and the generator URL (with the default). On Save:
    1. Call `chrome.permissions.request({ origins: [immichOrigin + '/*'] })`.
    2. Store both URLs.
    3. Message `background.js`.
  - `background.js` unregisters and re-registers the content script with `chrome.scripting.registerContentScripts([{ id: 'immich-button', matches: [origin + '/*'], js: ['content.js'], persistAcrossSessions: true }])`. It does this on that message and on `onStartup` and `onInstalled`.
  - The manifest has:
    - `manifest_version: 3`
    - `permissions: ['storage', 'scripting']`
    - `optional_host_permissions: ['*://*/*']`
    - no static `content_scripts`
    - `background: { service_worker: 'background.js', scripts: ['background.js'] }` (Chrome uses `service_worker` and Firefox uses `scripts`)
    - `browser_specific_settings.gecko` with an `id` and `strict_min_version: '128.0'`
- **Tests:** unit tests for `core.js`, a "build output is up to date" test (build into a temp dir and compare with the committed files), and a manifest sanity test.
- **README:**
  - Installing the userscript (Violentmonkey or Tampermonkey; edit `@match`).
  - Loading the extension unpacked in Chrome (`chrome://extensions`, Developer mode, Load unpacked) and in Firefox (`about:debugging`, Load Temporary Add-on; note that Firefox forgets it on restart until store signing is done in a later phase).
  - Setting the options.

## Not needed here

The **nginx CORS change** on the user's Immich is already done and checked (it allows only `https://sphere.schrauger.com`). It's for the generator's pasted share links. The button doesn't need it, because it fetches same-origin and hands the image across with `postMessage`.

## Testing end to end

The generator's `#from-opener` support must be deployed, or served locally from `../360-paper-sphere-generator` with `npm run serve`; point the generator URL setting at it. Then open a 360° photo in Immich and click the button.
