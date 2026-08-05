import { test } from "node:test";
import assert from "node:assert/strict";
import {
    validateAudio,
    cleanTranscript,
    isEmptyTranscript,
    normalizeAudioType,
    pickRecordingMimeType,
    isPromptEcho,
    RECORDING_CANDIDATES,
    MAX_AUDIO_SIZE,
    MIN_AUDIO_SIZE,
} from "../src/lib/transcribe-validation.ts";

// The dictation route's two pure concerns:
//   1. validateAudio  — the server-side gate deciding which clips reach Gemini.
//   2. cleanTranscript/isEmptyTranscript — turning a chat-model response into
//      text that is safe to paste into the user's chat input.
//
// Both are pure, so the MediaRecorder capture and the Gemini call stay out of
// the suite entirely (per the scope doc's testability section).

const OK_SIZE = 200 * 1024; // ~a few seconds of opus

/* ------------------------------------------------------------------ */
/* validateAudio — size bounds                                         */
/* ------------------------------------------------------------------ */

test("accepts a normal-sized opus clip", () => {
    const result = validateAudio({ type: "audio/webm;codecs=opus", size: OK_SIZE });
    assert.equal(result.ok, true);
});

test("rejects a payload over the size cap", () => {
    const result = validateAudio({ type: "audio/webm", size: MAX_AUDIO_SIZE + 1 });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.status, 400);
});

test("accepts a payload exactly at the size cap", () => {
    // Boundary is inclusive — a clip at exactly the cap is still valid.
    const result = validateAudio({ type: "audio/webm", size: MAX_AUDIO_SIZE });
    assert.equal(result.ok, true);
});

test("rejects an empty payload from a mis-tapped mic", () => {
    const result = validateAudio({ type: "audio/webm", size: 0 });
    assert.equal(result.ok, false);
});

test("rejects a payload just under the minimum", () => {
    const result = validateAudio({ type: "audio/webm", size: MIN_AUDIO_SIZE - 1 });
    assert.equal(result.ok, false);
});

/* ------------------------------------------------------------------ */
/* validateAudio — MIME handling                                       */
/* ------------------------------------------------------------------ */

test("strips codec params before matching the allowlist", () => {
    // The whole reason normalizeAudioType exists: every real MediaRecorder blob
    // carries a ;codecs= suffix, so a naive allowlist match rejects everything.
    const result = validateAudio({ type: "audio/webm;codecs=opus", size: OK_SIZE });
    assert.equal(result.ok, true);
    assert.equal(result.ok === true && result.mimeType, "audio/webm");
});

test("returns the normalized type for the Gemini inline-data part", () => {
    const result = validateAudio({ type: "audio/mp4; codecs=mp4a.40.2", size: OK_SIZE });
    assert.equal(result.ok === true && result.mimeType, "audio/mp4");
});

test("rejects a non-audio type", () => {
    const result = validateAudio({ type: "video/mp4", size: OK_SIZE });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.error, "Unsupported audio format");
});

test("rejects a missing type rather than defaulting it", () => {
    // Unlike uploads there is no filename to fall back on, so an untyped blob
    // is simply refused.
    const result = validateAudio({ type: "", size: OK_SIZE });
    assert.equal(result.ok, false);
});

test("normalizeAudioType lowercases and trims", () => {
    assert.equal(normalizeAudioType("AUDIO/WEBM ; codecs=opus"), "audio/webm");
    assert.equal(normalizeAudioType(null), "");
});

/* ------------------------------------------------------------------ */
/* cleanTranscript                                                     */
/* ------------------------------------------------------------------ */

test("passes a clean transcript through untouched", () => {
    assert.equal(
        cleanTranscript("Why is the hydraulic pressure dropping?"),
        "Why is the hydraulic pressure dropping?"
    );
});

