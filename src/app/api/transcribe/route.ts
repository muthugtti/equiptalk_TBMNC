import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/gemini";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateAudio, cleanTranscript, isEmptyTranscript, isPromptEcho } from "@/lib/transcribe-validation";

// Dictation (speech-to-text) for the chat input box.
//
// PRIVACY: this route is deliberately stateless. The audio clip is held in
// memory only for the duration of the Gemini call and is never written to
// Storage or Firestore, and neither is the resulting transcript. The text is
// returned to the client, lands in the user's chat input, and only becomes
// persisted data if they choose to press Send — at which point it is an
// ordinary chat message. Do not add logging of `text` or the audio buffer here.
//
// This route never calls /api/chat itself; it only returns text.

// Each request is a billed audio model call, so the budget is tighter than the
// upload route's. 20 clips per 15 minutes is comfortably above real dictation
// use (a technician asking a handful of questions) while bounding cost.
const TRANSCRIBE_RATE_LIMIT = { maxAttempts: 20, windowMs: 15 * 60 * 1000, lockoutMs: 5 * 60 * 1000 };

// Same family as the chat model, which keeps the dependency surface to one
// model id. Transcription is a mechanical task: temperature 0 and no thinking
// budget, since deliberation adds latency and tokens without improving a
// verbatim transcript.
const TRANSCRIBE_MODEL = "gemini-2.5-flash";

const TRANSCRIBE_PROMPT =
    "Transcribe this audio verbatim in English (en-US). " +
    "Return ONLY the transcript text with no commentary, no preamble, no quotes, and no markdown. " +
    "If there is no intelligible speech, return exactly: NO_SPEECH";

export async function POST(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const rateLimit = await checkRateLimit(`transcribe:${auth.uid}`, true, TRANSCRIBE_RATE_LIMIT);
    if (!rateLimit.allowed) {
        const retryAfterSec = Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000);
        return NextResponse.json(
            { error: "Too many dictation requests. Please wait a moment." },
            { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
        );
    }

    try {
        const formData = await req.formData();
        const clip = formData.get("audio") as File | null;

        if (!clip) {
            return NextResponse.json({ error: "No audio provided" }, { status: 400 });
        }

        // Shared, unit-tested gate (see src/lib/transcribe-validation.ts).
        // Returns the codec-stripped MIME type — Gemini rejects a raw
        // "audio/webm;codecs=opus" as an inline-data mimeType.
        const validation = validateAudio({ type: clip.type, size: clip.size });
        if (!validation.ok) {
            return NextResponse.json({ error: validation.error }, { status: validation.status });
        }

        const base64 = Buffer.from(await clip.arrayBuffer()).toString("base64");

        const result = await ai.models.generateContent({
            model: TRANSCRIBE_MODEL,
            contents: [
                {
                    role: "user",
                    parts: [
                        { inlineData: { mimeType: validation.mimeType, data: base64 } },
                        { text: TRANSCRIBE_PROMPT },
                    ],
                },
            ],
            config: {
                temperature: 0,
                // Verbatim transcription needs no reasoning pass; skipping it
                // cuts both latency and token cost on every dictation.
                thinkingConfig: { thinkingBudget: 0 },
            },
        });

        const text = cleanTranscript(result.text);

        // ORDER MATTERS. The empty/sentinel check runs first because NO_SPEECH
        // normalizes to "no speech", which appears inside the prompt line that
        // defines it — so the echo guard below would otherwise reject the exact
        // reply we asked the model for.
        //
        // A silent or unintelligible clip comes back as either the NO_SPEECH
        // sentinel or a conversational refusal. isEmptyTranscript covers both,
        // so the client shows "didn't catch that" instead of pasting the
        // model's apology into the chat box as if the user had said it.
        if (isEmptyTranscript(text)) {
            return NextResponse.json({ text: "" });
        }

        // An undecodable audio part makes the model transcribe the only text it
        // can read — this prompt. Treat that as a hard failure rather than an
        // empty result: the audio was fine, we sent a container the model can't
        // read, and "didn't catch that" would send the user off retrying their
        // diction instead of surfacing a real bug.
        if (isPromptEcho(text, TRANSCRIBE_PROMPT)) {
            console.error(
                `[Transcribe] Model echoed the prompt — audio part was not decoded (mimeType=${validation.mimeType}, bytes=${clip.size})`
            );
            return NextResponse.json(
                { error: "Your browser recorded an audio format we can't transcribe. Please type your question." },
                { status: 502 }
            );
        }

        return NextResponse.json({ text });
    } catch (error: unknown) {
        // Log the failure but never the audio or transcript (see PRIVACY above).
        console.error("[Transcribe] Transcription failed:", error);
        return NextResponse.json(
            { error: "Could not transcribe audio. Please type your question instead." },
            { status: 502 }
        );
    }
}
