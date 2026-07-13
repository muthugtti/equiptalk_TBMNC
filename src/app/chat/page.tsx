"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { markdownComponents } from "@/components/chat/markdownComponents";

interface Message {
    id: string;
    role: "user" | "bot";
    text: string;
}

interface SessionSummary {
    id: string;
    title: string;
    updatedAt: string;
    messageCount: number;
}

interface EquipmentInfo {
    id: string;
    name: string;
    type: string;
    model: string;
    status: string;
}

function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function ChatInterface() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const equipmentId = searchParams.get("equipment") ?? "";

    const [equipment, setEquipment] = useState<EquipmentInfo | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [loadingEquipment, setLoadingEquipment] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [authChecked, setAuthChecked] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sessions, setSessions] = useState<SessionSummary[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [suggestions, setSuggestions] = useState<string[] | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const sessionIdRef = useRef<string | null>(null);

    // Keep ref in sync so async save handlers always see current sessionId
    useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

    // Auth check — check in-memory first to avoid redirect loop after SPA login
    useEffect(() => {
        if (auth.currentUser) {
            setAuthChecked(true);
            return;
        }
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setAuthChecked(true);
            } else {
                const dest = equipmentId ? `/chat?equipment=${equipmentId}` : "/chat";
                router.push(`/login?from=${encodeURIComponent(dest)}`);
            }
        });
        return () => unsubscribe();
    }, [router, equipmentId]);

    // Load equipment info
    useEffect(() => {
        if (!authChecked) return;
        if (!equipmentId) { setLoadingEquipment(false); return; }
        fetch(`/api/equipment/${equipmentId}`)
            .then(r => r.json())
            .then(data => { if (data?.id) setEquipment(data); })
            .catch(() => {})
            .finally(() => setLoadingEquipment(false));
    }, [equipmentId, authChecked]);

    // Load session list and auto-restore most recent
    useEffect(() => {
        if (!authChecked || !equipmentId) return;
        setLoadingHistory(true);
        fetch(`/api/chat-sessions?equipmentId=${encodeURIComponent(equipmentId)}`)
            .then(r => r.json())
            .then(async data => {
                if (!data.sessions?.length) return;
                setSessions(data.sessions);
                const recent = data.sessions[0];
                const sd = await fetch(
                    `/api/chat-sessions?equipmentId=${encodeURIComponent(equipmentId)}&sessionId=${recent.id}`
                ).then(r => r.json());
                if (sd.session?.messages?.length > 0) {
                    setMessages(sd.session.messages.map((m: any, i: number) => ({
                        id: `r-${i}`,
                        role: m.role as "user" | "bot",
                        text: m.text,
                    })));
                    setSessionId(recent.id);
                }
            })
            .catch(() => {})
            .finally(() => setLoadingHistory(false));
    }, [authChecked, equipmentId]);

    // Load document-specific starter questions for this equipment. The API
    // derives them from the uploaded docs (cached server-side); if none are
    // available yet — no upload, or generation failed — we fall back to the
    // generic prompts below.
    useEffect(() => {
        if (!authChecked || !equipmentId) return;
        let cancelled = false;
        fetch(`/api/suggested-questions?equipmentId=${encodeURIComponent(equipmentId)}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!cancelled && data?.questions?.length) setSuggestions(data.questions);
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [authChecked, equipmentId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const GENERIC_SUGGESTIONS = [
        "What are the maintenance intervals?",
        "How do I troubleshoot errors?",
        "What are the safety precautions?",
    ];

    function saveSession(finalMessages: Message[]) {
        const payload = finalMessages.map(m => ({ role: m.role, text: m.text }));
        fetch("/api/chat-sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: sessionIdRef.current, equipmentId, messages: payload }),
        })
            .then(r => r.json())
            .then(data => {
                if (!data.sessionId) return;
                const isNew = data.sessionId !== sessionIdRef.current;
                setSessionId(data.sessionId);
                const title = finalMessages.find(m => m.role === "user")?.text.slice(0, 60) ?? "Chat";
                setSessions(prev => {
                    const updated: SessionSummary = {
                        id: data.sessionId,
                        title,
                        updatedAt: new Date().toISOString(),
                        messageCount: finalMessages.length,
                    };
                    if (isNew) return [updated, ...prev];
                    return prev.map(s => s.id === data.sessionId ? updated : s);
                });
            })
            .catch(() => {});
    }

    async function loadSession(s: SessionSummary) {
        const data = await fetch(
            `/api/chat-sessions?equipmentId=${encodeURIComponent(equipmentId)}&sessionId=${s.id}`
        ).then(r => r.json());
        if (data.session?.messages?.length > 0) {
            setMessages(data.session.messages.map((m: any, i: number) => ({
                id: `r-${i}-${s.id}`,
                role: m.role as "user" | "bot",
                text: m.text,
            })));
            setSessionId(s.id);
        }
        setShowHistory(false);
    }

    async function deleteSession(id: string, e: React.MouseEvent) {
        e.stopPropagation();
        await fetch(`/api/chat-sessions?sessionId=${id}`, { method: "DELETE" });
        setSessions(prev => prev.filter(s => s.id !== id));
        if (sessionIdRef.current === id) startNewChat();
    }

    function startNewChat() {
        setMessages([]);
        setSessionId(null);
        setShowHistory(false);
        setTimeout(() => inputRef.current?.focus(), 0);
    }

    const statusColor = (s: string) => {
        if (s === "OPERATIONAL") return "bg-green-100 text-green-700";
        if (s === "MAINTENANCE") return "bg-yellow-100 text-yellow-700";
        return "bg-red-100 text-red-700";
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading || !equipmentId) return;

        const userMsg: Message = { id: Date.now().toString(), role: "user", text: input.trim() };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
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
                setMessages(prev => prev.map(m => m.id === botId ? { ...m, text: botText } : m));
            }

            saveSession([...newMessages, { id: botId, role: "bot", text: botText }]);
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

    if (!authChecked) {
        return (
            <div className="flex h-screen flex-col bg-gray-50 animate-pulse">
                <div className="h-14 bg-white border-b border-gray-200" />
                <div className="flex-1 px-4 py-6 space-y-4 max-w-2xl mx-auto w-full">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                            <div className={`h-12 rounded-2xl bg-gray-200 ${i % 2 === 0 ? 'w-2/3' : 'w-1/2'}`} />
                        </div>
                    ))}
                </div>
                <div className="h-16 bg-white border-t border-gray-200" />
            </div>
        );
    }

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
        <div className="flex h-screen bg-gray-50 relative">
            {/* History drawer */}
            {showHistory && (
                <div className="fixed inset-0 z-20 flex">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setShowHistory(false)} />
                    <div className="relative z-10 w-72 bg-white shadow-xl flex flex-col h-full">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                            <span className="font-semibold text-gray-800 text-sm">Chat History</span>
                            <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600">
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>
                        <div className="px-3 py-2 border-b border-gray-100">
                            <button
                                onClick={startNewChat}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-blue-600 hover:bg-blue-50 transition-colors font-medium"
                            >
                                <span className="material-symbols-outlined text-base">add</span>
                                New Chat
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto py-2">
                            {sessions.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-8">No past sessions yet</p>
                            ) : (
                                sessions.map(s => (
                                    <div
                                        key={s.id}
                                        onClick={() => loadSession(s)}
                                        className={`group mx-2 px-3 py-2.5 rounded-lg cursor-pointer flex items-start justify-between gap-2 hover:bg-gray-50 transition-colors ${s.id === sessionId ? "bg-blue-50" : ""}`}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm text-gray-800 truncate">{s.title}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {timeAgo(s.updatedAt)} · {s.messageCount} msgs
                                            </p>
                                        </div>
                                        <button
                                            onClick={e => deleteSession(s.id, e)}
                                            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0 mt-0.5"
                                        >
                                            <span className="material-symbols-outlined text-sm">delete</span>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Main area */}
            <div className="flex flex-col flex-1 min-w-0">
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
                        <span className="text-gray-500 text-sm flex-1">Equipment not found</span>
                    )}

                    <div className="ml-auto flex items-center gap-1 flex-shrink-0">
                        <span className="relative flex h-2 w-2 mr-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                        </span>
                        <span className="text-xs text-gray-500 hidden sm:inline mr-2">RAG · Gemini 2.5 Flash</span>
                        <button
                            onClick={startNewChat}
                            title="New chat"
                            className="p-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                        >
                            <span className="material-symbols-outlined text-xl">add_comment</span>
                        </button>
                        <button
                            onClick={() => setShowHistory(v => !v)}
                            title="History"
                            className={`p-1.5 rounded-lg transition-colors relative ${showHistory ? "text-blue-600 bg-blue-50" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"}`}
                        >
                            <span className="material-symbols-outlined text-xl">history</span>
                            {sessions.length > 0 && (
                                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full" />
                            )}
                        </button>
                        {equipment && (
                            <Link
                                href={`/dashboard/equipment/${equipmentId}`}
                                className="ml-1 text-xs text-blue-600 hover:underline px-2 py-1 rounded border border-blue-200 bg-blue-50"
                            >
                                View Equipment
                            </Link>
                        )}
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-4 py-6">
                  {/* Constrain the message column to the same width as the input
                      below so they align. Full-width on mobile (< max-w-3xl),
                      centered readable column on desktop. */}
                  <div className="mx-auto w-full max-w-3xl min-h-full space-y-4">
                    {loadingHistory && messages.length === 0 ? (
                        <div className="space-y-4 animate-pulse">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`h-12 rounded-2xl bg-gray-200 dark:bg-gray-700 ${i % 2 === 0 ? 'w-2/3' : 'w-1/2'}`} />
                                </div>
                            ))}
                        </div>
                    ) : messages.length === 0 && !isLoading ? (
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
                                {(suggestions ?? GENERIC_SUGGESTIONS).map(q => (
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
                    ) : null}

                    {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                            {msg.role === "bot" && (
                                <div className="w-7 h-7 rounded-full bg-[#1a1f37] flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                                    <span className="material-symbols-outlined text-white text-sm">smart_toy</span>
                                </div>
                            )}
                            <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                msg.role === "user"
                                    ? "bg-[#1a1f37] text-white rounded-br-none"
                                    : "bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm"
                            }`}>
                                {!msg.text ? (
                                    <span className="flex gap-1 items-center text-gray-400">
                                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                                    </span>
                                ) : msg.role === "bot" ? (
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                        {msg.text}
                                    </ReactMarkdown>
                                ) : (
                                    <span className="whitespace-pre-wrap">{msg.text}</span>
                                )}
                            </div>
                        </div>
                    ))}

                    <div ref={messagesEndRef} />
                  </div>
                </div>

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
                            className="flex-1 bg-gray-100 dark:bg-gray-800 border-0 rounded-full px-5 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
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
        </div>
    );
}

export default function ChatPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen flex-col bg-gray-50 animate-pulse">
                <div className="h-14 bg-white border-b border-gray-200" />
                <div className="flex-1 px-4 py-6 space-y-4 max-w-2xl mx-auto w-full">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                            <div className={`h-12 rounded-2xl bg-gray-200 ${i % 2 === 0 ? 'w-2/3' : 'w-1/2'}`} />
                        </div>
                    ))}
                </div>
                <div className="h-16 bg-white border-t border-gray-200" />
            </div>
        }>
            <ChatInterface />
        </Suspense>
    );
}