test("strips a conversational preamble", () => {
    assert.equal(
        cleanTranscript("Here is the transcript: The engine is overheating."),
        "The engine is overheating."
    );
    assert.equal(
        cleanTranscript("Sure, here's the verbatim transcript of the audio: Check the oil."),
        "Check the oil."
    );
});

test("unwraps a markdown code fence", () => {
    assert.equal(cleanTranscript("```\nThe belt is loose.\n```"), "The belt is loose.");
    assert.equal(cleanTranscript("```text\nThe belt is loose.\n```"), "The belt is loose.");
});

test("unwraps surrounding quotes", () => {
    assert.equal(cleanTranscript('"The belt is loose."'), "The belt is loose.");
});

test("keeps internal quotes intact", () => {
    // Only strips a wrapping pair when nothing inside would be mangled.
    const input = 'He said "stop the machine" and walked away';
    assert.equal(cleanTranscript(input), input);
});

test("collapses whitespace from transcribed pauses", () => {
    assert.equal(cleanTranscript("The   pump  is\n\nleaking"), "The pump is leaking");
});

test("does not strip 'transcript' when it is real speech", () => {
    // The preamble pattern requires a trailing colon, so a user genuinely
    // saying the word keeps it.
    const input = "Transcript of the service log is missing";
    assert.equal(cleanTranscript(input), input);
});

test("handles null and empty input", () => {
    assert.equal(cleanTranscript(null), "");
    assert.equal(cleanTranscript("   "), "");
});

/* ------------------------------------------------------------------ */
/* isEmptyTranscript                                                   */
/* ------------------------------------------------------------------ */

test("detects a model refusal on a silent clip", () => {
    // Without this the refusal sentence gets pasted into the chat box as if the
    // user had said it.
    assert.equal(isEmptyTranscript("No speech detected in the audio."), true);
    assert.equal(isEmptyTranscript("The audio appears to be silent."), true);
    assert.equal(isEmptyTranscript(""), true);
});

test("detects the NO_SPEECH sentinel in every form the model emits", () => {
    // Confirmed live: a silent clip returns exactly "NO_SPEECH". The variants
    // are defensive — the model returns this as free text, so an exact ===
    // match would leak "No speech." into the user's chat input.
    assert.equal(isEmptyTranscript("NO_SPEECH"), true);
    assert.equal(isEmptyTranscript("No speech."), true);
    assert.equal(isEmptyTranscript("no speech"), true);
    assert.equal(isEmptyTranscript("NO SPEECH"), true);
});

test("treats real speech as non-empty", () => {
    assert.equal(isEmptyTranscript("Why is the hydraulic pressure dropping?"), false);
});

// REGRESSION: an earlier version matched the bare substrings "empty", "silent"
// and "inaudible" on any short response, so these ordinary shop-floor sentences
// were discarded as no-speech and never reached the chat box. The markers are
// now phrases that must describe the recording itself.
test("does not swallow short speech containing marker words", () => {
    for (const spoken of [
        "The hydraulic tank is empty",
        "The alarm went silent",
        "The gauge reading is inaudible",
        "Is the reservoir empty?",
        "Why did the pump go silent?",
    ]) {
        assert.equal(isEmptyTranscript(spoken), false, `swallowed: "${spoken}"`);
    }
});

test("still detects refusals that describe the recording", () => {
    for (const refusal of [
        "The audio is silent.",
        "This recording appears to be empty.",
        "The clip seems inaudible.",
        "No intelligible speech.",
        "I cannot transcribe this.",
        "Silence.",
    ]) {
        assert.equal(isEmptyTranscript(refusal), true, `missed: "${refusal}"`);
    }
});

test("does not flag a long transcript that mentions a marker word", () => {
    const long =
        "The alarm went silent after we reset the controller but the pressure warning came back within about ten minutes of running";
    assert.equal(isEmptyTranscript(long), false);
});

/* ------------------------------------------------------------------ */
/* pickRecordingMimeType                                               */
/* ------------------------------------------------------------------ */

