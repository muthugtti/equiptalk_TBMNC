"use client";

import { useState } from "react";

type Rating = "up" | "down" | "report";

interface FeedbackBarProps {
    /** Authenticated chat passes the internal id; the public QR chat only knows
     *  its link token and passes linkId instead. One of the two is required. */
    equipmentId?: string;
    linkId?: string;
    question: string;
    answer: string;
}

/**
 * Small thumbs up / down / report row shown under each bot answer. Posts to
 * /api/chat-feedback, which stores the signal for analytics and (on down/report)
 * feeds the learning loop.
 */
export default function FeedbackBar({ equipmentId, linkId, question, answer }: FeedbackBarProps) {
    const [selected, setSelected] = useState<Rating | null>(null);
    const [submitting, setSubmitting] = useState<Rating | null>(null);
    const [note, setNote] = useState<string>("");

    async function send(rating: Rating) {
        if (submitting) return;
        // Let people un-toggle a thumb they picked by mistake — but only clears
        // the local highlight; we don't send an "undo" to the server.
        if (selected === rating && rating !== "report") {
            setSelected(null);
            return;
        }

        let comment = "";
        if (rating === "report") {
            const reason = typeof window !== "undefined"
                ? window.prompt("Report this answer — what's wrong with it? (optional)") ?? ""
                : "";
            comment = reason;
        }

        setSubmitting(rating);
        try {
            const res = await fetch("/api/chat-feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ equipmentId, linkId, question, answer, rating, comment }),
            });
            if (res.ok) {
                setSelected(rating);
                setNote(
                    rating === "up" ? "Thanks for the feedback!"
                        : rating === "down" ? "Thanks — the assistant will try to do better."
                        : "Reported. Thanks for flagging this."
                );
            } else {
                setNote("Couldn't save feedback. Try again.");
            }
        } catch {
            setNote("Couldn't save feedback. Try again.");
        } finally {
            setSubmitting(null);
        }
    }

    const btn = (rating: Rating, icon: string, label: string, activeColor: string) => (
        <button
            type="button"
            onClick={() => send(rating)}
            disabled={submitting !== null}
            aria-label={label}
            title={label}
            aria-pressed={selected === rating}
            className={`flex items-center justify-center h-7 w-7 rounded-md transition-colors disabled:opacity-50 ${
                selected === rating
                    ? activeColor
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700"
            }`}
        >
            <span className="material-symbols-outlined text-[18px]" style={selected === rating ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                {icon}
            </span>
        </button>
    );

    return (
        <div className="mt-1.5 flex items-center gap-1">
            {btn("up", "thumb_up", "Helpful", "text-green-600 bg-green-50 dark:bg-green-900/30")}
            {btn("down", "thumb_down", "Not helpful", "text-red-600 bg-red-50 dark:bg-red-900/30")}
            {btn("report", "flag", "Report", "text-amber-600 bg-amber-50 dark:bg-amber-900/30")}
            {note && <span className="ml-1.5 text-xs text-gray-400">{note}</span>}
        </div>
    );
}
