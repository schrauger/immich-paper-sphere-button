import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHandoff, isReadyMessage } from '../src/core.js';

const fakeWin = () => ({ closed: false, close() { this.closed = true; } });
const never = () => new Promise(() => {});
const blob = { size: 1 };
const cands = [
  { path: '/orig', name: 'p.jpg', reduced: false },
  { path: '/full', name: 'p.jpg', reduced: true },
];

test('sends the first candidate that downloads once the generator is ready', async () => {
  const win = fakeWin();
  const sent = [];
  const res = await runHandoff({
    win, candidates: cands,
    fetchBlob: async (p) => { if (p === '/orig') throw new Error('403'); return blob; },
    ready: Promise.resolve(), timeout: never(),
    post: (m) => sent.push(m),
  });
  assert.deepEqual(sent, [{ type: 'paper-sphere-image', name: 'p.jpg', blob }]);
  assert.deepEqual(res, { reduced: true });
  assert.equal(win.closed, false);
});

test('closes the generator tab and rethrows when every download fails', async () => {
  const win = fakeWin();
  await assert.rejects(runHandoff({
    win, candidates: cands,
    fetchBlob: async () => { throw new Error('Download failed (500)'); },
    ready: never(), timeout: never(), post: () => assert.fail('posted'),
  }), /Download failed \(500\)/);
  assert.equal(win.closed, true);
});

test('gives up with a hint when the generator never says ready, leaving the tab open', async () => {
  const win = fakeWin();
  await assert.rejects(runHandoff({
    win, candidates: cands, fetchBlob: async () => blob,
    ready: never(), timeout: Promise.resolve(), post: () => assert.fail('posted'),
  }), /Generator didn't respond/);
  assert.equal(win.closed, false);
});

test('isReadyMessage accepts only the opened window at the generator origin', () => {
  const win = {};
  const ok = { source: win, origin: 'https://g.test', data: { type: 'paper-sphere-ready' } };
  assert.equal(isReadyMessage(ok, win, 'https://g.test'), true);
  assert.equal(isReadyMessage({ ...ok, source: {} }, win, 'https://g.test'), false);
  assert.equal(isReadyMessage({ ...ok, origin: 'https://evil.test' }, win, 'https://g.test'), false);
  assert.equal(isReadyMessage({ ...ok, data: { type: 'other' } }, win, 'https://g.test'), false);
  assert.equal(isReadyMessage({ ...ok, data: null }, win, 'https://g.test'), false);
});