test("prefers a Gemini-documented container over webm", () => {
    // Chrome supports both; audio/ogg is on Gemini's documented audio list and
    // audio/webm is not, so ogg must win.
    const supported = new Set(["audio/ogg;codecs=opus", "audio/webm;codecs=opus"]);
    assert.equal(
        pickRecordingMimeType((t) => supported.has(t)),
        "audio/ogg;codecs=opus"
    );
});

test("falls back to webm when nothing better is supported", () => {
    const supported = new Set(["audio/webm;codecs=opus"]);
    assert.equal(
        pickRecordingMimeType((t) => supported.has(t)),
        "audio/webm;codecs=opus"
    );
});

test("returns empty string when no candidate is supported", () => {
    // Signals "let MediaRecorder choose its own default" rather than throwing.
    assert.equal(pickRecordingMimeType(() => false), "");
});

// REGRESSION: the picker used to try `${container};codecs=opus` for every
// container, so Chrome — which reports Opus-in-MP4 as supported — produced
// audio/mp4;codecs=opus. Gemini could not decode it and echoed the prompt back
// as the transcript. No candidate may pair opus with an MP4 container.
test("never requests opus in an mp4 container", () => {
    for (const candidate of RECORDING_CANDIDATES) {
        const isMp4Opus = candidate.startsWith("audio/mp4") && candidate.includes("opus");
        assert.equal(isMp4Opus, false, `bad pairing: ${candidate}`);
    }
});

test("picks AAC when mp4 is the only container available (Safari)", () => {
    const supported = new Set(["audio/mp4;codecs=mp4a.40.2", "audio/mp4;codecs=opus"]);
    assert.equal(
        pickRecordingMimeType((t) => supported.has(t)),
        "audio/mp4;codecs=mp4a.40.2"
    );
});

test("prefers ogg/opus over mp4 when Chrome offers both", () => {
    // The exact situation that produced the bug: Chrome says yes to both.
    const supported = new Set([
        "audio/ogg;codecs=opus",
        "audio/webm;codecs=opus",
        "audio/mp4;codecs=opus",
    ]);
    assert.equal(
        pickRecordingMimeType((t) => supported.has(t)),
        "audio/ogg;codecs=opus"
    );
});

/* ------------------------------------------------------------------ */
/* isPromptEcho                                                        */
/* ------------------------------------------------------------------ */

const PROMPT =
    "Transcribe this audio verbatim in English (en-US). " +
    "Return ONLY the transcript text with no commentary, no preamble, no quotes, and no markdown. " +
    "If there is no intelligible speech, return exactly: NO_SPEECH";

test("detects a verbatim prompt echo", () => {
    // Observed live when the audio part could not be decoded.
    assert.equal(isPromptEcho(PROMPT, PROMPT), true);
});

test("detects a truncated prompt echo", () => {
    assert.equal(
        isPromptEcho("Transcribe this audio verbatim in English (en-US).", PROMPT),
        true
    );
});

// REGRESSION: "NO_SPEECH" normalizes to "no speech", which appears verbatim in
// the prompt line that defines the sentinel — so the guard rejected the exact
// reply it asks for, surfacing a bogus "format we can't transcribe" 502 on
// every silent clip. Short responses can never be echoes.
test("does not flag the NO_SPEECH sentinel as an echo", () => {
    assert.equal(isPromptEcho("NO_SPEECH", PROMPT), false);
    assert.equal(isPromptEcho("No speech.", PROMPT), false);
});

test("does not flag other short refusals as echoes", () => {
    assert.equal(isPromptEcho("The audio is silent.", PROMPT), false);
    assert.equal(isPromptEcho("no markdown", PROMPT), false);
});

test("does not flag a real transcript as an echo", () => {
    assert.equal(isPromptEcho("Why is the hydraulic pressure dropping?", PROMPT), false);
    assert.equal(isPromptEcho("Transcribe the service log for me", PROMPT), false);
    assert.equal(isPromptEcho("", PROMPT), false);
});
