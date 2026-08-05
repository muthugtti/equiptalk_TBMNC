import type { NextRequest } from "next/server";

/**
 * Reject cross-origin state-changing requests. Shared by the auth routes so
 * they all apply the same CSRF check.
 *
 * Firebase Hosting's CDN rewrites the Host header to Cloud Run's internal
 * address, so the original public hostname arrives in x-forwarded-host.
 */
export function isAllowedOrigin(req: NextRequest): boolean {
    const origin = req.headers.get("origin");
    if (!origin) return true; // non-browser / same-origin navigations don't send Origin
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    try {
        return new URL(origin).host === host;
    } catch {
        return false;
    }
}
