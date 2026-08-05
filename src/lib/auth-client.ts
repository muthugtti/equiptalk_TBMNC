// Client-side helpers for the auth flow. Shared by the login and signup pages
// so both drive the session endpoint identically.

export type SessionResult =
    | { status: "ok" }
    | { status: "rate_limited"; retryAfterSec: number }
    | { status: "error"; message: string };

async function postJson(url: string, body: unknown): Promise<Response> {
    return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

function rateLimited(res: Response): { status: "rate_limited"; retryAfterSec: number } {
    const retryAfter = res.headers.get("Retry-After");
    return { status: "rate_limited", retryAfterSec: retryAfter ? parseInt(retryAfter, 10) : 900 };
}

/** Exchange a Firebase ID token for the `__session` cookie. */
export async function requestSession(idToken: string): Promise<SessionResult> {
    try {
        const res = await postJson("/api/auth/session", { idToken });
        if (res.status === 429) return rateLimited(res);
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) return { status: "ok" };
        return { status: "error", message: data.error ?? "Sign in failed. Please try again." };
    } catch {
        return { status: "error", message: "Network error. Please try again." };
    }
}
