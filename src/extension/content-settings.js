// Extension settings for the content script: the generator URL from the options page.
function getGeneratorUrl() {
  const api = globalThis.browser ?? chrome;
  return api.storage.sync.get('generatorUrl').then((s) => s.generatorUrl);
}
