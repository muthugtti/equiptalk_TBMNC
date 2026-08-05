"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DICTATION_MAX_CLIP_MS, pickRecordingMimeType } from "@/lib/transcribe-validation";

/**
 * Browser mic capture for chat dictation.
 *
 * Records a short clip with MediaRecorder, POSTs it to /api/transcribe, and
 * hands back the transcript. It deliberately knows nothing about chat — the
 * caller decides what to do with the text (both chat surfaces drop it into
 * their input box for review rather than auto-sending).
 *
 * Requires a secure context: production HTTPS and localhost both qualify.
 */

export type DictationState = "idle" | "recording" | "transcribing";

interface UseDictationOptions {
    /** Called with the cleaned transcript. Not called for a silent clip. */
    onTranscript: (text: string) => void;
}

export interface UseDictation {
    state: DictationState;
    /** User-facing error, or null. Cleared on the next start(). */
    error: string | null;
    /** Whole seconds left before the hard clip cap; only meaningful while recording. */
    secondsLeft: number;
    /** True when this browser can record at all — used to hide the mic entirely. */
    supported: boolean;
    start: () => Promise<void>;
    /** Stop and transcribe. */
    stop: () => void;
    /** Stop and discard without transcribing. */
    cancel: () => void;
    dismissError: () => void;
}

export function useDictation({ onTranscript }: UseDictationOptions): UseDictation {
    const [state, setState] = useState<DictationState>("idle");
    const [error, setError] = useState<string | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(DICTATION_MAX_CLIP_MS / 1000);
    const [supported, setSupported] = useState(false);

    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const capTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // Set when the user cancels, so the recorder's onstop handler knows to drop
    // the audio instead of transcribing it. A ref (not state) because onstop
    // fires outside React's render cycle and would otherwise read a stale value.
    const cancelledRef = useRef(false);
    // Guards against setState-after-unmount when a user navigates away mid-request.
    const mountedRef = useRef(true);

    // MediaRecorder and getUserMedia are undefined during SSR and on insecure
    // origins, so feature-detect on the client after mount.
    useEffect(() => {
        setSupported(
            typeof window !== "undefined" &&
            typeof window.MediaRecorder !== "undefined" &&
            Boolean(navigator.mediaDevices?.getUserMedia)
        );
    }, []);

    /** Release the mic and clear timers. Safe to call repeatedly. */
    const teardown = useCallback(() => {
        if (capTimerRef.current) { clearTimeout(capTimerRef.current); capTimerRef.current = null; }
        if (tickTimerRef.current) { clearInterval(tickTimerRef.current); tickTimerRef.current = null; }
        // Stopping every track is what actually turns the browser's recording
        // indicator off — dropping the reference alone leaves the mic hot.
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        recorderRef.current = null;
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            teardown();
        };
    }, [teardown]);

    const transcribe = useCallback(async (blob: Blob) => {
        setState("transcribing");
        try {
            const form = new FormData();
            // The filename is required by some servers' multipart parsers; the
            // route keys off the blob's MIME type, not this name.
            form.append("audio", blob, "dictation");

            const res = await fetch("/api/transcribe", { method: "POST", body: form });
            const data = await res.json().catch(() => ({}));

            if (!mountedRef.current) return;

            if (!res.ok) {
                setError(data?.error ?? "Could not transcribe audio. Please type instead.");
                return;
            }

            const text = typeof data?.text === "string" ? data.text.trim() : "";
            if (!text) {
                setError("Didn't catch that — try again or type your question.");
                return;
            }

            onTranscript(text);
        } catch {
            if (mountedRef.current) {
                setError("Could not reach the transcription service. Please type instead.");
            }
        } finally {
            if (mountedRef.current) setState("idle");
        }
    }, [onTranscript]);

    const start = useCallback(async () => {
        if (state !== "idle") return;
        setError(null);
        cancelledRef.current = false;
        chunksRef.current = [];

        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err: unknown) {
            // Distinguish "user said no" from "there is no mic" — the fixes differ.
            const name = (err as { name?: string })?.name;
            if (name === "NotAllowedError" || name === "SecurityError") {
                setError("Microphone blocked. Allow mic access in your browser's address-bar settings, then try again.");
            } else if (name === "NotFoundError") {
                setError("No microphone found.");
            } else {
                setError("Could not start recording.");
            }
            return;
        }

        streamRef.current = stream;

        const mimeType = pickRecordingMimeType((t) => MediaRecorder.isTypeSupported(t));
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
            const chunks = chunksRef.current;
            chunksRef.current = [];
            // Use the recorder's negotiated type rather than our requested one —
            // the browser may have fallen back to a different container, and the
            // server validates against whatever the blob actually reports.
            const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
            teardown();

            if (cancelledRef.current) {
                if (mountedRef.current) setState("idle");
                return;
            }
            void transcribe(blob);
        };

        recorder.start();
        setState("recording");
        setSecondsLeft(DICTATION_MAX_CLIP_MS / 1000);

        // Hard cap so a forgotten open mic can't build a payload that approaches
        // the 60s Cloud Run request cap or the route's size limit.
        capTimerRef.current = setTimeout(() => {
            if (recorderRef.current?.state === "recording") recorderRef.current.stop();
        }, DICTATION_MAX_CLIP_MS);

        tickTimerRef.current = setInterval(() => {
            setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
        }, 1000);
    }, [state, teardown, transcribe]);

    const stop = useCallback(() => {
        if (recorderRef.current?.state === "recording") {
            cancelledRef.current = false;
            recorderRef.current.stop(); // onstop drives transcription
        }
    }, []);

    const cancel = useCallback(() => {
        if (recorderRef.current?.state === "recording") {
            cancelledRef.current = true;
            recorderRef.current.stop();
        }
    }, []);

    const dismissError = useCallback(() => setError(null), []);

    return { state, error, secondsLeft, supported, start, stop, cancel, dismissError };
}
