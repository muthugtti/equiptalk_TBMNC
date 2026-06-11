"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface Message {
    id: string;
    role: "user" | "bot";
    text: string;
}

interface EquipmentInfo {
    id: string;
    name: string;
    type: string;
    model: string;
    status: string;
}

function ChatInterface() {
    const searchParams = useSearchParams();
    const equipmentId = searchParams.get("equipment") ?? "";

    const [equipment, setEquipment] = useState<EquipmentInfo | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [loadingEquipment, setLoadingEquipment] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!equipmentId) { setLoadingEquipment(false); return; }
        fetch(`/api/equipment/${equipmentId}`)
            .then(r => r.json())
            .then(data => { if (data?.id) setEquipment(data); })
            .catch(() => {})
            .finally(() => setLoadingEquipment(false));
    }, [equipmentId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const statusColor = (s: string) => {
        if (s === "OPERATIONAL") return "bg-green-100 text-green-700";
        if (s === "MAINTENANCE") return "bg-yellow-100 text-yellow-700";
        return "bg-red-100 text-red-700";
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading || !equipmentId) return;

        const userMsg: Message = { id: Date.now().toString(), role: "user", text: input.trim() };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        const botId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, { id: botId, role: "bot", text: "" }]);

        try {
            const history = messages.map(m => ({
                role: m.role === "user" ? "user" : "model",
                message: m.text,
            }));

            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ equipmentId, message: userMsg.text, history }),
            });

            if (!res.ok || !res.body) throw new Error(res.statusText);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let botText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                botText += decoder.decode(value, { stream: true });
                setMessages(prev =>
                    prev.map(m => m.id === botId ? { ...m, text: botText } : m)
                );
            }
        } catch {
            setMessages(prev =>
                prev.map(m => m.id === botId
                    ? { ...m, text: "Sorry, something went wrong. Please try again." }
                    : m)
            );
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    };

    if (!equipmentId) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <div className="text-center">
                    <span className="material-symbols-outlined text-5xl text-gray-300 mb-3 block">error_outline</span>
                    <p className="text-gray-600 font-medium">No equipment selected.</p>
                    <Link href="/dashboard/equipment" className="mt-4 inline-block text-blue-600 hover:underline text-sm">
                        Go to Equipment List
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Top bar */}
            <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1a1f37] text-white flex-shrink-0">
                    <span className="text-sm font-bold">Eq</span>
                </div>

                {loadingEquipment ? (
                    <div className="h-4 w-40 bg-gray-200 animate-pulse rounded" />
                ) : equipment ? (
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{equipment.name}</p>
                            <p className="text-xs text-gray-500 truncate">{equipment.type}{equipment.model ? ` · ${equipment.model}` : ""}</p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor(equipment.status)}`}>
                            {equipment.status}
                        </span>
                    </div>
                ) : (
                    <span className="text-gray-500 text-sm">Equipment not found</span>
                )}

                <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                    <span className="relative flex h-2 w-2 mr-1">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </span>
                    <span className="text-xs text-gray-500 hidden sm:inline">RAG · Gemini 2.0 Flash</span>
                    {equipment && (
                        <Link
                            href={`/dashboard/equipment/${equipmentId}`}
                            className="text-xs text-blue-600 hover:underline px-2 py-1 rounded border border-blue-200 bg-blue-50"
                        >
                            View Equipment
                        </Link>
                    )}
                </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
                {messages.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center h-full text-center pb-20">
                        <div className="w-16 h-16 rounded-2xl bg-[#1a1f37] flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined text-white text-3xl">smart_toy</span>
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 mb-2">
                            {equipment ? `${equipment.name} Assistant` : "Equipment Assistant"}
                        </h2>
                        <p className="text-gray-500 text-sm max-w-sm">
                            Ask anything about this equipment. I'll search the uploaded manuals and documents to give you accurate answers.
                        </p>
                        <div className="mt-6 flex flex-wrap gap-2 justify-center">
                            {["What are the maintenance intervals?", "How do I troubleshoot errors?", "What are the safety precautions?"].map(q => (
                                <button
                                    key={q}
                                    onClick={() => { setInput(q); inputRef.current?.focus(); }}
                                    className="text-sm px-3 py-2 rounded-full border border-gray-200 bg-white hover:border-blue-400 hover:text-blue-600 transition-colors text-gray-600"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        {msg.role === "bot" && (
                            <div className="w-7 h-7 rounded-full bg-[#1a1f37] flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                                <span className="material-symbols-outlined text-white text-sm">smart_toy</span>
                            </div>
                        )}
                        <div
                            className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                msg.role === "user"
                                    ? "bg-[#1a1f37] text-white rounded-br-none"
                                    : "bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm"
                            }`}
                        >
                            {msg.text || (
                                <span className="flex gap-1 items-center text-gray-400">
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                                </span>
                            )}
                        </div>
                    </div>
                ))}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-4">
                <div className="max-w-3xl mx-auto flex items-center gap-3">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                        placeholder={`Ask about ${equipment?.name ?? "this equipment"}…`}
                        disabled={isLoading}
                        className="flex-1 bg-gray-100 border-0 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="w-11 h-11 flex items-center justify-center bg-[#1a1f37] text-white rounded-full hover:bg-[#2a2f4a] disabled:opacity-40 transition-colors flex-shrink-0"
                    >
                        <span className="material-symbols-outlined text-sm">send</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ChatPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <ChatInterface />
        </Suspense>
    );
}
