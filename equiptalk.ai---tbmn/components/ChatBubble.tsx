

import React from 'react';
import { type ChatMessage, Speaker } from '../types';
import { BotIcon, UserIcon, LoadingSpinner } from './IconComponents';

interface ChatBubbleProps {
  message: ChatMessage;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isBot = message.speaker === Speaker.Bot;

  const bubbleClasses = isBot
    ? 'bg-gray-700 text-gray-200 self-start'
    : 'bg-red-700 text-white self-end';
  
  const containerClasses = isBot ? 'justify-start' : 'justify-end';

  const Icon = isBot ? BotIcon : UserIcon;

  return (
    <div className={`flex items-start gap-3 w-full max-w-2xl mx-auto ${containerClasses}`}>
      {isBot && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
          <Icon className="w-5 h-5 text-red-400" />
        </div>
      )}
      <div className={`rounded-xl p-4 shadow-md ${bubbleClasses}`}>
        {message.text === 'Thinking...' ? (
          <div className="flex items-center gap-2">
            <LoadingSpinner className="w-5 h-5" />
            <p>Thinking...</p>
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{message.text}</p>
        )}
      </div>
      {!isBot && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
          <Icon className="w-5 h-5 text-gray-300" />
        </div>
      )}
    </div>
  );
};
