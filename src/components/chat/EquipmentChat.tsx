
import React, { useState, useRef, useEffect } from 'react';
import { ChatBubble, ChatMessage } from './ChatBubble';

interface EquipmentChatProps {
    equipmentId: string;
}

export default function EquipmentChat({ equipmentId }: EquipmentChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            speaker: 'User',
            text: input.trim()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    equipmentId,
                    message: userMessage.text,
                    history: messages.map(m => ({
                        role: m.speaker === 'User' ? 'user' : 'model',
                        message: m.text
                    }))
                })
            });

            if (!response.ok) throw new Error(response.statusText);
            if (!response.body) throw new Error("No response body");

            // Prepare bot message placeholder
            const botMessageId = (Date.now() + 1).toString();
            setMessages(prev => [...prev, { id: botMessageId, speaker: 'Bot', text: '' }]);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let botText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                botText += chunk;

                setMessages(prev => prev.map(msg =>
                    msg.id === botMessageId ? { ...msg, text: botText } : msg
                ));
            }

        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                speaker: 'Bot',
                text: "Sorry, I encountered an error. Please try again."
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[600px] bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600">smart_toy</span>
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100">Equipment Assistant</h3>
                </div>
                <div className="text-xs text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    Gemini 1.5 Flash
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
                        <span className="material-symbols-outlined text-4xl">chat</span>
                        <p className="text-sm">Ask questions about this equipment's manuals.</p>
                    </div>
                )}

                {messages.map(msg => (
                    <ChatBubble key={msg.id} message={msg} />
                ))}

                {isLoading && messages[messages.length - 1]?.speaker === 'User' && (
                    <div className="flex justify-start w-full animate-pulse">
                        <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl rounded-bl-none px-5 py-3 text-gray-500 text-sm">
                            Thinking...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                <div className="relative flex items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                        placeholder="Ask a question..."
                        disabled={isLoading}
                        className="w-full bg-gray-100 dark:bg-gray-900 border-0 rounded-full pl-5 pr-12 py-3 focus:ring-2 focus:ring-blue-500 dark:text-white"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">send</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
