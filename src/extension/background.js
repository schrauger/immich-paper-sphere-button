// Registers the content script for the one Immich host the user has set and granted.
const api = globalThis.browser ?? chrome;
const SCRIPT_ID = 'immich-button';

async function sync() {
  const registered = await api.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (registered.length) await api.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  const { immichHost } = await api.storage.sync.get('immichHost');
  if (!immichHost) return;
  const origins = [immichHost + '/*'];
  if (!(await api.permissions.contains({ origins }))) return;
  await api.scripting.registerContentScripts([{
    id: SCRIPT_ID,
    matches: origins,
    js: ['content.js'],
    runAt: 'document_idle',
    persistAcrossSessions: true,
  }]);
}

api.runtime.onInstalled.addListener((details) => {
  sync();
  if (details.reason === 'install') api.runtime.openOptionsPage();
});
api.runtime.onStartup.addListener(sync);
api.permissions.onRemoved.addListener(sync);
api.action.onClicked.addListener(() => api.runtime.openOptionsPage());
api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'settings-changed') return;
  sync().then(() => sendResponse({ ok: true }), (e) => sendResponse({ error: String(e?.message || e) }));
  return true;
});
