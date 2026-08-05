// Pure, dependency-free validation + cleanup for the dictation route.
//
// Kept out of `src/app/api/transcribe/route.ts` so it can be exercised by
// `tests/transcribe-validation.test.ts` under Node's built-in test runner
// without booting the Admin SDK or the Gemini client. Mirrors the defensive
// posture of `upload-validation.ts`.

/**
 * Max accepted audio payload, in bytes.
 *
 * This is the server-side backstop for the client's ~30s clip cap (see
 * DICTATION_MAX_CLIP_MS). The worst realistic case is uncompressed WAV at
 * 48kHz/16-bit mono — roughly 96KB/s, so 30s is ~2.9MB. 8MB leaves headroom for
 * stereo or a higher sample rate while still keeping a single request far under
 * the 60s Cloud Run cap and bounding per-request audio cost.
 */
export const MAX_AUDIO_SIZE = 8 * 1024 * 1024;

/**
 * Minimum plausible payload. Anything smaller is a mis-fire — the user tapped
 * the mic and released it before MediaRecorder produced a real frame. Rejecting
 * here avoids paying for a model call that can only return an empty transcript.
 */
export const MIN_AUDIO_SIZE = 1024;

/** Hard cap on recording length, shared by the client recorder and the UI countdown. */
export const DICTATION_MAX_CLIP_MS = 30_000;

/**
 * Audio container types we accept.
 *
 * Ordered by preference for *recording* (see pickRecordingMimeType): the first
 * few are containers the Gemini API documents as supported audio inputs, so we
 * ask the browser for those first. `audio/webm` is last because it is Chrome's
 * MediaRecorder default but is NOT on Gemini's documented audio list — we still
 * accept it so Chrome users are never locked out, but prefer anything else.
 */
export const ALLOWED_AUDIO_TYPES = [
    'audio/mp4',
    'audio/ogg',
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav',
    'audio/aac',
    'audio/flac',
    'audio/webm',
];

/**
 * Strip codec/parameter suffixes from a MIME type.
 *
 * MediaRecorder reports types like `audio/webm;codecs=opus`, and the browser
 * echoes that verbatim into the Blob's `type`. Matching the allowlist against
 * the raw string would reject every real recording, so normalize to the bare
 * type first.
 */
export function normalizeAudioType(type?: string | null): string {
    if (!type) return "";
    return type.split(";")[0].trim().toLowerCase();
}

export interface AudioCandidate {
    /** Blob/File MIME type as reported by the browser, possibly with codec params. */
    type: string;
    /** Payload size in bytes. */
    size: number;
}

export type AudioValidation =
    | { ok: true; mimeType: string }
    | { ok: false; status: number; error: string };

/**
 * Decide whether a dictation clip is safe to forward to the model.
 *
 * On success returns the *normalized* MIME type, which is what gets handed to
 * Gemini as the inline-data mimeType — passing the raw `;codecs=` string
 * through is rejected by the API.
 */
export function validateAudio(clip: AudioCandidate): AudioValidation {
    if (clip.size > MAX_AUDIO_SIZE) {
        return { ok: false, status: 400, error: "Recording is too long. Keep it under 30 seconds." };
    }

    if (clip.size < MIN_AUDIO_SIZE) {
        return { ok: false, status: 400, error: "No audio captured. Try holding the mic a moment longer." };
    }

    const mimeType = normalizeAudioType(clip.type);
    if (!ALLOWED_AUDIO_TYPES.includes(mimeType)) {
        return { ok: false, status: 400, error: "Unsupported audio format" };
    }

    return { ok: true, mimeType };
}

/**
 * Preambles a chat-tuned model sometimes prepends despite being told to return
 * only the transcript. Anchored to the start of the string and matched
 * case-insensitively; the trailing colon is what distinguishes a genuine
 * preamble from a user actually saying "here is the transcript of the reading".
 */
