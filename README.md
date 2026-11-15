# Immich paper sphere button

Adds a **Make paper sphere** button to [Immich](https://immich.app) while you view a panorama (a 360° equirectangular photo). One click opens the [paper sphere generator](https://sphere.schrauger.com/web/) with that photo already loaded, ready to print, cut out and fold into a sphere.

- The photo goes straight from your Immich tab to the generator tab in your browser. Nothing is uploaded, and no share link is created ([why](docs/adr/0001-handoff-by-postmessage-not-share-links.md)).
- It works on your own library, in albums, and on Immich share pages. If a share doesn't allow downloads, a reduced-size copy is sent, and the button says so.
- HEIC, RAW and other formats browsers can't open are sent as Immich's full-size JPEG.
- It also works on 360° videos, but differently: the generator streams the video from an Immich share link, so your Immich has to allow it ([below](#videos)).

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

Open a panorama in Immich and click **Make paper sphere** at the lower left, just above the thumbnail strip. A generator tab opens and the photo loads. If your browser blocks the new tab, allow pop-ups for your Immich site.

A photo counts as a panorama if Immich lists its projection as equirectangular. If Immich doesn't know the projection, any photo that is exactly twice as wide as it is tall counts too. Videos are checked the same way.

### Videos

A 360° video is too large to hand over between tabs ([why](docs/adr/0002-panorama-videos-open-by-share-link.md)). Instead, the generator streams it from an Immich share link, and you pick the frame to print there.

- **Logged in:** the button asks first, then reuses a share link that shows only this video, or creates one that allows downloads, hides metadata and expires in 7 days. Anyone with the link can view and download the video until then. You can delete it under *Sharing → Shared links*. If Immich won't create the link, the button explains how to make one yourself and paste it into the generator.
- **On a share page:** the button opens that share in the generator and creates nothing. If the share doesn't allow downloads, the generator gets Immich's lower-resolution playback version.

Your Immich server has to allow the generator's site to load from it (CORS). Without that, the generator can't read the video. The [generator's README](https://github.com/schrauger/360-paper-sphere-generator#web-app) shows the nginx setup.

## Development

```sh
npm test        # unit tests, plus a check that the committed build is current
npm run build   # regenerates the userscript and extension/ from src/
```

Edit the files in `src/`, then build. Commit the generated `immich-paper-sphere-button.user.js` and `extension/` too, so they can be installed without building. Vocabulary is in [`GLOSSARY.md`](GLOSSARY.md).

### Releasing

Bump `version` in `package.json`, run `npm run build`, commit, then push a tag `v<version>`. The [release workflow](.github/workflows/release.yml) tests, packages the extension as a Chrome zip, signs a self-hosted Firefox `.xpi` through Mozilla (unlisted), and attaches both, `updates.json` and the userscript to a GitHub Release. Installed Firefox copies update from `updates.json` on the latest release. It needs the repository secrets `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` from [addons.mozilla.org API keys](https://addons.mozilla.org/developers/addon/api/key/).

To test against a local generator, run `npm run serve` in the generator repo and set the generator URL to that address.

## License

[AGPL-3.0](LICENSE)
