# Dictation (Speech-to-Text) for the Chat Window — Feature Scope

**Status:** Phases 1–3 implemented (2026-07-20) · **Owner:** TBD · **Created:** 2026-07-20
**Provider:** Google DeepMind — Gemini API (`@google/genai` v2.8.0, already a dependency)

> Scoping document only. No code has been written. Scope is **dictation only** —
> the user speaks, we transcribe to text, the text lands in the existing chat
> input, and they send it the normal way. Live two-way voice chat is explicitly
> **deferred** (see §9). Open choices are flagged **[DECISION NEEDED]**.

---

## 1. Goal

Let a technician — hands dirty or occupied on the shop floor — ask a question by
speaking instead of typing. Dictation is deliberately narrow: it produces **text
in the input box**, nothing more. Everything downstream (the `/api/chat` RAG
pipeline, streaming answer, history, feedback) stays exactly as it is today.

**User flow:**
1. Tap the mic button in the chat input bar.
2. Speak the question. Button shows a recording/listening state.
3. Stop (tap again, or auto-stop on silence).
4. Transcribed text appears in the input box.
5. User reviews/edits, then hits Send as usual.

This is low-risk: it adds *in front of* the existing flow and changes nothing
behind it.

---

## 2. Where this lives in the current code

Two chat surfaces exist; both use the same input-bar pattern and both POST to
`src/app/api/chat/route.ts`.

- **`src/app/chat/page.tsx`** — standalone full-screen chat (`/chat?equipment=<id>`).
  Input state is `input` / `setInput`, an `<input>` with `inputRef`, send via
  `handleSend()`. **Recommended primary (and only) target for v1** — most-used,
  most input-bar room.
- `src/components/chat/EquipmentChat.tsx` — embedded dashboard chat card. Same
  pattern (`input`/`setInput`). Secondary; add after `/chat` is proven.

Dictation plugs in by writing the transcript into `setInput(...)` and focusing
the field — **it never calls `/api/chat` itself.** The user still presses Send.

Backend facts that apply to the new route:
- Every API route calls `requireAuth(req)` (verifies the `__session` cookie).
- Rate limiting via `src/lib/rate-limit.ts` — `checkRateLimit(key, true, opts)`,
  Upstash-backed, `async`, keys like `endpoint:uid`.
- **60s Cloud Run request cap.** Dictation clips are seconds long, so this is a
  non-issue *as long as we cap clip length* (see §5).

---

## 3. Recommended approach

**Gemini server-side transcription (recommended).** Record a short audio clip in
the browser with `MediaRecorder`, POST it to a new `POST /api/transcribe` route,
which sends the audio to Gemini and returns plain transcript text. The client
drops that text into the input box.

- ✅ One vendor, consistent with the rest of the stack; satisfies the "use Google
  DeepMind" requirement directly.
- ✅ API key stays server-side (route runs on Cloud Run behind `requireAuth`).
- ✅ Works in any browser with `MediaRecorder` (all current evergreen browsers).
- ✅ Short clips finish well under the 60s cap.
- ⚠️ Not live — user speaks, pauses, *then* sees text. Perfectly fine for
  dictation (this is Otter/voice-memo behavior, not a live caption).
- ⚠️ Per-request audio cost — bounded by rate limits + clip-length cap.

**Alternative considered — Web Speech API (`SpeechRecognition`), client-only:**
free and gives live interim text, but browser support is uneven, it isn't a
Gemini/DeepMind surface, and on Chrome it routes audio to Google anyway. **Not
recommended** for v1; could be added later as an optional live fast-path.

### Transcription call shape (Gemini)

`@google/genai` `ai.models.generateContent` accepts an inline audio part
(base64) alongside a short instruction like *"Transcribe this audio verbatim.
Return only the transcript, no commentary."*
- **[DECISION NEEDED]** Model: a current Gemini Flash model that accepts audio
  input (align with the chat model family). Confirm the exact model id accepts
  inline audio on our tier during the Phase-0 spike.
- Inline base64 is fine for short clips; no need for the Files API at ≤~30s.

---

## 4. New backend: `POST /api/transcribe`

- **Auth:** `requireAuth(req)` first (same as every data route).
- **Rate limit:** `checkRateLimit(\`transcribe:${uid}\`, true, {...})` — suggest
  a tighter budget than chat, e.g. **20 / 15 min** per user, to bound audio cost.
  **[DECISION NEEDED]** exact numbers.
