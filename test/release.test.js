import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkTag, unlistedManifest, updatesJson, assetNames, UPDATE_URL } from '../scripts/release.mjs';

const root = new URL('..', import.meta.url).pathname;
const run = promisify(execFile);

test('checkTag: the tag must be v + the package version', () => {
  checkTag('v0.2.0', '0.2.0');
  assert.throws(() => checkTag('v0.2.1', '0.2.0'), /expected v0\.2\.0/);
  assert.throws(() => checkTag('0.2.0', '0.2.0'), /expected v0\.2\.0/);
});

test('unlistedManifest: adds update_url without touching the original', () => {
  const m = { browser_specific_settings: { gecko: { id: 'x@y' } } };
  assert.equal(unlistedManifest(m).browser_specific_settings.gecko.update_url, UPDATE_URL);
  assert.equal(m.browser_specific_settings.gecko.update_url, undefined);
  assert.equal(UPDATE_URL, 'https://github.com/schrauger/immich-paper-sphere-button/releases/latest/download/updates.json');
});

test('updatesJson: points at this version\'s release asset', () => {
  assert.deepEqual(updatesJson('x@y', '1.2.3'), {
    addons: {
      'x@y': {
        updates: [{
          version: '1.2.3',
          update_link: 'https://github.com/schrauger/immich-paper-sphere-button/releases/download/v1.2.3/immich-paper-sphere-button-1.2.3-firefox.xpi',
        }],
      },
    },
  });
  assert.deepEqual(assetNames('1.2.3'), {
    chrome: 'immich-paper-sphere-button-1.2.3-chrome.zip',
    firefox: 'immich-paper-sphere-button-1.2.3-firefox.xpi',
  });
});

test('firefox-unlisted: copies extension/ with update_url, and writes updates.json', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'ipsb-rel-'));
  try {
    await run(process.execPath, [join(root, 'scripts/release.mjs'), 'firefox-unlisted', tmp]);
    assert.deepEqual((await readdir(join(tmp, 'firefox-src'))).sort(), (await readdir(join(root, 'extension'))).sort());
    const m = JSON.parse(await readFile(join(tmp, 'firefox-src/manifest.json'), 'utf8'));
    const orig = JSON.parse(await readFile(join(root, 'extension/manifest.json'), 'utf8'));
    assert.deepEqual(m, unlistedManifest(orig));
    const u = JSON.parse(await readFile(join(tmp, 'updates.json'), 'utf8'));
    assert.deepEqual(u, updatesJson(orig.browser_specific_settings.gecko.id, orig.version));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
