# Immich → paper-sphere button: handoff for a fresh session

This repo will hold a **userscript** and a **browser extension (Chrome and Firefox, one Manifest V3 codebase)**. They add a "Make paper sphere" button to equirectangular (360°) photos in Immich. Clicking it opens the paper-sphere generator web app with that photo already loaded.

The generator lives in a separate repo, `../360-paper-sphere-generator`. Its public site is `https://sphere.schrauger.com/web/`. The generator-side half of this feature (the receiving end of the handoff below) is built there, on branch `feat/load-from-url`. Its design doc is `../360-paper-sphere-generator/docs/superpowers/specs/2026-11-14-load-from-url-design.md`. Read the "Immich button" section; it was written before the button moved to this repo.

## What the user asked for, and the decisions made

- **One click from Immich.** Immich has no UI plugin system (its plugins are server-side workflow automations only). That is why this is a userscript plus an extension.
- **The userscript and the extension share one codebase.** Write one shared content script, then a small build script that emits both the `.user.js` and the unpacked extension folder. Commit the generated outputs so they can be installed without building.
- **Both the Immich host and the generator host are configurable.** The generator defaults to `https://sphere.schrauger.com/web/`. The user will publish this repo, so don't hard-code their Immich hostname.
- **The button floats** (fixed position, bottom left) rather than being added to Immich's toolbar. Immich's markup changes between releases.
- **The photo goes from tab to tab with `postMessage`.** There is no server or proxy, and no share link is created.

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
  - `src/core.js`: pure helpers as an ES module, tested with `node --test`. It holds:
    - `assetIdFromPath(pathname) → string|null`
    - `isEquirectangular(asset) → boolean`
    - `DEFAULT_GENERATOR_URL`
    - `handoffUrl(generatorUrl) → string`
  - `src/button.js`: the DOM and the handoff, as plain script, using `getGeneratorUrl()`, which each build target supplies.
- **`build.mjs`:** strips `export ` from `core.js`, concatenates it with `button.js`, and wraps the result in an IIFE.
  - **Userscript:** header with `@match https://immich.example.com/*` (the user edits this), `@grant GM_getValue`, `GM_setValue` and `GM_registerMenuCommand`, plus a "Set sphere generator URL…" menu command.
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
- **Button behaviour:** shows `Sending…` while it works. On an error, it shows the error text on the button for 4 s.
- **README:**
  - Installing the userscript (Violentmonkey or Tampermonkey; edit `@match`).
  - Loading the extension unpacked in Chrome (`chrome://extensions`, Developer mode, Load unpacked) and in Firefox (`about:debugging`, Load Temporary Add-on).
  - Setting the options.

## Not needed here

The **nginx CORS change** on the user's Immich is already done and checked (it allows only `https://sphere.schrauger.com`). It's for the generator's pasted share links. The button doesn't need it, because it fetches same-origin and hands the image across with `postMessage`.

## Testing end to end

The generator's `#from-opener` support must be deployed, or served locally from `../360-paper-sphere-generator` with `npm run serve`; point the generator URL setting at it. Then open a 360° photo in Immich and click the button.