const PREAMBLE = /^(?:sure[,!.]?\s*)?(?:here(?:'s| is)\s+)?(?:the\s+)?(?:verbatim\s+)?transcript(?:ion)?(?:\s+of\s+the\s+audio)?\s*:\s*/i;

/**
 * Normalize a raw model response into something safe to drop in the input box.
 *
 * Handles the three things Gemini does that would otherwise leak into the
 * user's message: a "Here is the transcript:" preamble, wrapping the transcript
 * in a markdown code fence, and wrapping it in quotes. Order matters — the
 * fence has to come off before the quote check, since a fenced transcript can
 * itself be quoted.
 */
export function cleanTranscript(raw?: string | null): string {
    if (!raw) return "";

    let text = raw.trim();

    // Unwrap a markdown code fence (with or without a language tag).
    const fenced = text.match(/^```[a-zA-Z]*\n?([\s\S]*?)\n?```$/);
    if (fenced) text = fenced[1].trim();

    text = text.replace(PREAMBLE, "").trim();

    // Unwrap matching surrounding quotes, but only if there are none inside —
    // otherwise we'd mangle a transcript that legitimately quotes something.
    const quoted = text.match(/^"([^"]*)"$/) ?? text.match(/^'([^']*)'$/);
    if (quoted) text = quoted[1].trim();

    // Collapse the runs of whitespace that transcription of a pause produces.
    return text.replace(/\s+/g, " ").trim();
}

/**
 * Model responses that mean "there was nothing to transcribe".
 *
 * Gemini answers a silent or unintelligible clip conversationally rather than
 * with an empty string, and that sentence would otherwise be pasted into the
 * user's chat box as if they had said it.
 */
// Matched as PHRASES, never as bare words. An earlier version tested for the
// substrings "empty", "silent" and "inaudible" on any short response, which
// silently swallowed legitimate speech — "the hydraulic tank is empty" is an
// ordinary thing for a technician to say, and it vanished instead of reaching
// the chat box. Every pattern here must describe the *recording*, not its
// content.
const EMPTY_TRANSCRIPT_MARKERS = [
    /\bno (?:intelligible |discernible |audible )?speech\b/i,
    /\bno (?:audible|discernible|intelligible) (?:audio|sound|words?)\b/i,
    /\b(?:cannot|can't|could ?n[o']t|unable to) (?:transcribe|make out|detect)\b/i,
    // "the audio is silent", "this recording appears to be empty/inaudible" —
    // anchored to a word for the clip itself so it can't match speech content.
    /\b(?:audio|recording|clip|file)\b[^.]{0,40}\b(?:is|was|appears?|seems?)\b[^.]{0,20}\b(?:silent|empty|inaudible|blank)\b/i,
    /^\s*(?:silence|silent|inaudible|blank|empty)\s*[.!]?\s*$/i,
];

/** True when the cleaned transcript carries no usable speech. */
export function isEmptyTranscript(cleaned: string): boolean {
    if (!cleaned) return true;

    // The sentinel the prompt asks for on a silent clip. Matched leniently
    // (case, surrounding punctuation, underscore vs. space) because the model
    // returns it as free text — a literal === comparison lets "No speech."
    // through, and it would be pasted into the chat box as the user's words.
    if (/^no[_\s-]?speech[.!]?$/i.test(cleaned.trim())) return true;

    // Only short responses are treated as refusals — a long transcript that
    // happens to describe silence is real speech.
    if (cleaned.length > 120) return false;
    return EMPTY_TRANSCRIPT_MARKERS.some((re) => re.test(cleaned));
}

/**
 * Container/codec pairs to request from MediaRecorder, best first.
 *
 * These are explicit pairs rather than a container list crossed with a codec.
 * An earlier version tried `${container};codecs=opus` for every container,
 * which made Chrome hand back `audio/mp4;codecs=opus` — a legal but exotic
 * pairing (MP4 audio is normally AAC) that Gemini cannot decode. The model
 * received an undecodable audio part and "transcribed" the only readable text
 * in the request: the prompt itself. Never pair a codec with a container it
 * isn't conventionally carried in.
 *
 * Ordering: Opus in Ogg/WebM first (what Chrome and Firefox actually encode
 * well), then AAC in MP4 for Safari, then the plain legacy containers.
 */
export const RECORDING_CANDIDATES = [
    "audio/ogg;codecs=opus",
    "audio/webm;codecs=opus",
    "audio/mp4;codecs=mp4a.40.2", // AAC-LC — Gemini documents AAC support
    "audio/mpeg",
    "audio/wav",
    // Bare containers as a last resort: let the browser choose the codec rather
    // than record nothing at all.
    "audio/webm",
    "audio/mp4",
];

/**
 * Choose the best recording container/codec the current browser supports.
 *
 * Returns "" to mean "let MediaRecorder pick its own default" — exported
 * separately from the recorder hook so it is unit-testable.
 */
export function pickRecordingMimeType(
    isSupported: (type: string) => boolean
): string {
    return RECORDING_CANDIDATES.find((candidate) => isSupported(candidate)) ?? "";
}

/**
 * True when the model echoed our instruction instead of transcribing.
 *
 * This is what an undecodable audio part looks like from the response side:
 * with no readable audio, the model transcribes the only text in the request.
 * Without this guard the entire prompt gets pasted into the user's chat input
 * as though they had dictated it.
 */
export function isPromptEcho(text: string, prompt: string): boolean {
    if (!text) return false;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const t = norm(text);
    const p = norm(prompt);
    if (!t || !p) return false;
    // An echo is always a long span of instruction text. Short responses can
    // never qualify — notably the NO_SPEECH sentinel, which normalizes to
    // "no speech" and appears verbatim inside the prompt that defines it.
    // Without this floor the guard rejects the very reply it asks for.
    if (t.length < 40) return false;
    // Either direction counts: a full echo contains the prompt, a truncated one
    // is contained by it.
    return p.includes(t.slice(0, 40)) || t.includes(p.slice(0, 40));
}
