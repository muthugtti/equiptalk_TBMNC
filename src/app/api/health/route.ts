import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        console.log("Health check called");

        // Check env vars without crashing
        const dbUrl = process.env.DATABASE_URL;
        const isConfigured = !!dbUrl;

        return NextResponse.json({
            status: "online",
            mode: "safe_mode",
            env: {
                databaseUrlConfigured: isConfigured,
                databaseUrlLength: dbUrl ? dbUrl.length : 0,
                nodeEnv: process.env.NODE_ENV,
            },
            message: "Database check skipped to prevent crash."
        });
    } catch (error) {
        return NextResponse.json({
            status: "error",
            error: String(error)
        }, { status: 500 });
    }
}
