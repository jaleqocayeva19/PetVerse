// server.js
// PetVerse backend — Gemini API açarını gizli saxlayan proxy server.
// Frontend heç vaxt açarı görmür, yalnız bu backend-ə müraciət edir.

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// .env faylından oxunur — açar heç vaxt kodun içində yazılmır
const API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash-latest"];
const SYSTEM_PROMPT =
  "You are a professional veterinary assistant. Analyze the pet symptoms provided by the user, provide immediate emergency advice, estimate the urgency level, and specify which type of specialist veterinarian they should consult. Keep answers concise and helpful.";

if (!API_KEY) {
  console.error("XƏTA: GEMINI_API_KEY .env faylında tapılmadı. Server dayandırılır.");
  process.exit(1);
}

app.use(cors()); // İstəsəniz, aşağıda konkret domenlərlə məhdudlaşdıra bilərsiniz
app.use(express.json({ limit: "1mb" }));

// Statik frontend fayllarını göstərir (public/ qovluğu)
app.use(express.static(path.join(__dirname, "public")));

// --- Sadə rate limiting (sui-istifadəni azaltmaq üçün) ---
const requestLog = new Map(); // ip -> [timestamps]
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 dəqiqə
const RATE_LIMIT_MAX = 15; // dəqiqədə maksimum sorğu sayı (ip başına)

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || "").join("");
}

function geminiGenerateUrl(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(API_KEY)}`;
}

// --- Əsas endpoint: frontend bura müraciət edir ---
app.post("/api/chat", async (req, res) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Çox sayda sorğu göndərildi. Bir az sonra yenidən cəhd edin." });
  }

  const conversation = req.body?.conversation;
  if (!Array.isArray(conversation) || conversation.length === 0) {
    return res.status(400).json({ error: "conversation sahəsi tələb olunur (array)." });
  }

  // Yalnız gözlənilən strukturu qəbul et — əlavə sahələri süz
  const safeConversation = conversation
    .filter((m) => m && (m.role === "user" || m.role === "model") && Array.isArray(m.parts))
    .map((m) => ({
      role: m.role,
      parts: m.parts
        .filter((p) => typeof p?.text === "string")
        .map((p) => ({ text: p.text.slice(0, 4000) })), // hər mesaj üçün uzunluq limiti
    }));

  if (safeConversation.length === 0) {
    return res.status(400).json({ error: "Düzgün formatda mesaj tapılmadı." });
  }

  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: safeConversation,
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
  });

  let lastError = "Gemini sorğusu uğursuz oldu.";

  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const model = GEMINI_MODELS[i];
    try {
      const response = await fetch(geminiGenerateUrl(model), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });

      if (!response.ok) {
        const raw = await response.text();
        try {
          lastError = JSON.parse(raw).error?.message || lastError;
        } catch {
          lastError = `Gemini xətası (${response.status})`;
        }
        const canFallback = i < GEMINI_MODELS.length - 1 && (response.status === 400 || response.status === 404);
        if (canFallback) continue;
        return res.status(502).json({ error: lastError });
      }

      const data = await response.json();
      const text = extractText(data).trim();
      if (text) return res.json({ reply: text });
      lastError = "Model boş cavab qaytardı.";
    } catch (err) {
      lastError = err.message || lastError;
    }
  }

  return res.status(502).json({ error: lastError });
});

// Sağlamlıq yoxlaması (Render/Railway bunu istifadə edə bilər)
app.get("/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`PetVerse backend http://localhost:${PORT} ünvanında işləyir`);
});
