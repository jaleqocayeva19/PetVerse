const SYSTEM_PROMPT =
  "You are a professional veterinary assistant. Analyze the pet symptoms provided by the user, provide immediate emergency advice, estimate the urgency level, and specify which type of specialist veterinarian they should consult. Keep answers concise and helpful.";

const GEMINI_MODELS = ["gemini-3.6-flash", "gemini-1.5-flash"];

function geminiStreamUrl(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`;
}

function generationConfigFor(model) {
  const config = { temperature: 0.4, maxOutputTokens: 2048 };
  if (model.startsWith("gemini-3")) {
    config.thinkingConfig = { thinkingBudget: 0 };
  }
  return config;
}

const widget = document.getElementById("vet-widget");
const toggle = document.getElementById("vet-toggle");
const panel = document.getElementById("vet-panel");
const form = document.getElementById("vet-form");
const input = document.getElementById("vet-input");
const sendBtn = document.getElementById("vet-send");
const messagesEl = document.getElementById("vet-messages");
const apiKeyInput = document.getElementById("gemini-api-key");

const conversation = [];

apiKeyInput.value = localStorage.getItem("geminiApiKey") || "";
apiKeyInput.addEventListener("input", () => {
  localStorage.setItem("geminiApiKey", apiKeyInput.value.trim());
});

function setChatOpen(open) {
  widget.classList.toggle("is-open", open);
  panel.hidden = !open;
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute(
    "aria-label",
    open ? "Close AI Vet Advisor" : "Open AI Vet Advisor"
  );
  if (open) input.focus();
}

toggle.addEventListener("click", () => {
  setChatOpen(!widget.classList.contains("is-open"));
});

window.openVetAdvisor = () => setChatOpen(true);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text || sendBtn.disabled) return;

  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    appendMessage(
      "ai",
      "Add a Gemini API key from Google AI Studio above, then send your pet’s symptoms again.",
      true
    );
    return;
  }

  appendMessage("user", text);
  input.value = "";
  conversation.push({ role: "user", parts: [{ text }] });

  const loading = appendLoading();
  setBusy(true);

  try {
    const reply = await streamGeminiReply(apiKey, loading.body);
    conversation.push({ role: "model", parts: [{ text: reply }] });
  } catch (error) {
    loading.root.remove();
    appendMessage(
      "ai",
      error.message || "Something went wrong while contacting the AI.",
      true
    );
  } finally {
    setBusy(false);
  }
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

function appendMessage(role, text, isError = false) {
  const wrap = document.createElement("div");
  wrap.className = `vet-msg vet-msg-${role}${isError ? " vet-msg-error" : ""}`;

  const label = document.createElement("div");
  label.className = "vet-msg-label";
  label.textContent = role === "user" ? "You" : "AI Vet Advisor";

  const body = document.createElement("div");
  body.className = "vet-msg-body";
  body.textContent = text;

  wrap.append(label, body);
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return { root: wrap, body };
}

function appendLoading() {
  const wrap = document.createElement("div");
  wrap.className = "vet-msg vet-msg-ai";

  const label = document.createElement("div");
  label.className = "vet-msg-label";
  label.textContent = "AI Vet Advisor";

  const body = document.createElement("div");
  body.className = "vet-msg-body";

  const loading = document.createElement("div");
  loading.className = "vet-loading";
  loading.innerHTML =
    '<span class="vet-spinner" aria-hidden="true"></span><span>Analyzing symptoms…</span>';
  body.appendChild(loading);

  wrap.append(label, body);
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return { root: wrap, body };
}

function setBusy(busy) {
  sendBtn.disabled = busy;
  input.disabled = busy;
}

async function streamGeminiReply(apiKey, bodyEl) {
  let lastError = "Gemini request failed.";

  for (const model of GEMINI_MODELS) {
    const response = await fetch(
      `${geminiStreamUrl(model)}?alt=sse&key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: conversation,
          generationConfig: generationConfigFor(model),
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      lastError = parseGeminiError(errText, response.status);
      const canFallback =
        model !== GEMINI_MODELS[GEMINI_MODELS.length - 1] &&
        (response.status === 400 || response.status === 404);
      if (canFallback) continue;
      throw new Error(lastError);
    }

    const full = await readGeminiStream(response, bodyEl);
    if (full.trim()) return full;
    lastError = "The model returned an empty reply. Try again.";
  }

  throw new Error(lastError);
}

async function readGeminiStream(response, bodyEl) {
  let full = "";
  let started = false;

  const showPiece = (piece) => {
    if (!piece) return;
    if (!started) {
      bodyEl.textContent = "";
      started = true;
    }
    full += piece;
    bodyEl.textContent = full;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  if (!response.body || !response.body.getReader) {
    const data = await response.json();
    showPiece(extractText(data));
    return full;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      showPiece(parseSseLine(line));
    }
  }

  showPiece(parseSseLine(buffer.trim()));
  return full;
}

function parseSseLine(line) {
  if (!line) return "";
  let payload = line;
  if (line.startsWith("data:")) payload = line.slice(5).trim();
  if (!payload || payload === "[DONE]") return "";
  try {
    return extractText(JSON.parse(payload));
  } catch {
    return "";
  }
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts
    .filter((part) => !part.thought)
    .map((part) => part.text || "")
    .join("");
}

function parseGeminiError(raw, status) {
  try {
    const json = JSON.parse(raw);
    const msg = json.error?.message;
    if (msg) return msg;
  } catch {
    /* fall through */
  }
  if (status === 404) {
    return "That Gemini model is not available on this API key. Try gemini-1.5-flash in Google AI Studio.";
  }
  if (status === 400 || status === 403) {
    return "The API key looks invalid or is missing Gemini access. Check it in Google AI Studio.";
  }
  return `Gemini request failed (${status}).`;
}
