# PetVerse Backend

Bu qovluq PetVerse layihəsinin backend hissəsidir. Gemini API açarı artıq
frontend kodunda deyil, serverdə (`.env` faylında) gizli saxlanılır.
Frontend `/api/chat` endpoint-inə müraciət edir, backend isə Gemini API-yə
gedib cavabı geri qaytarır.

## Qovluq strukturu

```
petverse-backend/
├── server.js          ← Express server + Gemini proxy
├── package.json
├── .env.example       ← nümunə, kopyalayıb .env adlandırın
├── .gitignore
└── public/
    └── index.html     ← frontend (backend bunu avtomatik göstərir)
```

## 1. Lokal işə salmaq

**Addım 1 — asılılıqları quraşdırın:**
```bash
cd petverse-backend
npm install
```

**Addım 2 — açarınızı əlavə edin:**
```bash
cp .env.example .env
```
Sonra `.env` faylını açıb `GEMINI_API_KEY` sətrinə Google AI Studio-dan
aldığınız açarı yazın (`AQ.Ab...` formatında).

**Addım 3 — serveri başladın:**
```bash
npm start
```

Brauzerdə açın: `http://localhost:3000`

Xəritə və AI Vet Advisor artıq eyni serverdən işləyəcək — açar heç yerdə
görünmür, Developer Tools → Network-də belə.

## 2. Render-ə yükləmək (pulsuz hosting)

1. Bu qovluğu bir GitHub repo-suna yükləyin (`.env` faylını **YÜKLƏMƏYİN** —
   `.gitignore` onu artıq filtrləyir, amma yenə diqqətli olun).
2. [render.com](https://render.com) hesabınıza daxil olun.
3. **New → Web Service** seçin, GitHub repo-nuzu bağlayın.
4. Ayarlar:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. **Environment** bölməsində əlavə edin:
   - Key: `GEMINI_API_KEY`
   - Value: sizin həqiqi açarınız
6. Deploy edin. Bir neçə dəqiqədən sonra Render sizə `https://sizin-adiniz.onrender.com`
   kimi bir URL verəcək — bax budur, saytınız artıq işləyir, açar isə tam gizlidir.

## 3. Railway-ə yükləmək (alternativ)

1. [railway.app](https://railway.app) hesabınıza daxil olun.
2. **New Project → Deploy from GitHub repo** seçin.
3. **Variables** bölməsində `GEMINI_API_KEY` dəyişənini əlavə edin.
4. Railway `npm install` və `npm start` əmrlərini avtomatik tanıyacaq.

## Vacib qeydlər

- **Açarı heç vaxt GitHub-a yükləməyin.** `.env` faylı `.gitignore`-dadır,
  amma yoxlayın ki, təsadüfən commit etməmisiniz.
- Əvvəlki söhbətdə paylaşdığınız açar (`AQ.Ab8RN6JPgZHBnDS8wHbunIKp2sX2KV9jK16Ssv3s1zexmoySjg`)
  artıq ictimai sayılır — **onu Google AI Studio-da ləğv edib yeni açar yaradın**.
- Backend-də sadə rate-limiting var (IP başına dəqiqədə 15 sorğu) — istəsəniz
  `server.js`-də `RATE_LIMIT_MAX` dəyərini dəyişə bilərsiniz.
