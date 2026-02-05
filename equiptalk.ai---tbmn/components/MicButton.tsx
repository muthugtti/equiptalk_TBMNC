

import React from 'react';
import { MicIcon, StopIcon } from './IconComponents';

interface MicButtonProps {
  isSessionActive: boolean;
  isLoading: boolean;
  onStart: () => void;
  onStop: () => void;
}

export const MicButton: React.FC<MicButtonProps> = ({ isSessionActive, isLoading, onStart, onStop }) => {
  const isDisabled = isLoading;

  const handleClick = () => {
    if (isSessionActive) {
      onStop();
    } else {
      onStart();
    }
  };
  
  const getButtonClass = () => {
    if (isSessionActive) return 'bg-red-500 hover:bg-red-600 animate-pulse';
    if (isDisabled) return 'bg-gray-600 cursor-not-allowed';
    return 'bg-red-600 hover:bg-red-700';
  };

  const getButtonText = () => {
    if (isSessionActive) return 'Tap to Stop';
    if (isLoading) return 'Processing...';
    return 'Tap to Speak';
  }

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out shadow-lg transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-opacity-50 ${getButtonClass()} ${isDisabled ? 'focus:ring-gray-500' : 'focus:ring-red-400'}`}
        aria-label={getButtonText()}
      >
        {isSessionActive ? (
          <StopIcon className="w-8 h-8 text-white" />
        ) : (
          <MicIcon className="w-8 h-8 text-white" />
        )}
      </button>
      <p className="mt-2 text-sm text-gray-400">{getButtonText()}</p>
    </div>
  );
};
