"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

interface QRCodeCardProps {
    chatUrl: string;
    equipmentName: string;
}

export default function QRCodeCard({ chatUrl, equipmentName }: QRCodeCardProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [copied, setCopied] = useState(false);

    function handleCopy() {
        navigator.clipboard.writeText(chatUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }

    function handleDownload() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const url = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = `${equipmentName.replace(/[^a-z0-9]/gi, "_")}_QR.png`;
        a.click();
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {/* URL + actions */}
            <div className="md:col-span-2 space-y-4">
                <div>
                    <label className="font-semibold text-sm text-gray-900 dark:text-white">
                        Unique Chat Link
                    </label>
                    <div className="mt-2 flex items-center gap-2">
                        <input
                            type="text"
                            value={chatUrl}
                            readOnly
                            className="w-full flex-grow rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-primary focus:ring-primary px-4 py-2.5 text-sm font-mono"
                        />
                        <button
                            onClick={handleCopy}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            title="Copy link"
                        >
                            <span className="material-symbols-outlined text-xl">
                                {copied ? "check" : "content_copy"}
                            </span>
                        </button>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        Share this link or print the QR code — technicians can scan it to instantly chat with the AI about this equipment.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                    <button
                        onClick={handleDownload}
                        className="flex cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-4 bg-primary/20 dark:bg-primary/30 text-primary text-sm font-bold tracking-wide hover:bg-primary/30 dark:hover:bg-primary/40"
                    >
                        <span className="material-symbols-outlined text-xl">download</span>
                        <span>Download QR Code</span>
                    </button>
                    <button
                        onClick={() => window.open(chatUrl, "_blank")}
                        className="flex cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-4 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white text-sm font-bold tracking-wide hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                        <span className="material-symbols-outlined text-xl">open_in_new</span>
                        <span>Open Chat</span>
                    </button>
                </div>
            </div>

            {/* QR code */}
            <div className="flex flex-col items-center justify-center text-center">
                <div className="bg-white p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <QRCodeCanvas
                        ref={canvasRef}
                        value={chatUrl}
                        size={140}
                        level="M"
                        imageSettings={{
                            src: "/favicon.ico",
                            height: 24,
                            width: 24,
                            excavate: true,
                        }}
                    />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Scan to open the AI chat
                </p>
            </div>
        </div>
    );
}
