import { NextRequest, NextResponse } from "next/server";
import { getPublicEquipment, isValidLinkId } from "@/lib/public-equipment";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Unauthenticated endpoint — limit by IP to prevent token scraping.
const PUBLIC_INFO_RATE_LIMIT = { maxAttempts: 60, windowMs: 5 * 60 * 1000, lockoutMs: 5 * 60 * 1000 };

export async function GET(req: NextRequest) {
    const ip = getClientIp(req);
    const rl = await checkRateLimit(`public-info:${ip}`, true, PUBLIC_INFO_RATE_LIMIT);
    if (!rl.allowed) {
        return NextResponse.json(
            { error: "Too many requests." },
            { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 0) / 1000)) } }
        );
    }

    // Demo launch: QR/Open Chat is gated behind login. Enforce auth server-side
    // so the endpoint isn't reachable anonymously even if hit directly.
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const linkId = new URL(req.url).searchParams.get("linkId");
    if (!isValidLinkId(linkId)) {
        return NextResponse.json({ error: "Invalid link." }, { status: 400 });
    }

    const eq = await getPublicEquipment(linkId);
    if (!eq) {
        return NextResponse.json({ error: "This equipment link is not available." }, { status: 404 });
    }

    // Expose only safe, display-facing fields — never the raw doc id or config.
    return NextResponse.json({
        name: eq.data.name ?? "Equipment",
        type: eq.data.type ?? "",
        model: eq.data.model ?? "",
        status: eq.data.status ?? "",
    });
}
