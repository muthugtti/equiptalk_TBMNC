import "server-only";
import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { initAdmin, getDb } from "@/lib/firebase-admin";

const COOKIE_NAME = "__session";

/**
 * Verifies the __session cookie against Firebase Auth.
 * Returns the decoded claims, or null if missing/invalid/expired/revoked.
 */
export async function verifySession(
  req: NextRequest
): Promise<admin.auth.DecodedIdToken | null> {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) return null;
  try {
    await initAdmin();
    return await admin.auth().verifySessionCookie(cookie, true);
  } catch {
    return null;
  }
}

/**
 * Guard for API routes: returns the decoded session on success, or a 401
 * NextResponse to return immediately. Usage:
 *
 *   const auth = await requireAuth(req);
 *   if (auth instanceof NextResponse) return auth;
 */
export async function requireAuth(
  req: NextRequest
): Promise<admin.auth.DecodedIdToken | NextResponse> {
  const decoded = await verifySession(req);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return decoded;
}

/**
 * Ownership check for a single equipment document.
 * Returns true only if the equipment exists AND its `createdBy` equals `uid`.
 *
 * STRICT scoping for security: equipment that is missing (deleted) or owned by
 * another account returns false. Legacy equipment without a `createdBy` field
 * is also treated as NOT owned so foreign/orphaned equipment ids can never be
 * used to reach another account's related data (documents, analytics, uploads).
 */
export async function isEquipmentOwnedBy(
  equipmentId: string,
  uid: string
): Promise<boolean> {
  const db = await getDb();
  const snap = await db.collection("equipment").doc(equipmentId).get();
  if (!snap.exists) return false;
  return snap.data()?.createdBy === uid;
}
