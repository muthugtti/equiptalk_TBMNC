
import React from 'react';

export interface ChatMessage {
    id: string;
    speaker: 'User' | 'Bot';
    text: string;
}

interface ChatBubbleProps {
    message: ChatMessage;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
    const isUser = message.speaker === 'User';

    return (
        <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} animaterial-symbols-outlinedp`}>
            <div
                className={`
                    relative max-w-[85%] sm:max-w-[75%] px-5 py-3 rounded-2xl shadow-sm text-sm leading-relaxed
                    ${isUser
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-none'
                    }
                `}
            >
                <div className="font-medium mb-1 text-xs opacity-80 uppercase tracking-wide">
                    {isUser ? 'You' : 'EquipTalk AI'}
                </div>
                <div className="whitespace-pre-wrap">{message.text}</div>
            </div>
        </div>
    );
};
