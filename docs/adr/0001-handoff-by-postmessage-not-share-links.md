# Hand the panorama over with postMessage, not a share link

This still applies to photos. Panorama videos are opened by share link instead: see [ADR 0002](0002-panorama-videos-open-by-share-link.md).

The button needs to get a panorama that is visible in an Immich tab into the generator, which runs on a different origin. We considered having the button create a temporary Immich share link and open the generator with it, so that the generator downloads the photo itself. We chose a different approach. The button downloads the photo inside the Immich tab, using the access that tab already has (the login session, or the share key on a share page). It then opens the generator tab and passes it the bytes as a Blob with `postMessage`.

## Considered options

- **Temporary share link per click (rejected).** It publishes the photo at a guessable-by-possession URL. Something has to delete the links afterwards. It needs an Immich API key or session with permission to create shares. Every Immich host would need CORS set up for the generator's origin.
- **postMessage between tabs (chosen).** Nothing is published, stored, or left behind, and no server or CORS change is involved.

## Consequences

- The generator tab has to be opened by the Immich tab (`window.open` on the click), because the generator learns where to send its "ready" message from `window.opener`. Opening the generator any other way can't receive a handoff.
- If Immich ever sends `Cross-Origin-Opener-Policy: same-origin`, `window.opener` would be cut and this approach would stop working.
- On a share that doesn't allow downloads, the button can only send a reduced-size copy, because that is all the tab can fetch.
