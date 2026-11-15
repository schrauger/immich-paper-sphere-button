// Userscript settings: the generator URL lives in the userscript manager's storage.
// The Immich host is the @match line (or a user match added in the manager).
function getGeneratorUrl() {
  return Promise.resolve(GM_getValue('generatorUrl', DEFAULT_GENERATOR_URL));
}

GM_registerMenuCommand('Set sphere generator URL…', () => {
  const typed = prompt(
    `Paper sphere generator URL (leave blank for ${DEFAULT_GENERATOR_URL})`,
    GM_getValue('generatorUrl', DEFAULT_GENERATOR_URL),
  );
  if (typed === null) return;
  const url = normalizeGeneratorUrl(typed);
  if (!url) {
    alert('That isn’t an http(s) address. The generator URL was not changed.');
    return;
  }
  GM_setValue('generatorUrl', url);
  refreshGeneratorUrl();
});
