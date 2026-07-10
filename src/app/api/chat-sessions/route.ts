import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_MESSAGES = 40;

export async function GET(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const equipmentId = searchParams.get("equipmentId");
    const sessionId = searchParams.get("sessionId");

    try {
        const db = await getDb();
        const base = db.collection("users").doc(auth.uid).collection("chatSessions");

        // Single session fetch (for loading full messages)
        if (sessionId) {
            const doc = await base.doc(sessionId).get();
            if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
            return NextResponse.json({ session: { id: doc.id, ...doc.data() } });
        }

        // List sessions for this equipment
        if (!equipmentId) return NextResponse.json({ error: "Missing equipmentId" }, { status: 400 });

        const snap = await base
            .where("equipmentId", "==", equipmentId)
            .limit(20)
            .get();

        const sessions = snap.docs
            .map(d => ({
                id: d.id,
                title: d.data().title as string,
                updatedAt: d.data().updatedAt as string,
                messageCount: (d.data().messageCount as number) ?? 0,
            }))
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 10);

        return NextResponse.json({ sessions });
    } catch (error: any) {
        console.error("[chat-sessions GET]", error);
        return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    try {
        const { sessionId, equipmentId, messages } = await req.json();

        if (!equipmentId || !Array.isArray(messages)) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const db = await getDb();
        const base = db.collection("users").doc(auth.uid).collection("chatSessions");
        const now = new Date().toISOString();
        const title = (messages.find((m: any) => m.role === "user")?.text ?? "Chat").slice(0, 60);

        const payload = {
            equipmentId,
            title,
            messages: messages.slice(-MAX_MESSAGES),
            messageCount: messages.length,
            updatedAt: now,
        };

        if (sessionId) {
            const doc = await base.doc(sessionId).get();
            if (doc.exists) {
                await base.doc(sessionId).update(payload);
                return NextResponse.json({ sessionId });
            }
        }

        // Create new session
        const ref = await base.add({ ...payload, createdAt: now });
        return NextResponse.json({ sessionId: ref.id });
    } catch (error: any) {
        console.error("[chat-sessions POST]", error);
        return NextResponse.json({ error: "Failed to save session" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

    try {
        const db = await getDb();
        await db.collection("users").doc(auth.uid).collection("chatSessions").doc(sessionId).delete();
        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error("[chat-sessions DELETE]", error);
        return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
    }
}
