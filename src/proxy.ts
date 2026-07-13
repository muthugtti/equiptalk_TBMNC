import { NextRequest, NextResponse } from "next/server";

// `/p/[linkId]` (the QR/Open Chat public page) is gated behind login for the
// demo launch. It is a dynamic SSR route, so this middleware actually runs for
// it (unlike CDN-prerendered static pages). The API layer is the real boundary.
const PROTECTED = ["/dashboard", "/chat", "/p/"];
const PUBLIC_AUTH = ["/login", "/signup", "/forgot-password"];

// UX-ONLY guard: decodes the JWT payload WITHOUT verifying the signature.
// Purpose: avoid a redirect flash for obviously-expired sessions.
// This is NOT a security gate. Firebase Hosting's CDN bypasses this middleware
// for static pages entirely. All real auth enforcement is in API routes via requireAuth().
function isSessionExpired(cookie: string): boolean {
  try {
    const payload = cookie.split(".")[1];
    if (!payload) return true;
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (!decoded.exp) return false;
    return decoded.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = req.cookies.get("__session")?.value;
  const hasValidSession = session && !isSessionExpired(session);

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isPublicAuth = PUBLIC_AUTH.some((p) => pathname.startsWith(p));

  if (isProtected && !hasValidSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (isPublicAuth && hasValidSession) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Root path: send authenticated users to dashboard, others to login
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(hasValidSession ? "/dashboard" : "/login", req.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/chat", "/p/:path*", "/login", "/signup", "/forgot-password"],
};
