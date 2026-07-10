# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development (Windows — TLS workaround required on this machine)
```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED=0; $env:NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1; npx next dev
```
Standard `npm run dev` also works but may fail on certificate interception. Both env vars are required for every dev/build/typecheck on this machine due to local TLS interception.

### Build & Lint
```bash
npm run build
npm run lint
```

### Deploy to production
```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED=0; $env:NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1; npx firebase deploy --only hosting,firestore
```
Always include `firestore` in the deploy target — `firestore.rules` is now version-controlled and must be deployed alongside hosting changes.

**There is no test suite.** No `test` script exists in `package.json`.

---

## Architecture

### Stack
- **Next.js 16 App Router**, TypeScript, Tailwind CSS — deployed as SSR on **Cloud Run** via Firebase Hosting "web frameworks" preview
- **Firebase Auth** — session cookies (`__session`, 5-day expiry) issued server-side via `admin.auth().createSessionCookie()`
- **Firestore** — all structured data (equipment, incidents, documents, chat sessions, analytics). Accessed exclusively through the Firebase Admin SDK on the server; direct client SDK access is denied by `firestore.rules`
- **Firebase Storage** — user-uploaded files (equipment images, PDFs, documents)
- **Gemini 2.5 Flash** (`@google/genai`) — chat reasoning and function-call incident creation
- **`gemini-embedding-001`** — 3072-dim embeddings, truncated to 1536 before storage/query
- **Upstash Vector** — semantic cache for repeated questions per equipment (namespace = `equipmentId`)

### Request path
```
Browser → Firebase CDN (static pages, bypasses middleware) 
       OR → Cloud Run → Next.js middleware (proxy.ts) → API Routes
```
All API routes live under `src/app/api/`. Every route calls `requireAuth(req)` first — this is the real security boundary. The middleware in `src/proxy.ts` is a **UX-only redirect** (no signature verification, bypassed by CDN for static pages).

### Key library files
| File | Purpose |
|---|---|
| `src/lib/auth.ts` | `requireAuth(req)` — verifies `__session` cookie via Admin SDK. Used by every API route. |
| `src/lib/firebase-admin.ts` | `initAdmin()`, `getDb()`, `getStorageBucket()` — singleton Admin SDK init. Marked `server-only`. |
| `src/lib/firebase.ts` | Client-side Firebase SDK (auth only — `db` export exists but Firestore rules deny direct client access). |
| `src/lib/gemini.ts` | `getGeminiModel()` for chat, `getEmbedding()` for embeddings, `chunkText()` for RAG chunking. |
| `src/lib/rate-limit.ts` | In-memory rate limiter. **Process-local** — does not survive Cloud Run scale-out. Keys are `endpoint:uid`. |
| `src/lib/semantic-cache.ts` | Upstash Vector read/write/invalidate. Embeddings truncated 3072→1536 to match index dims. |

### RAG pipeline
1. PDF/text upload → `src/app/api/upload/route.ts` → `extractTextFromPdf()` → `chunkText()` (1500-char chunks, 200 overlap) → `getEmbedding()` per chunk → Firestore `equipment_doc_chunks` (batched in groups of 20, 200ms delay between calls to avoid rate limits)
2. Chat → embed query → check Upstash semantic cache (threshold 0.92) → if miss, cosine-score all chunks for the `equipmentId` in memory → top-5 chunks as context → Gemini stream
3. On upload, `invalidateEquipmentCache(equipmentId)` resets the Upstash namespace

### Ownership & security model
- Records written by API routes include `createdBy: auth.uid`
- Mutation routes (PUT/DELETE) check `if (doc.createdBy && doc.createdBy !== auth.uid) return 403` — legacy records without `createdBy` are allowed through for backward compatibility
- `equipmentId` is validated as `^[a-zA-Z0-9_-]{1,128}$` before interpolation into Gemini system prompts (prompt injection guard)
- Analytics `recent` feed is filtered to `userId === auth.uid` only

### Known platform quirk
Firebase Hosting's Next.js integration serves prerendered pages from the Fastly CDN, **bypassing `src/proxy.ts` entirely**. Pages with `X-Nextjs-Prerender: 1` in the response come from CDN. The client-side `onAuthStateChanged` guard in dashboard and chat pages is the real fallback for those routes. API routes always run through Cloud Run and are correctly protected.

### Ignored sub-app
`equiptalk.ai---tbmn/` is a standalone Vite prototype with live audio (Gemini Live API). It is **not part of the main deployment** and has its own `package.json`. Do not modify it when working on the main Next.js app.

---

## Environment variables required

| Variable | Used by |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Admin SDK (base64 or raw JSON) |
| `NEXT_PUBLIC_FIREBASE_*` | Client SDK + Admin SDK project ID fallback |
| `GEMINI_API_KEY` | `src/lib/gemini.ts` |
| `UPSTASH_VECTOR_REST_URL` | `src/lib/semantic-cache.ts` |
| `UPSTASH_VECTOR_REST_TOKEN` | `src/lib/semantic-cache.ts` |
| `GOOGLE_CLOUD_PROJECT_ID` | Admin SDK (optional override) |
