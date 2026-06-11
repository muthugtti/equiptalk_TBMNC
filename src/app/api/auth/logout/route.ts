import { NextRequest, NextResponse } from "next/server";

// GET /api/auth/logout — server-side sign-out.
// Clears the session cookie and issues a redirect to /login in one response,
// so the browser never carries a valid cookie into the redirect destination.
export async function GET(req: NextRequest) {
  // Firebase Hosting rewrites Host to the Cloud Run internal address.
  // x-forwarded-host carries the real public hostname; reconstruct the URL
  // so the redirect goes to the correct public origin, not 0.0.0.0:8080.
  const forwardedHost = req.headers.get("x-forwarded-host");
  const base = forwardedHost
    ? `https://${forwardedHost}`
    : req.url;
  const loginUrl = new URL("/login", base);
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
