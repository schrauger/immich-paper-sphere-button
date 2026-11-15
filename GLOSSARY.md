# Immich Paper Sphere Button

A one-click way to send a panorama from Immich to the generator, which turns it into a printable paper sphere.

## Things

**Panorama**:
A full 360°×180° photo in equirectangular projection, with a 2:1 width-to-height ratio. Same meaning as in the generator's glossary.
_Avoid_: 360 photo, 360° photo, equirect, equirectangular photo, photosphere, image

**Panorama video**:
A video whose frames are panoramas: Immich lists its projection as equirectangular, or, with no projection known, it is exactly 2:1.
_Avoid_: 360 video, 360° video, spherical video

**Share link**:
An Immich share link (`/share/<key>` or `/s/<slug>`). The button creates one only for a panorama video, after asking.
_Avoid_: public link, shared URL

**Generator**:
The paper-sphere web app that receives the panorama and lays it out as a printable sheet.
_Avoid_: web app, sphere site, sphere generator

**Button**:
The floating control shown on Immich while a panorama is being viewed, which starts a handoff.
_Avoid_: widget, toolbar button

## Settings

**Immich host**:
The address of the one Immich server the button runs on. Set by the user, never built in.
_Avoid_: Immich URL, server, instance

**Generator URL**:
The address of the generator the button opens. Defaults to the public generator.
_Avoid_: sphere URL, target

## Behaviour

**Handoff**:
The exchange that carries a panorama photo from the Immich tab to a newly opened generator tab, directly between the two tabs, with nothing stored or shared anywhere else.
_Avoid_: upload, share, transfer

**Share-link opening**:
Opening the generator at a share link of a panorama video, so that the generator streams the video itself. Used instead of a handoff because a whole video is too large to pass between tabs.
_Avoid_: video handoff, streaming handoff
