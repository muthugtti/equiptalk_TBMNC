
import React from 'react';

interface WelcomeScreenProps {
  onSuggestionClick: (text: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSuggestionClick }) => {
  return (
    <div className="flex flex-col space-y-6 animate-fade-in pb-24 pt-4">
      {/* Equiptalk Assistant Section */}
      <section className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-primary opacity-5 rounded-full blur-3xl"></div>
        <div className="relative z-10 text-center space-y-4">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-2">
            <span className="material-icons text-primary text-2xl">smart_toy</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Equiptalk Assistant</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your expert guide to the Cathode Production Line.</p>
          </div>
          <div className="text-left bg-gray-50 dark:bg-surface-darker/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700/50">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 ml-1 uppercase tracking-wider">Suggested Queries</p>
            <ul className="space-y-2">
              <li>
                <button onClick={() => onSuggestionClick("What defects are common in coating?")} className="w-full text-left flex items-center justify-between p-2.5 rounded-lg hover:bg-white dark:hover:bg-surface-dark border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-all group">
                  <span className="text-sm text-gray-700 dark:text-gray-300">What defects are common in coating?</span>
                  <span className="material-icons-outlined text-xs text-gray-400 group-hover:text-primary transition-colors">arrow_forward</span>
                </button>
              </li>
              <li>
                <button onClick={() => onSuggestionClick("Why is vacuum drying necessary?")} className="w-full text-left flex items-center justify-between p-2.5 rounded-lg hover:bg-white dark:hover:bg-surface-dark border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-all group">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Why is vacuum drying necessary?</span>
                  <span className="material-icons-outlined text-xs text-gray-400 group-hover:text-primary transition-colors">arrow_forward</span>
                </button>
              </li>
              <li>
                <button onClick={() => onSuggestionClick("Explain the purpose of calendering")} className="w-full text-left flex items-center justify-between p-2.5 rounded-lg hover:bg-white dark:hover:bg-surface-dark border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-all group">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Explain the purpose of calendering</span>
                  <span className="material-icons-outlined text-xs text-gray-400 group-hover:text-primary transition-colors">arrow_forward</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Hint */}
      <div className="flex items-center justify-center space-x-2 animate-pulse pt-4">
         <span className="text-xs text-accent-text font-medium">Tap the microphone to speak</span>
         <span className="material-icons text-accent-text text-sm">mic</span>
      </div>
    </div>
  );
};
