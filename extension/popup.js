const fields = ["ativo", "backendUrl", "apiToken", "pollIntervalMs", "captionSelectorOverride"];

function load() {
  chrome.storage.local.get(fields, (settings) => {
    document.getElementById("ativo").checked = settings.ativo ?? true;
    document.getElementById("backendUrl").value = settings.backendUrl ?? "http://localhost:3000";
    document.getElementById("apiToken").value = settings.apiToken ?? "";
    document.getElementById("pollIntervalMs").value = settings.pollIntervalMs ?? 2500;
    document.getElementById("captionSelectorOverride").value = settings.captionSelectorOverride ?? "";
  });
}

function save() {
  chrome.storage.local.set(
    {
      ativo: document.getElementById("ativo").checked,
      backendUrl: document.getElementById("backendUrl").value.trim(),
      apiToken: document.getElementById("apiToken").value.trim(),
      pollIntervalMs: Number(document.getElementById("pollIntervalMs").value) || 2500,
      captionSelectorOverride: document.getElementById("captionSelectorOverride").value.trim(),
    },
    () => window.close()
  );
}

document.addEventListener("DOMContentLoaded", load);
document.getElementById("salvar").addEventListener("click", save);
