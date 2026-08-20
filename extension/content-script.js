// Content script: roda dentro da aba do Google Meet.
// 1. Lê as legendas ao vivo do DOM
// 2. Junta num buffer de transcript
// 3. A cada POLL_INTERVAL_MS, manda o buffer pro backend e mostra a sugestão no overlay
// 4. Ao sair da call, manda o transcript final pro backend salvar (via Trigger.dev)

// IMPORTANTE: o Google muda a estrutura do DOM do Meet de tempos em tempos. Se as legendas
// pararem de ser capturadas, inspecione a página (com as legendas ligadas) e ajuste
// CAPTION_SELECTOR_CANDIDATES abaixo.
const CAPTION_SELECTOR_CANDIDATES = [
  '[jsname="tgaKEf"]', // texto de cada linha de legenda (candidato mais comum em versões recentes)
  ".iOzk7", // container do painel de legendas (fallback)
  '[aria-live="polite"] span', // fallback genérico por acessibilidade
];

const DEFAULT_POLL_INTERVAL_MS = 2500;
const MAX_BUFFER_CHARS = 4000; // janela de transcript enviada ao backend

let transcriptBuffer = "";
let fullTranscript = "";
let lastSeenCaption = "";
let lastSentLength = 0; // evita rechamar a API quando nada de novo foi dito desde o último envio
let pollTimer = null;
let overlayEl = null;

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      {
        ativo: true,
        backendUrl: "http://localhost:3000",
        apiToken: "",
        pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
        captionSelectorOverride: "",
      },
      resolve
    );
  });
}

function findCaptionNodes(selectorOverride) {
  const selectors = selectorOverride
    ? [selectorOverride, ...CAPTION_SELECTOR_CANDIDATES]
    : CAPTION_SELECTOR_CANDIDATES;
  for (const selector of selectors) {
    const nodes = document.querySelectorAll(selector);
    if (nodes.length > 0) return nodes;
  }
  return [];
}

function createOverlay() {
  if (overlayEl) return overlayEl;

  overlayEl = document.createElement("div");
  overlayEl.id = "copiloto-overlay";
  overlayEl.innerHTML = `
    <div id="copiloto-header">
      <span id="copiloto-fase">copiloto</span>
      <span id="copiloto-drag-handle" title="arraste para mover">⠿</span>
    </div>
    <div id="copiloto-sugestao">Aguardando a conversa começar…</div>
    <div id="copiloto-sinal"></div>
  `;
  document.body.appendChild(overlayEl);
  makeDraggable(overlayEl, overlayEl.querySelector("#copiloto-drag-handle"));
  return overlayEl;
}

function makeDraggable(el, handle) {
  let offsetX = 0;
  let offsetY = 0;
  let dragging = false;

  handle.addEventListener("mousedown", (e) => {
    dragging = true;
    offsetX = e.clientX - el.offsetLeft;
    offsetY = e.clientY - el.offsetTop;
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    el.style.left = `${e.clientX - offsetX}px`;
    el.style.top = `${e.clientY - offsetY}px`;
    el.style.right = "auto";
  });

  document.addEventListener("mouseup", () => {
    dragging = false;
  });
}

function updateOverlay({ fase, sinal_detectado, sugestao }) {
  if (!overlayEl) return;
  overlayEl.querySelector("#copiloto-fase").textContent = fase || "copiloto";
  overlayEl.querySelector("#copiloto-sugestao").textContent = sugestao || "";
  overlayEl.querySelector("#copiloto-sinal").textContent = sinal_detectado || "";
}

function captureNewCaptions(selectorOverride) {
  const nodes = findCaptionNodes(selectorOverride);
  if (nodes.length === 0) return;

  const currentText = Array.from(nodes)
    .map((n) => n.textContent?.trim())
    .filter(Boolean)
    .join(" ");

  if (!currentText || currentText === lastSeenCaption) return;

  // As legendas do Meet re-renderizam a frase inteira enquanto a pessoa fala;
  // só acrescentamos ao buffer o texto realmente novo, evitando duplicar.
  const newPart = currentText.startsWith(lastSeenCaption)
    ? currentText.slice(lastSeenCaption.length)
    : ` ${currentText}`;

  transcriptBuffer += newPart;
  fullTranscript += newPart;
  lastSeenCaption = currentText;

  if (transcriptBuffer.length > MAX_BUFFER_CHARS) {
    transcriptBuffer = transcriptBuffer.slice(-MAX_BUFFER_CHARS);
  }
}

async function pollAndSuggest() {
  const settings = await getSettings();
  if (!settings.ativo) return;

  captureNewCaptions(settings.captionSelectorOverride);
  if (!transcriptBuffer.trim()) return;

  // Nada novo desde o último envio bem-sucedido — não vale a pena chamar a API de novo
  // (evita queimar crédito durante silêncios/pausas da call).
  if (transcriptBuffer.length === lastSentLength) return;

  console.log(`[copiloto] chamando /api/suggest — ${transcriptBuffer.length} chars`);

  try {
    const res = await fetch(`${settings.backendUrl}/api/suggest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiToken}`,
      },
      body: JSON.stringify({ transcriptWindow: transcriptBuffer }),
    });
    if (!res.ok) {
      console.warn("[copiloto] backend respondeu", res.status);
      return;
    }
    const suggestion = await res.json();
    lastSentLength = transcriptBuffer.length;
    updateOverlay(suggestion);
  } catch (err) {
    console.warn("[copiloto] falha ao buscar sugestão", err);
  }
}

function sendCallEnded(settings) {
  if (!fullTranscript.trim()) return;
  // sendBeacon não permite headers customizados, então o token vai como query param.
  const url = `${settings.backendUrl}/api/call-ended?token=${encodeURIComponent(settings.apiToken)}`;
  const payload = JSON.stringify({ transcript: fullTranscript, endedAt: new Date().toISOString() });
  navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
}

async function init() {
  const settings = await getSettings();
  if (!settings.ativo) return;

  createOverlay();
  pollTimer = setInterval(pollAndSuggest, settings.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS);

  window.addEventListener("pagehide", () => sendCallEnded(settings));
}

init();
