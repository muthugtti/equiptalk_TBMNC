// Renders a streamed (or one-shot) text response as a typewriter effect.
//
// The chat API streams tokens as Gemini produces them, but two things break the
// "typing" feel: a semantic-cache hit returns the whole answer in one body, and
// the Cloud Run/CDN path can buffer streamed chunks so they arrive in bursts.
//
// This decouples "text received from the network" (target) from "text shown on
// screen" (revealed), and advances the reveal on a steady timer. Result: it
// always types out smoothly — if the whole answer arrives at once it's paced
// out; if it streams in, the reveal tracks arrival without ever running ahead.

export interface TypewriterOptions {
    /** Minimum characters revealed per tick. */
    minCharsPerTick?: number;
    /** Reveal ~1/divisor of the outstanding backlog each tick, so long answers
     *  don't drag. Lower = faster catch-up. */
    backlogDivisor?: number;
    /** Tick interval in ms (~60fps at 16). */
    tickMs?: number;
}

/**
 * Read `response` to completion while revealing its text gradually via `onText`,
 * which receives the full text-so-far each time it should repaint. Resolves with
 * the complete text once everything has been revealed.
 */
export async function typeStream(
    response: Response,
    onText: (textSoFar: string) => void,
    opts: TypewriterOptions = {},
): Promise<string> {
    const minCharsPerTick = opts.minCharsPerTick ?? 2;
    const backlogDivisor = opts.backlogDivisor ?? 20;
    const tickMs = opts.tickMs ?? 16;

    if (!response.body) {
        // No stream (shouldn't happen for our routes) — fall back to whole text.
        const text = await response.text();
        onText(text);
        return text;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let target = "";      // everything received from the network so far
    let revealed = 0;     // how many characters have been shown
    let receiving = true; // still reading from the network?

    // Reader loop: append to `target` as bytes arrive.
    const readPromise = (async () => {
        try {
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                target += decoder.decode(value, { stream: true });
            }
            target += decoder.decode(); // flush any trailing bytes
        } finally {
            receiving = false;
        }
    })();

    // Reveal loop: advance `revealed` toward `target.length` on a steady timer.
    await new Promise<void>((resolve) => {
        const tick = () => {
            if (revealed < target.length) {
                const backlog = target.length - revealed;
                const step = Math.max(minCharsPerTick, Math.ceil(backlog / backlogDivisor));
                revealed = Math.min(target.length, revealed + step);
                onText(target.slice(0, revealed));
            }
            if (!receiving && revealed >= target.length) {
                resolve();
                return;
            }
            setTimeout(tick, tickMs);
        };
        tick();
    });

    await readPromise;
    return target;
}
