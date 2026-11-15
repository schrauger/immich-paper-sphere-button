// Release helpers for .github/workflows/release.yml.
//   node scripts/release.mjs check-tag <tag>       fail unless <tag> is v<package.json version>
//   node scripts/release.mjs firefox-unlisted <dir> write <dir>/firefox-src (extension/ plus an update_url)
//                                                   and <dir>/updates.json, for self-hosted signing
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const REPO = 'schrauger/immich-paper-sphere-button';
export const NAME = 'immich-paper-sphere-button';
// "latest" follows each new release, so installed copies find updates without a fixed address per version.
export const UPDATE_URL = `https://github.com/${REPO}/releases/latest/download/updates.json`;

export const assetNames = (version) => ({
  chrome: `${NAME}-${version}-chrome.zip`,
  firefox: `${NAME}-${version}-firefox.xpi`,
});

export function checkTag(tag, version) {
  if (tag !== `v${version}`) throw new Error(`Tag ${tag} doesn't match package.json version ${version} (expected v${version})`);
}

/**
 * The manifest for the self-hosted Firefox build. Only this copy gets update_url:
 * Mozilla refuses it in versions for its store (listed), which update through Mozilla instead.
 */
export function unlistedManifest(manifest, updateUrl = UPDATE_URL) {
  const m = structuredClone(manifest);
  m.browser_specific_settings.gecko.update_url = updateUrl;
  return m;
}

/** The update manifest Firefox fetches from update_url. */
export function updatesJson(id, version) {
  const link = `https://github.com/${REPO}/releases/download/v${version}/${assetNames(version).firefox}`;
  return { addons: { [id]: { updates: [{ version, update_link: link }] } } };
}

async function firefoxUnlisted(outDir) {
  const src = join(outDir, 'firefox-src');
  await rm(src, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await cp(join(ROOT, 'extension'), src, { recursive: true });
  const manifest = JSON.parse(await readFile(join(src, 'manifest.json'), 'utf8'));
  await writeFile(join(src, 'manifest.json'), JSON.stringify(unlistedManifest(manifest), null, 2) + '\n');
  const json = updatesJson(manifest.browser_specific_settings.gecko.id, manifest.version);
  await writeFile(join(outDir, 'updates.json'), JSON.stringify(json, null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, arg] = process.argv.slice(2);
  const { version } = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  if (command === 'check-tag') checkTag(arg, version);
  else if (command === 'firefox-unlisted') await firefoxUnlisted(resolve(arg));
  else if (command === 'names') console.log(JSON.stringify(assetNames(version)));
  else throw new Error(`Unknown command: ${command}`);
}
