// Service worker: só garante valores padrão na primeira instalação.
// A lógica de captura/overlay roda toda no content-script (extension/content-script.js).

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["ativo", "backendUrl", "pollIntervalMs"], (current) => {
    chrome.storage.local.set({
      ativo: current.ativo ?? true,
      backendUrl: current.backendUrl ?? "http://localhost:3000",
      apiToken: current.apiToken ?? "",
      pollIntervalMs: current.pollIntervalMs ?? 2500,
      captionSelectorOverride: current.captionSelectorOverride ?? "",
    });
  });
});
