import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const dbUrl = process.env.DATABASE_URL;
        const isConfigured = !!dbUrl;

        // Try to connect
        let connectionStatus = "UNKNOWN";
        let errorDetails = null;

        try {
            await prisma.$queryRaw`SELECT 1`;
            connectionStatus = "OK";
        } catch (e: any) {
            connectionStatus = "FAILED";
            errorDetails = e.message;
        }

        return NextResponse.json({
            status: "online",
            env: {
                databaseUrlConfigured: isConfigured,
                nodeEnv: process.env.NODE_ENV,
            },
            database: {
                status: connectionStatus,
                error: errorDetails
            }
        });
    } catch (error) {
        return NextResponse.json({
            status: "error",
            error: String(error)
        }, { status: 500 });
    }
}
