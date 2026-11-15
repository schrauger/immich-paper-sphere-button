# Immich paper sphere button

Adds a **Make paper sphere** button to [Immich](https://immich.app) while you view a panorama (a 360° equirectangular photo). One click opens the [paper sphere generator](https://sphere.schrauger.com/web/) with that photo already loaded, ready to print, cut out and fold into a sphere.

- The photo goes straight from your Immich tab to the generator tab in your browser. Nothing is uploaded, and no share link is created ([why](docs/adr/0001-handoff-by-postmessage-not-share-links.md)).
- It works on your own library, in albums, and on Immich share pages. If a share doesn't allow downloads, a reduced-size copy is sent, and the button says so.
- HEIC, RAW and other formats browsers can't open are sent as Immich's full-size JPEG.

It comes in two forms built from the same code: a **userscript** and a **browser extension** for Chrome and Firefox. Use whichever you prefer.

## Userscript

1. Install [Violentmonkey](https://violentmonkey.github.io/) or [Tampermonkey](https://www.tampermonkey.net/).
2. Open [`immich-paper-sphere-button.user.js`](https://raw.githubusercontent.com/schrauger/immich-paper-sphere-button/main/immich-paper-sphere-button.user.js) and let the manager install it.
3. Point it at your Immich. The script ships matching `https://immich.example.com/*`. In the script's settings in your manager, add a **user match** such as `https://photos.example.org/*` (Violentmonkey: *Settings → @match rules*; Tampermonkey: *Settings → Includes/Excludes → User matches*). A user match survives updates. Editing the `@match` line directly works too, but an update will overwrite it.
4. To use a different generator, choose **Set sphere generator URL…** from the manager's menu on an Immich page.

## Extension

The extension isn't in the browser stores yet. Load it from this repo's `extension/` folder.

- **Chrome:** open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and select `extension/`.
- **Firefox:** open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on…**, and select `extension/manifest.json`. Firefox removes temporary add-ons when it restarts.

The settings page opens after you install it. You can reopen it from the toolbar icon or the browser's extension settings.

- **Immich host:** the address you open Immich at, for example `https://photos.example.org`. Saving asks your browser for permission to run on that site, and on no other.
- **Generator URL:** leave it blank for the public generator.

Reload any Immich tabs that were already open.

## Using it

Open a panorama in Immich and click **Make paper sphere** at the bottom left. A generator tab opens and the photo loads. If your browser blocks the new tab, allow pop-ups for your Immich site.

A photo counts as a panorama if Immich lists its projection as equirectangular. If Immich doesn't know the projection, any photo that is exactly twice as wide as it is tall counts too.

## Development

```sh
npm test        # unit tests, plus a check that the committed build is current
npm run build   # regenerates the userscript and extension/ from src/
```

Edit the files in `src/`, then build. Commit the generated `immich-paper-sphere-button.user.js` and `extension/` too, so they can be installed without building. Vocabulary is in [`GLOSSARY.md`](GLOSSARY.md).

To test against a local generator, run `npm run serve` in the generator repo and set the generator URL to that address.

## License

[AGPL-3.0](LICENSE)
