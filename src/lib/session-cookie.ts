import "server-only";
import type { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { initAdmin } from "./firebase-admin";

// Single source of truth for the session cookie, shared by every endpoint that
// mints one so the flags can never drift.
export const COOKIE_NAME = "__session";
// 5-day session. Firebase session cookies max out at 14 days.
export const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

/** Exchange a verified Firebase ID token for a session cookie value. */
export async function mintSessionCookie(idToken: string): Promise<string> {
    await initAdmin();
    return admin.auth().createSessionCookie(idToken, { expiresIn: SESSION_DURATION_MS });
}

export function attachSessionCookie(res: NextResponse, sessionCookie: string): void {
    res.cookies.set(COOKIE_NAME, sessionCookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: SESSION_DURATION_MS / 1000,
        path: "/",
    });
}

export function clearSessionCookie(res: NextResponse): void {
    res.cookies.set(COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
    });
}
