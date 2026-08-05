"use client";

import { useEffect, useState } from "react";
import { useDictation } from "@/hooks/useDictation";

/**
 * Mic button for the chat input bar — dictation only.
 *
 * The transcript is written into the caller's input box for review; it is never
 * auto-sent, so the user can correct a mishear before pressing Send. Dictation
 * is strictly additive: typing works exactly as before and is never gated
 * behind voice. The button hides itself entirely on browsers that cannot
 * record, rather than presenting a control that will always fail.
 */

// Remembers that we've shown the "speech goes to Google" note. Read lazily
// inside an effect — localStorage is unavailable during SSR.
const NOTICE_KEY = "equiptalk.dictation.noticeSeen";

interface MicButtonProps {
    /** Receives the transcript. Callers append/replace and focus their input. */
    onTranscript: (text: string) => void;
    /** Disable while a chat request is streaming. */
    disabled?: boolean;
    /** Tailwind sizing for the button, so each surface can match its send button. */
    className?: string;
}

export default function MicButton({ onTranscript, disabled, className = "" }: MicButtonProps) {
    const dictation = useDictation({ onTranscript });
    const { state, error, secondsLeft, supported, start, stop, cancel, dismissError } = dictation;

    const [showNotice, setShowNotice] = useState(false);

    // Esc cancels an in-progress recording and discards the audio. Bound only
    // while recording so it never swallows Esc from the rest of the page.
    useEffect(() => {
        if (state !== "recording") return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                cancel();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [state, cancel]);

    if (!supported) return null;

    const handleClick = async () => {
        if (state === "recording") {
            stop();
            return;
        }
        if (state === "transcribing") return;

        // First use only: surface where the audio goes before we ever open the mic.
        if (!localStorage.getItem(NOTICE_KEY)) {
            localStorage.setItem(NOTICE_KEY, "1");
            setShowNotice(true);
            setTimeout(() => setShowNotice(false), 6000);
        }
        await start();
    };

    const label =
        state === "recording" ? `Stop dictation (${secondsLeft}s left)`
        : state === "transcribing" ? "Transcribing your question"
        : "Dictate a question";

    return (
        <div className="relative flex-shrink-0">
            {/* Status changes are announced for screen readers, which otherwise
                get no signal that recording started or that text arrived. */}
            <span className="sr-only" role="status" aria-live="polite">
                {state === "recording" ? "Recording. Press Escape to cancel."
                    : state === "transcribing" ? "Transcribing."
                    : ""}
            </span>

            {(error || showNotice) && (
                <div
                    className="absolute bottom-full right-0 mb-2 w-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs text-gray-600 dark:text-gray-300 shadow-lg z-10"
                    role={error ? "alert" : undefined}
                >
                    {error ? (
                        <div className="flex items-start gap-2">
                            <span className="flex-1">{error}</span>
                            <button
                                onClick={dismissError}
                                aria-label="Dismiss"
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 leading-none"
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        "Your speech is sent to Google for transcription. The audio isn't stored."
                    )}
                </div>
            )}

            <button
                type="button"
                onClick={handleClick}
                disabled={disabled || state === "transcribing"}
                aria-label={label}
                title={label}
                aria-pressed={state === "recording"}
                className={`flex items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
                    state === "recording"
                        ? "bg-red-600 text-white hover:bg-red-700 animate-pulse"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                } ${className}`}
            >
                <span className="material-symbols-outlined text-sm">
                    {state === "recording" ? "stop"
                        : state === "transcribing" ? "progress_activity"
                        : "mic"}
                </span>
            </button>

            {state === "recording" && (
                <span className="absolute -top-1 -right-1 rounded-full bg-red-600 px-1.5 text-[10px] font-medium text-white tabular-nums">
                    {secondsLeft}
                </span>
            )}
        </div>
    );
}
