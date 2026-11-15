import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGeneratorUrl, immichOrigin, DEFAULT_GENERATOR_URL } from '../src/core.js';

test('normalizeGeneratorUrl: blank means the default', () => {
  assert.equal(normalizeGeneratorUrl('  '), DEFAULT_GENERATOR_URL);
});

test('normalizeGeneratorUrl: keeps a valid http(s) URL, trimmed', () => {
  assert.equal(normalizeGeneratorUrl(' http://localhost:8080/web/ '), 'http://localhost:8080/web/');
});

test('normalizeGeneratorUrl: rejects non-URLs and other schemes', () => {
  assert.equal(normalizeGeneratorUrl('sphere.example'), null);
  assert.equal(normalizeGeneratorUrl('javascript:alert(1)'), null);
});

test('immichOrigin: reduces any Immich address to its origin', () => {
  assert.equal(immichOrigin('https://photos.example.org/photos/abc'), 'https://photos.example.org');
  assert.equal(immichOrigin('http://192.168.1.5:2283'), 'http://192.168.1.5:2283');
});

test('immichOrigin: rejects blanks, non-URLs and other schemes', () => {
  assert.equal(immichOrigin(''), null);
  assert.equal(immichOrigin('photos.example.org'), null);
  assert.equal(immichOrigin('ftp://photos.example.org'), null);
});
