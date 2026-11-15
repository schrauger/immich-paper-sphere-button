// Options page. build.mjs inlines core.js above this.
const api = globalThis.browser ?? chrome;
const $ = (id) => document.getElementById(id);

function say(text, isError = false) {
  $('status').textContent = text;
  $('status').className = isError ? 'error' : '';
}

api.storage.sync.get(['immichHost', 'generatorUrl']).then((s) => {
  $('immichHost').value = s.immichHost || '';
  $('generatorUrl').value = s.generatorUrl || '';
  $('generatorUrl').placeholder = DEFAULT_GENERATOR_URL;
});

$('save').addEventListener('click', async () => {
  const host = immichOrigin($('immichHost').value);
  if (!host) return say('Enter the Immich host as an address starting with https:// or http://.', true);
  const generatorUrl = normalizeGeneratorUrl($('generatorUrl').value);
  if (!generatorUrl) return say('Enter the generator URL as an address starting with https:// or http://, or leave it blank.', true);

  // Must be the first await, so the browser still sees it as part of the click.
  const granted = await api.permissions.request({ origins: [host + '/*'] });
  if (!granted) return say(`The button can't run on ${host} without that permission.`, true);

  const { immichHost: previous } = await api.storage.sync.get('immichHost');
  if (previous && previous !== host) {
    await api.permissions.remove({ origins: [previous + '/*'] }).catch(() => {});
  }
  await api.storage.sync.set({ immichHost: host, generatorUrl });
  const reply = await api.runtime.sendMessage({ type: 'settings-changed' });
  if (reply?.error) return say(`Saved, but the button couldn't be set up: ${reply.error}`, true);
  $('immichHost').value = host;
  $('generatorUrl').value = generatorUrl === DEFAULT_GENERATOR_URL ? '' : generatorUrl;
  say(`Saved. Reload any open ${host} tabs to see the button.`);
});
