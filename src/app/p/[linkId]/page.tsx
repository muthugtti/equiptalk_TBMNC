"use client";

import { useState, useRef, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "@/components/chat/markdownComponents";
import { typeStream } from "@/lib/stream-typewriter";
import FeedbackBar from "@/components/chat/FeedbackBar";

interface Message {
    id: string;
    role: "user" | "bot";
    text: string;
}

interface PublicEquipmentInfo {
    name: string;
    type: string;
    model: string;
    status: string;
}

export default function PublicChatPage({ params }: { params: Promise<{ linkId: string }> }) {
    const { linkId } = use(params);
    const router = useRouter();
    const loginHref = `/login?from=${encodeURIComponent(`/p/${linkId}`)}`;

    const [authChecked, setAuthChecked] = useState(false);
    const [equipment, setEquipment] = useState<PublicEquipmentInfo | null>(null);
    const [loadingEquipment, setLoadingEquipment] = useState(true);
    const [notAvailable, setNotAvailable] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Demo launch: QR/Open Chat is behind login. Redirect anonymous visitors to
    // the login page (with a return path) before loading any equipment data.
    // This backstops the middleware for the CDN-bypass edge case.
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, user => {
            if (!user) {
                router.replace(loginHref);
            } else {
                setAuthChecked(true);
            }
        });
        return () => unsub();
    }, [loginHref, router]);

    // Load equipment info once the user is confirmed logged in. 404 => disabled/unknown.
    useEffect(() => {
        if (!authChecked) return;
        let cancelled = false;
        fetch(`/api/public/equipment?linkId=${encodeURIComponent(linkId)}`)
            .then(async r => {
                // Session cookie can expire while the Firebase client still
                // reports a signed-in user. Send them back to login rather than
                // the misleading "link not available" screen.
                if (r.status === 401) { if (!cancelled) router.replace(loginHref); return null; }
                if (!r.ok) { if (!cancelled) setNotAvailable(true); return null; }
                return r.json();
            })
            .then(data => { if (data && !cancelled) setEquipment(data); })
            .catch(() => { if (!cancelled) setNotAvailable(true); })
            .finally(() => { if (!cancelled) setLoadingEquipment(false); });
        return () => { cancelled = true; };
    }, [linkId, authChecked, loginHref, router]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const statusColor = (s: string) => {
        if (s === "OPERATIONAL") return "bg-green-100 text-green-700";
        if (s === "MAINTENANCE") return "bg-yellow-100 text-yellow-700";
        return "bg-red-100 text-red-700";
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

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

            const res = await fetch("/api/public/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ linkId, message: userMsg.text, history }),
            });

            if (res.status === 401) { router.replace(loginHref); return; }
            if (!res.ok || !res.body) throw new Error(res.statusText);

            await typeStream(res, text =>
                setMessages(prev => prev.map(m => m.id === botId ? { ...m, text } : m))
            );
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

    if (loadingEquipment) {
        return (
            <div className="flex h-screen flex-col bg-gray-50 animate-pulse">
                <div className="h-14 bg-white border-b border-gray-200" />
                <div className="flex-1 px-4 py-6 space-y-4 max-w-2xl mx-auto w-full">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                            <div className={`h-12 rounded-2xl bg-gray-200 ${i % 2 === 0 ? "w-2/3" : "w-1/2"}`} />
                        </div>
                    ))}
                </div>
                <div className="h-16 bg-white border-t border-gray-200" />
            </div>
        );
    }

    if (notAvailable || !equipment) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
                <div className="text-center max-w-sm">
                    <span className="material-symbols-outlined text-5xl text-gray-300 mb-3 block">link_off</span>
                    <p className="text-gray-800 font-semibold">This chat link isn&apos;t available.</p>
                    <p className="text-gray-500 text-sm mt-1">
                        The QR code may be disabled or invalid. Please contact the equipment owner.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-50">
            <div className="flex flex-col flex-1 min-w-0">
                <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1a1f37] text-white flex-shrink-0">
                        <span className="text-sm font-bold">Eq</span>
                    </div>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{equipment.name}</p>
                            <p className="text-xs text-gray-500 truncate">
                                {equipment.type}{equipment.model ? ` · ${equipment.model}` : ""}
                            </p>
                        </div>
                        {equipment.status && (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor(equipment.status)}`}>
                                {equipment.status}
                            </span>
                        )}
                    </div>
                    <span className="text-xs text-gray-400 hidden sm:inline">AI Assistant</span>
                </header>

                <div className="flex-1 overflow-y-auto px-4 py-6">
                  {/* Constrain the message column to the same width as the input
                      below so they align. Full-width on mobile (< max-w-3xl),
                      centered readable column on desktop. */}
                  <div className="mx-auto w-full max-w-3xl min-h-full space-y-4">
                    {messages.length === 0 && !isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-center pb-20">
                            <div className="w-16 h-16 rounded-2xl bg-[#1a1f37] flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-white text-3xl">smart_toy</span>
                            </div>
                            <h2 className="text-xl font-bold text-gray-800 mb-2">{equipment.name} Assistant</h2>
                            <p className="text-gray-500 text-sm max-w-sm">
                                Ask anything about this equipment. Answers come from the uploaded manuals and documents.
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
                    ) : null}

                    {messages.map((msg, idx) => {
                        const prevUserText = msg.role === "bot"
                            ? messages.slice(0, idx).reverse().find(m => m.role === "user")?.text ?? ""
                            : "";
                        return (
                        <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                            {msg.role === "bot" && (
                                <div className="w-7 h-7 rounded-full bg-[#1a1f37] flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                                    <span className="material-symbols-outlined text-white text-sm">smart_toy</span>
                                </div>
                            )}
                            <div className="flex flex-col max-w-[75%]">
                                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
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
                                {msg.role === "bot" && msg.text && !isLoading && (
                                    <FeedbackBar linkId={linkId} question={prevUserText} answer={msg.text} />
                                )}
                            </div>
                        </div>
                        );
                    })}
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
                            placeholder={`Ask about ${equipment.name}…`}
                            disabled={isLoading}
                            className="flex-1 bg-gray-100 border-0 rounded-full px-5 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className="w-11 h-11 flex items-center justify-center bg-[#1a1f37] text-white rounded-full hover:bg-[#2a2f4a] disabled:opacity-40 transition-colors flex-shrink-0"
                        >
                            <span className="material-symbols-outlined text-sm">send</span>
                        </button>
                    </div>
                    <p className="text-center text-[11px] text-gray-400 mt-2">Powered by EquipTalk AI</p>
                </div>
            </div>
        </div>
    );
}
