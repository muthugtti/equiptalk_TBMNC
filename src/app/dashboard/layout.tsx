import DashboardShell from "@/components/dashboard/DashboardShell";

// Render dashboard routes dynamically (per-request via Cloud Run) instead of
// as CDN-cached static prerenders. This removes the `Cache-Control: max-age=3600`
// that left returning users on stale JS for up to an hour after a deploy, and
// means the middleware (src/proxy.ts) actually runs for these routes instead of
// being bypassed by the Fastly CDN. Applies to every route nested under
// /dashboard. Auth is still enforced by the API layer and client guards.
export const dynamic = "force-dynamic";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <DashboardShell>{children}</DashboardShell>;
}