- **Input:** `multipart/form-data` (or JSON with base64) carrying one audio blob.
- **Server-side validation (mirror the upload route's defensive posture):**
  - Allowed audio MIME types + a **max size cap** (reject anything large; ties to
    the clip-length cap so a request can't approach the 60s timeout).
  - Reject empty/oversized payloads with `400`.
- **Processing:** call Gemini with the audio part → extract transcript text.
- **Output:** `{ text: string }`. On model error, return a friendly `502/500`;
  the client keeps the user's ability to type normally.
- **Privacy:** **do not persist the audio or the transcript** server-side. The
  clip is transcribed and discarded; the text only lives in the client input
  until the user sends it (then it's a normal chat message). Note this in the
  route comments.

### Testability
Extract pure helpers into `src/lib/` so they run under the project's Node
built-in test runner (per CLAUDE.md conventions — explicit `.ts` import
extensions, `tests/` excluded from tsconfig):
- audio MIME/size validation (mirror `upload-validation.ts` style),
- transcript cleanup (trim, strip any stray model preamble).
Keep the heavy Gemini call and `MediaRecorder` out of the unit tests.

---

## 5. Browser capture

- **Permissions:** first tap triggers the mic prompt via `getUserMedia({audio})`.
  Handle denied/blocked with a clear inline message + how to re-enable. Requires
  a secure context — prod HTTPS and `localhost` both qualify.
- **Recording:** `MediaRecorder` → collect chunks → `Blob` on stop.
- **Clip-length cap:** hard stop at **~30s** (configurable) so payloads stay
  small and requests stay far under the 60s cap. Show a subtle countdown/limit.
- **Auto-stop on silence [DECISION NEEDED]:** nice-to-have (simple VAD on the
  audio level) vs. manual tap-to-stop only for v1. Recommend **manual v1**,
  silence-detection later.
- **Cleanup:** always stop tracks and release the mic when done or on unmount.

---

## 6. UX / UI (input bar only)

Add a **mic button** beside the existing send button in `page.tsx`'s input bar.

- States: **idle** → **recording** (pulsing/red, shows it's live) →
  **transcribing** (spinner) → text populates input, focus returns to the field.
- Tap while recording = stop & transcribe. A cancel affordance (e.g. Esc or a
  small ✕) discards without transcribing.
- Transcript **fills the input for review** — it is *not* auto-sent, so the user
  can fix mishears before sending.
- **Accessibility:** button is keyboard-reachable and ARIA-labelled
  ("Dictate a question"); announce state changes. Dictation is **additive** —
  typing always works and is never gated behind voice.
- **Theming:** match existing light/dark (`ThemeProvider`) and the current
  `rounded-full` input / circular-button styling.
- **[DECISION NEEDED]** Locale: default `en-US` only for v1, or multi-locale?

---

## 7. Security & privacy checklist

- [ ] `/api/transcribe` behind `requireAuth` + rate limit.
- [ ] Audio MIME allowlist + max-size cap enforced server-side.
- [ ] Gemini API key never sent to the client (route is server-side).
- [ ] No persistence of audio or transcript (transcribe-and-discard).
- [ ] Brief first-use note that speech is sent to Google for transcription.
      **[DECISION NEEDED]** wording/placement.
- [ ] Windows/TLS dev quirk: `NODE_TLS_REJECT_UNAUTHORIZED=0` +
      `NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1` for every build/deploy.

---

## 8. Phased plan (dictation only)

**Phase 0 — Spike (small):** confirm the chosen Gemini model accepts inline audio
on our key/tier and returns clean transcripts for a 10–30s clip.

**Phase 1 — Backend:** `POST /api/transcribe` (auth, rate limit, validation,
Gemini call, `{text}` response). Pure validation/cleanup helpers + unit tests.

**Phase 2 — Frontend on `/chat`:** mic button + `MediaRecorder` capture +
permission handling + wiring transcript into `setInput`. States/UX per §6.

**Phase 3 — Roll to dashboard:** add the same control to
`EquipmentChat.tsx` once proven on `/chat`.

---

## 9. Open decisions (consolidated)

1. Exact Gemini model id for audio transcription (confirm in Phase 0).
2. Rate limit numbers for `/api/transcribe` (suggest 20 / 15 min/user).
3. Clip-length cap (suggest ~30s) and auto-stop-on-silence (suggest defer).
4. Locale: `en-US` only, or multi-locale?
5. First-use privacy notice wording/placement.

---

## 10. Explicitly out of scope (this iteration)

- **Live two-way voice chat** (Gemini Live API, spoken responses) — deferred.
- Web Speech API live-interim path.
- Dictation on the public QR chat page (`/p/[linkId]`) — different auth model.
- Wake-word / always-listening, auto-send, multi-locale, offline/on-device STT.
