# Open panorama videos by share link

The generator can now make a sphere from a frame of a panorama video. Those videos are often hundreds of MB (a stitched 5760×2880 clip is about 400 MB). A handoff ([ADR 0001](0001-handoff-by-postmessage-not-share-links.md)) would hold the whole file in memory in both tabs, before the generator could show a single frame. Instead, for a panorama video the button opens the generator at an Immich share link to the video, and the generator streams it with a `<video>` element, reading only what it seeks to.

This is the option ADR 0001 rejected for photos. It still has the same costs, and for photos the handoff is still used. For videos the costs are worth paying, because streaming is the only approach that doesn't load the whole file.

## How it works

- **On a share page**, the page is already a share link, so the button opens `<generator>?url=<origin>/share/<key>/photos/<id>` (or `/s/<slug>/…`). It creates nothing.
- **When logged in**, the button first asks for confirmation, then:
  1. It looks through `GET /api/shared-links` for a share it can reuse: one that shows only this video, allows downloads, has no password, and has at least a day left.
  2. If there isn't one, it creates one with `POST /api/shared-links`: `{ type: 'INDIVIDUAL', assetIds: [id], allowDownload: true, showMetadata: false }`, expiring in 7 days.
  3. It opens the generator at that share's URL for the video.
- **If creating the share fails** (no permission, an older server), a dialog explains how to make a share by hand and paste its link into the generator.
- The generator tab is opened within the click, before the share exists, and is pointed at the generator afterwards, so pop-up blockers allow it. Its `opener` is cleared, because a share-link opening doesn't use it.

## Consequences

- **The Immich server must allow the generator's origin with CORS**, on `206 Partial Content` responses too. Without that, the generator can't read the frames. The generator's README has the nginx setup.
- **A share link is published.** Anyone holding it can view and download the video until it expires or is deleted. Metadata such as location stays hidden (`showMetadata: false`). Reusing an existing share keeps repeat clicks from piling up links.
- **Nothing removes the links.** They expire after 7 days, and they can be deleted under *Sharing → Shared links*.
- On a share page that doesn't allow downloads, the generator streams Immich's lower-resolution playback version and says so.
