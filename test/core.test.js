import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLocation, apiQuery, isPanorama, downloadCandidates, handoffUrl, DEFAULT_GENERATOR_URL,
} from '../src/core.js';

const ID = '0f1e2d3c-4b5a-6978-8a9b-cdef01234567';

test('parseLocation: timeline photo', () => {
  assert.deepEqual(parseLocation(`/photos/${ID}`), { assetId: ID, share: null });
});

test('parseLocation: photo inside an album', () => {
  assert.deepEqual(parseLocation(`/albums/abc/photos/${ID}`), { assetId: ID, share: null });
});

test('parseLocation: photo on a key share page', () => {
  assert.deepEqual(parseLocation(`/share/k3y_-X/photos/${ID}`), { assetId: ID, share: { key: 'k3y_-X' } });
});

test('parseLocation: photo on a slug share page', () => {
  assert.deepEqual(parseLocation(`/s/my-trip/photos/${ID}`), { assetId: ID, share: { slug: 'my-trip' } });
});

test('parseLocation: share page with no asset id', () => {
  assert.deepEqual(parseLocation('/share/k3y'), { assetId: null, share: { key: 'k3y' } });
  assert.deepEqual(parseLocation('/s/my-trip/'), { assetId: null, share: { slug: 'my-trip' } });
});

test('parseLocation: pages that are not a photo return null', () => {
  assert.equal(parseLocation('/photos'), null);
  assert.equal(parseLocation('/albums/abc'), null);
  assert.equal(parseLocation('/photos/not-a-uuid'), null);
});

test('apiQuery: share key, slug, or nothing', () => {
  assert.equal(apiQuery({ key: 'a b' }), '?key=a%20b');
  assert.equal(apiQuery({ slug: 'trip' }), '?slug=trip');
  assert.equal(apiQuery(null), '');
});

test('isPanorama: equirectangular projection', () => {
  assert.equal(isPanorama({ type: 'IMAGE', exifInfo: { projectionType: 'EQUIRECTANGULAR' } }), true);
});

test('isPanorama: another known projection is not a panorama, even at 2:1', () => {
  assert.equal(isPanorama({ type: 'IMAGE', width: 4000, height: 2000, exifInfo: { projectionType: 'CUBEMAP' } }), false);
});

test('isPanorama: unknown projection falls back to exactly 2:1', () => {
  assert.equal(isPanorama({ type: 'IMAGE', width: 8000, height: 4000 }), true);
  assert.equal(isPanorama({ type: 'IMAGE', exifInfo: { exifImageWidth: 6000, exifImageHeight: 3000 } }), true);
  assert.equal(isPanorama({ type: 'IMAGE', width: 6000, height: 4000, exifInfo: {} }), false);
  assert.equal(isPanorama({ type: 'IMAGE' }), false);
});

test('isPanorama: videos are never panoramas', () => {
  assert.equal(isPanorama({ type: 'VIDEO', exifInfo: { projectionType: 'EQUIRECTANGULAR' } }), false);
});

test('downloadCandidates: browser-ready original first, then smaller copies', () => {
  const c = downloadCandidates({ id: ID, originalMimeType: 'image/jpeg', originalFileName: 'pano.jpg' }, { key: 'k' });
  assert.deepEqual(c, [
    { path: `/api/assets/${ID}/original?key=k`, name: 'pano.jpg', reduced: false },
    { path: `/api/assets/${ID}/thumbnail?key=k&size=fullsize`, name: 'pano.jpg', reduced: true },
    { path: `/api/assets/${ID}/thumbnail?key=k&size=preview`, name: 'pano.jpg', reduced: true },
  ]);
});

test('downloadCandidates: other formats skip the original and are named .jpg', () => {
  const c = downloadCandidates({ id: ID, originalMimeType: 'image/heic', originalFileName: 'IMG_1.HEIC' }, null);
  assert.deepEqual(c, [
    { path: `/api/assets/${ID}/thumbnail?size=fullsize`, name: 'IMG_1.jpg', reduced: false },
    { path: `/api/assets/${ID}/thumbnail?size=preview`, name: 'IMG_1.jpg', reduced: true },
  ]);
});

test('handoffUrl replaces any hash with #from-opener', () => {
  assert.equal(handoffUrl('https://x.test/web/'), 'https://x.test/web/#from-opener');
  assert.equal(handoffUrl('https://x.test/web/?a=1#old'), 'https://x.test/web/?a=1#from-opener');
});

test('default generator URL is the public generator', () => {
  assert.equal(DEFAULT_GENERATOR_URL, 'https://sphere.schrauger.com/web/');
});
