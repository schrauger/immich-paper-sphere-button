import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPanoramaVideo, isPanorama, reusableShareLink, newShareLinkBody, shareAssetUrl, streamUrl, findOrCreateShareLink,
  SHARE_LINK_DAYS,
} from '../src/core.js';

const ID = '0f1e2d3c-4b5a-6978-8a9b-cdef01234567';
const OTHER = '11111111-2222-3333-4444-555555555555';
const NOW = Date.parse('2026-11-15T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();

test('isPanoramaVideo: equirectangular video', () => {
  assert.equal(isPanoramaVideo({ type: 'VIDEO', exifInfo: { projectionType: 'EQUIRECTANGULAR' } }), true);
});

test('isPanoramaVideo: unknown projection falls back to exactly 2:1, like photos', () => {
  assert.equal(isPanoramaVideo({ type: 'VIDEO', width: 5760, height: 2880, exifInfo: { projectionType: null } }), true);
  assert.equal(isPanoramaVideo({ type: 'VIDEO', exifInfo: { exifImageWidth: 3840, exifImageHeight: 1920 } }), true);
  assert.equal(isPanoramaVideo({ type: 'VIDEO', width: 1920, height: 1080 }), false);
});

test('isPanoramaVideo: another projection, or a photo, is not a panorama video', () => {
  assert.equal(isPanoramaVideo({ type: 'VIDEO', width: 4000, height: 2000, exifInfo: { projectionType: 'CUBEMAP' } }), false);
  assert.equal(isPanoramaVideo({ type: 'IMAGE', exifInfo: { projectionType: 'EQUIRECTANGULAR' } }), false);
  assert.equal(isPanorama({ type: 'VIDEO', width: 5760, height: 2880 }), false);
});

const link = (over = {}) => ({
  key: 'k', type: 'INDIVIDUAL', allowDownload: true, password: null,
  expiresAt: iso(NOW + 5 * DAY), assets: [{ id: ID }], ...over,
});

test('reusableShareLink: an existing one-video, downloadable, unexpired share', () => {
  assert.equal(reusableShareLink([link({ key: 'a', assets: [{ id: OTHER }] }), link({ key: 'b' })], ID, NOW).key, 'b');
  assert.equal(reusableShareLink([link({ expiresAt: null })], ID, NOW).key, 'k');
});

test('reusableShareLink: skips shares that would not work, or would show more than this video', () => {
  const unusable = [
    link({ allowDownload: false }),
    link({ password: 'secret' }),
    link({ type: 'ALBUM' }),
    link({ assets: [{ id: ID }, { id: OTHER }] }),
    link({ expiresAt: iso(NOW - DAY) }),
    link({ expiresAt: iso(NOW + DAY / 2) }), // less than a day left
  ];
  for (const l of unusable) assert.equal(reusableShareLink([l], ID, NOW), undefined, JSON.stringify(l));
  assert.equal(reusableShareLink(null, ID, NOW), undefined);
});

test('newShareLinkBody: one downloadable video, expiring after SHARE_LINK_DAYS', () => {
  assert.equal(SHARE_LINK_DAYS, 7);
  assert.deepEqual(newShareLinkBody(ID, NOW), {
    type: 'INDIVIDUAL', assetIds: [ID], allowDownload: true, showMetadata: false, expiresAt: iso(NOW + 7 * DAY),
  });
});

test('shareAssetUrl: names the asset inside a key or slug share', () => {
  assert.equal(shareAssetUrl('https://im.test', { key: 'a/b' }, ID), `https://im.test/share/a%2Fb/photos/${ID}`);
  assert.equal(shareAssetUrl('https://im.test', { slug: 'trip' }, ID), `https://im.test/s/trip/photos/${ID}`);
});

test('streamUrl: the generator with ?url=, replacing any hash or earlier url', () => {
  const share = `https://im.test/share/k/photos/${ID}`;
  assert.equal(streamUrl('https://g.test/web/', share), `https://g.test/web/?url=${encodeURIComponent(share)}`);
  assert.equal(
    streamUrl('https://g.test/web/?a=1&url=old#from-opener', share),
    `https://g.test/web/?a=1&url=${encodeURIComponent(share)}`,
  );
});

const fakeApi = ({ list = [], listFails, createFails } = {}) => {
  const calls = [];
  return {
    calls,
    get: async (path) => { calls.push(['GET', path]); if (listFails) throw new Error('Immich returned 500'); return list; },
    post: async (path, body) => {
      calls.push(['POST', path, body]);
      if (createFails) throw new Error('Immich returned 403');
      return { key: 'new', ...body };
    },
  };
};

test('findOrCreateShareLink: reuses a matching share without creating one', async () => {
  const api = fakeApi({ list: [link({ key: 'old' })] });
  assert.equal((await findOrCreateShareLink({ api, assetId: ID, now: NOW })).key, 'old');
  assert.deepEqual(api.calls, [['GET', '/api/shared-links']]);
});

test('findOrCreateShareLink: creates one when none matches, or when listing fails', async () => {
  for (const api of [fakeApi({ list: [link({ allowDownload: false })] }), fakeApi({ listFails: true })]) {
    assert.equal((await findOrCreateShareLink({ api, assetId: ID, now: NOW })).key, 'new');
    assert.deepEqual(api.calls.at(-1), ['POST', '/api/shared-links', newShareLinkBody(ID, NOW)]);
  }
});

test('findOrCreateShareLink: a failed create rejects with the error', async () => {
  await assert.rejects(findOrCreateShareLink({ api: fakeApi({ createFails: true }), assetId: ID, now: NOW }), /403/);
});

test('findOrCreateShareLink: a create response without a key rejects', async () => {
  const api = { get: async () => [], post: async () => ({}) };
  await assert.rejects(findOrCreateShareLink({ api, assetId: ID, now: NOW }), /no share key/);
});
