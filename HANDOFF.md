
## Addendum (2026-11-15): videos

The generator is gaining video support: scrub a 360° video and make a sphere from a frame. Design: `../360-paper-sphere-generator/docs/superpowers/specs/2026-11-15-video-frames-design.md`. It takes videos from local files, `?url=`, and Immich share links, which it streams.

**What the user asked for:** on a 360° **video**, the button should not hand the file over with `postMessage`, because that would hold a ~400 MB video in memory. Instead:

- **Offer "Create a share link and open it".**
  - Confirm first: this creates a share link in the user's Immich.
  - Then call `POST /api/shared-links` (same-origin, with the session) with `{ type: 'INDIVIDUAL', assetIds: [id], allowDownload: true }`, plus a suggested expiry of about 7 days.
  - Then open `<generatorUrl>?url=<encodeURIComponent(origin + '/share/' + key)>`.
- **If creating the share fails** (permissions, an older server), show a popup explaining how to create a share in Immich and paste its link into the generator.
- **Detecting a video:** the asset's `type === 'VIDEO'` and `exifInfo.projectionType === 'EQUIRECTANGULAR'` from `GET /api/assets/<id>`.
