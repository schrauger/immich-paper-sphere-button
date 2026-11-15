# Immich Paper Sphere Button

A one-click way to send a panorama from Immich to the generator, which turns it into a printable paper sphere.

## Things

**Panorama**:
A full 360°×180° photo in equirectangular projection, with a 2:1 width-to-height ratio. Same meaning as in the generator's glossary.
_Avoid_: 360 photo, 360° photo, equirect, equirectangular photo, photosphere, image

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
The exchange that carries a panorama from the Immich tab to a newly opened generator tab, directly between the two tabs, with nothing stored or shared anywhere else.
_Avoid_: upload, share, transfer
