import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import vm from 'node:vm';
import { build, OUTPUTS } from '../build.mjs';

const root = new URL('..', import.meta.url).pathname;

async function files(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await files(p));
    else out.push(p);
  }
  return out;
}

test('committed build outputs are up to date (run `npm run build`)', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'ipsb-'));
  try {
    await build(tmp);
    for (const f of await files(tmp)) {
      const rel = relative(tmp, f);
      const committed = await readFile(join(root, rel), 'utf8').catch(() => null);
      assert.equal(committed, await readFile(f, 'utf8'), `${rel} is stale`);
    }
    for (const out of OUTPUTS) {
      const built = await readdir(join(tmp, out)).catch(() => null);
      if (built) assert.deepEqual((await readdir(join(root, out))).sort(), built.sort(), `${out}/ has extra or missing files`);
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('extension manifest works in Chrome and Firefox and asks for no hosts up front', async () => {
  const m = JSON.parse(await readFile(join(root, 'extension/manifest.json'), 'utf8'));
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  assert.equal(m.manifest_version, 3);
  assert.equal(m.version, pkg.version);
  assert.deepEqual(m.permissions.sort(), ['scripting', 'storage']);
  assert.deepEqual(m.optional_host_permissions, ['*://*/*']);
  assert.equal(m.host_permissions, undefined);
  assert.equal(m.content_scripts, undefined);
  assert.equal(m.background.service_worker, 'background.js');
  assert.deepEqual(m.background.scripts, ['background.js']);
  assert.ok(m.browser_specific_settings.gecko.id);
  assert.equal(m.browser_specific_settings.gecko.strict_min_version, '140.0');
  assert.deepEqual(m.browser_specific_settings.gecko.data_collection_permissions, { required: ['none'] });
  assert.equal(m.browser_specific_settings.gecko.update_url, undefined, 'update_url is added only to the unlisted Firefox build');
  for (const f of [m.background.service_worker, m.options_ui.page]) {
    await readFile(join(root, 'extension', f));
  }
});

test('generated scripts compile and have no leftover exports', async () => {
  for (const f of ['immich-paper-sphere-button.user.js', 'extension/content.js']) {
    const src = await readFile(join(root, f), 'utf8');
    assert.doesNotMatch(src, /^\s*export /m, f);
    new vm.Script(src, { filename: f });
  }
});

test('userscript header matches a placeholder host and the published update URL', async () => {
  const src = await readFile(join(root, 'immich-paper-sphere-button.user.js'), 'utf8');
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  assert.match(src, /^\/\/ @match\s+https:\/\/immich\.example\.com\/\*$/m);
  assert.match(src, new RegExp(`^// @version\\s+${pkg.version.replace(/\./g, '\\.')}$`, 'm'));
  const raw = 'https://raw.githubusercontent.com/schrauger/immich-paper-sphere-button/main/immich-paper-sphere-button.user.js';
  assert.match(src, new RegExp(`^// @updateURL\\s+${raw}$`, 'm'));
  assert.match(src, new RegExp(`^// @downloadURL\\s+${raw}$`, 'm'));
});
