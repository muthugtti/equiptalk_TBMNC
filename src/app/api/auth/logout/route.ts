import { NextRequest, NextResponse } from "next/server";

// GET /api/auth/logout — server-side sign-out.
// Clears the session cookie and issues a redirect to /login in one response,
// so the browser never carries a valid cookie into the redirect destination.
export async function GET(req: NextRequest) {
  const loginUrl = new URL("/login", req.url);
  const res = NextResponse.redirect(loginUrl, 302);
  res.cookies.set("__session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
