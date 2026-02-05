
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Chat, Content, LiveServerMessage } from '@google/genai';
import { createChatSession, connectToLiveSession, generateTts } from './services/geminiService';
import { type ChatMessage, Speaker, type Blob } from './types';
import { ChatBubble } from './components/ChatBubble';
import { WelcomeScreen } from './components/WelcomeScreen';
import { DashboardMetrics } from './components/DashboardMetrics';
import { decode, decodeAudioData, createBlob } from './utils/audio';

const CHAT_HISTORY_KEY = 'equip-talk-history';

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
        const savedHistory = window.localStorage.getItem(CHAT_HISTORY_KEY);
        return savedHistory ? JSON.parse(savedHistory) : [];
    } catch (error) {
        console.error("Failed to load chat history from localStorage", error);
        return [];
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [textInput, setTextInput] = useState<string>('');
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const chatRef = useRef<Chat | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Refs for Live API session and audio management
  const sessionPromiseRef = useRef<ReturnType<typeof connectToLiveSession> | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const ttsAudioContextRef = useRef<AudioContext | null>(null);
  const ttsSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextAudioStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const tempUserTranscriptRef = useRef<string>('');
  const tempBotTranscriptRef = useRef<string>('');
  
  // Ref to prevent race conditions when clearing history
  const isResettingRef = useRef<boolean>(false);

  useEffect(() => {
    try {
      if (messages.length > 0) {
        window.localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
      } else {
        window.localStorage.removeItem(CHAT_HISTORY_KEY);
      }
    } catch (err) {
      console.error("Failed to save chat history to localStorage", err);
    }
  }, [messages]);


  useEffect(() => {
    const mapMessagesToHistory = (msgs: ChatMessage[]): Content[] => {
        return msgs.map(msg => ({
            role: msg.speaker === Speaker.User ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));
    };
    
    const initialHistory = mapMessagesToHistory(messages);
    chatRef.current = createChatSession(initialHistory);

    return () => {
      stopLiveSession();
      if (ttsAudioContextRef.current) {
        ttsAudioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, liveTranscript, isLoading]);

  const stopAudioPlayback = useCallback(() => {
    // Stop TTS
    if (ttsSourceRef.current) {
        try {
            ttsSourceRef.current.stop();
        } catch (e) {
            // ignore if already stopped
        }
        ttsSourceRef.current = null;
    }
    setIsSpeaking(false);

    // Stop Live Audio Sources
    if (audioSourcesRef.current.size > 0) {
        audioSourcesRef.current.forEach(source => {
            try {
                source.stop();
            } catch (e) {
                // ignore
            }
        });
        audioSourcesRef.current.clear();
    }
    nextAudioStartTimeRef.current = 0;
  }, []);

  const toggleMute = () => {
      if (!isMuted) {
          stopAudioPlayback();
      }
      setIsMuted(prev => !prev);
  };
  
  const stopLiveSession = useCallback(() => {
    setIsSessionActive(false);
    setLiveTranscript('');
    stopAudioPlayback();
    
    // Clear transcript buffers to prevent old text from reappearing
    tempUserTranscriptRef.current = '';
    tempBotTranscriptRef.current = '';
    
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => {
            session.close();
        }).catch(() => {});
        sessionPromiseRef.current = null;
    }

    if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
    }
    
    if (inputAudioContextRef.current) {
        inputAudioContextRef.current.close();
        inputAudioContextRef.current = null;
    }
    
    if (outputAudioContextRef.current) {
        outputAudioContextRef.current.close();
        outputAudioContextRef.current = null;
    }
    
    audioSourcesRef.current.clear();
  }, [stopAudioPlayback]);

  const handleClearHistory = useCallback(() => {
      if (window.confirm("Are you sure you want to clear the chat history?")) {
        // Set resetting flag to true to block incoming async messages
        isResettingRef.current = true;

        // Stop any active live session
        if (isSessionActive) {
            stopLiveSession();
        }
        
        // Stop audio playback immediately
        stopAudioPlayback();
        
        // Clear references that might hold stale data
        tempUserTranscriptRef.current = '';
        tempBotTranscriptRef.current = '';
        
        // Clear all UI state
        setMessages([]);
        setLiveTranscript('');
        setTextInput('');
        setError('');
        setIsLoading(false);
        setIsSpeaking(false);
        
        // Reset the chat session to forget previous context
        chatRef.current = createChatSession([]);
        
        // Ensure localStorage is cleared immediately
        window.localStorage.removeItem(CHAT_HISTORY_KEY);

        // Reset the flag after a short delay to allow state updates to settle
        setTimeout(() => {
            isResettingRef.current = false;
        }, 100);
      }
  }, [isSessionActive, stopLiveSession, stopAudioPlayback]);
  
  const playTtsAudio = async (base64Audio: string) => {
    if (isMuted || isResettingRef.current) return;

    try {
        stopAudioPlayback(); // Stop any previous audio

        if (!ttsAudioContextRef.current) {
            ttsAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        
        // Resume if suspended (browser policy)
        if (ttsAudioContextRef.current.state === 'suspended') {
            await ttsAudioContextRef.current.resume();
        }

        const audioBuffer = await decodeAudioData(decode(base64Audio), ttsAudioContextRef.current, 24000, 1);
        const source = ttsAudioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ttsAudioContextRef.current.destination);
        
        source.onended = () => {
            setIsSpeaking(false);
            ttsSourceRef.current = null;
        };

        ttsSourceRef.current = source;
        setIsSpeaking(true);
        source.start();
    } catch (err) {
        console.error("Error playing TTS audio:", err);
        setIsSpeaking(false);
    }
  };

  const handleUserTextMessage = async (text: string) => {
      if (!text || isLoading || isSessionActive || isResettingRef.current) return;

      stopAudioPlayback(); // Ensure silence before new request

      const newUserMessage: ChatMessage = { id: Date.now().toString(), speaker: Speaker.User, text };
      setMessages(prev => [...prev, newUserMessage]);
      setTextInput(''); // Clear input
      setIsLoading(true);

      const currentChatSession = chatRef.current; // Capture current session reference

      try {
        if (!currentChatSession) {
            throw new Error("Chat session not initialized.");
        }
        const result = await currentChatSession.sendMessage({ message: text });
        
        // Check if the chat session has been reset (e.g. via Clear History) while we were waiting
        if (chatRef.current !== currentChatSession || isResettingRef.current) {
            return;
        }

        const botResponseText = result.text;
        
        const newBotMessage: ChatMessage = { id: (Date.now() + 1).toString(), speaker: Speaker.Bot, text: botResponseText || "I didn't have a response." };
        setMessages(prev => [...prev, newBotMessage]);

      } catch (err) {
        // If session was reset, ignore errors from old session
        if (chatRef.current !== currentChatSession || isResettingRef.current) {
            return;
        }

        console.error("Gemini API error:", err);
        const errorBotMessage: ChatMessage = { id: (Date.now() + 1).toString(), speaker: Speaker.Bot, text: "I'm sorry, I encountered an error. Please try again." };
        setMessages(prev => [...prev, errorBotMessage]);
      } finally {
         // Only turn off loading if we are still on the same session
         if (chatRef.current === currentChatSession && !isResettingRef.current) {
            setIsLoading(false);
         }
      }
  };

  const handleLiveMessage = async (message: LiveServerMessage) => {
    // If we are in the middle of clearing history, ignore any incoming messages
    if (isResettingRef.current) return;

    if (message.serverContent?.outputTranscription) {
        tempBotTranscriptRef.current += message.serverContent.outputTranscription.text;
    } else if (message.serverContent?.inputTranscription) {
        tempUserTranscriptRef.current += message.serverContent.inputTranscription.text;
    }

    setLiveTranscript(`You: ${tempUserTranscriptRef.current}\nAI: ${tempBotTranscriptRef.current}`);

    if (message.serverContent?.turnComplete) {
        const userMessage = tempUserTranscriptRef.current.trim();
        const botMessage = tempBotTranscriptRef.current.trim();

        if (userMessage) {
            setMessages(prev => [...prev, { id: Date.now().toString(), speaker: Speaker.User, text: userMessage }]);
        }
        if (botMessage) {
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), speaker: Speaker.Bot, text: botMessage }]);
        }

        tempUserTranscriptRef.current = '';
        tempBotTranscriptRef.current = '';
        setLiveTranscript('');
    }

    // Safely extract audio data with full optional chaining to prevent crashes
    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    
    if (base64Audio && outputAudioContextRef.current && !isMuted) {
        nextAudioStartTimeRef.current = Math.max(nextAudioStartTimeRef.current, outputAudioContextRef.current.currentTime);
        const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
        const source = outputAudioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputAudioContextRef.current.destination);
        
        source.addEventListener('ended', () => {
            audioSourcesRef.current.delete(source);
        });

        source.start(nextAudioStartTimeRef.current);
        nextAudioStartTimeRef.current += audioBuffer.duration;
        audioSourcesRef.current.add(source);
    }
    
    if (message.serverContent?.interrupted) {
        stopAudioPlayback();
    }
  };

  const startLiveSession = useCallback(async () => {
    setError('');
    setIsSessionActive(true);
    setLiveTranscript('Connecting...');
    stopAudioPlayback(); // Stop any running TTS

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;

        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioSourcesRef.current = new Set();
        nextAudioStartTimeRef.current = 0;

        sessionPromiseRef.current = connectToLiveSession({
            onopen: () => {
                setLiveTranscript('Listening...');
                if (!inputAudioContextRef.current || !micStreamRef.current) return;
                
                sourceNodeRef.current = inputAudioContextRef.current.createMediaStreamSource(micStreamRef.current);
                scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                
                scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                    if (isResettingRef.current) return; // Don't process audio if resetting
                    const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                    const pcmBlob: Blob = createBlob(inputData);
                    sessionPromiseRef.current?.then((session) => {
                        session.sendRealtimeInput({ media: pcmBlob });
                    });
                };

                sourceNodeRef.current.connect(scriptProcessorRef.current);
                scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
            },
            onmessage: handleLiveMessage,
            onerror: (e: ErrorEvent) => {
                console.error('Live session error:', e);
                setError('A connection error occurred.');
                stopLiveSession();
            },
            onclose: (e: CloseEvent) => {
                stopLiveSession();
            },
        });

    } catch (err) {
        console.error('Failed to start live session:', err);
        setError('Could not access microphone. Please grant permission and try again.');
        setIsSessionActive(false);
        setLiveTranscript('');
    }
  }, []);

  const handleMicClick = () => {
      if (isSessionActive) {
          stopLiveSession();
      } else {
          startLiveSession();
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleUserTextMessage(textInput);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-background-light dark:bg-background-dark text-gray-900 dark:text-gray-100 font-display overflow-hidden relative">
      {/* Header */}
      <header className="relative flex items-center justify-between px-4 py-3 bg-white dark:bg-surface-darker border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
        {/* Left: Brand Badge */}
        <div className="flex items-center z-10">
            <div className="flex items-center bg-white px-1.5 py-0.5 rounded border border-gray-300 shrink-0">
                <span className="text-primary font-bold text-[10px] tracking-wider">TOYOTA</span>
            </div>
        </div>
        
        {/* Centered Title */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="font-bold text-gray-900 dark:text-white text-lg truncate px-20">TBMNC - Cathode - L1-EL-CA</span>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center space-x-2 shrink-0 z-10">
            <div className="flex items-center space-x-1 mr-1">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse"></span>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:inline">Online</span>
            </div>
            
            <button 
                onClick={handleClearHistory}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                title="Clear Chat History"
            >
                <span className="material-icons-outlined text-gray-600 dark:text-gray-300">delete</span>
            </button>

            <button 
                onClick={toggleMute}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title={isMuted ? "Unmute" : "Mute"}
            >
                <span className="material-icons-outlined text-gray-600 dark:text-gray-300">
                    {isMuted ? 'volume_off' : 'volume_up'}
                </span>
            </button>
            <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors hidden sm:block">
                <span className="material-icons-outlined text-gray-600 dark:text-gray-300">notifications</span>
            </button>
            <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <span className="material-icons-outlined text-gray-600 dark:text-gray-300">account_circle</span>
            </button>
        </div>
      </header>

      {/* Persistent Metrics Dashboard */}
      <DashboardMetrics />

      {/* Main Content Area */}
      <main 
        className="flex-grow overflow-y-auto px-4 py-6 space-y-6 pb-[26rem] scroll-smooth"
        ref={chatContainerRef}
      >
        <div className="max-w-2xl mx-auto w-full">
            {messages.length === 0 && !liveTranscript ? (
                <WelcomeScreen onSuggestionClick={handleUserTextMessage} />
            ) : (
                <div className="space-y-6 w-full">
                    {messages.map((msg) => (
                        <ChatBubble key={msg.id} message={msg} />
                    ))}

                    {liveTranscript && (
                        <div className="flex flex-col gap-2 w-full opacity-75">
                            <p className="text-xs text-gray-400 font-mono uppercase tracking-wide">Live Transcript</p>
                            <div className="bg-gray-800/50 p-4 rounded-xl border border-primary/30 animate-pulse">
                                <p className="whitespace-pre-wrap font-mono text-sm">{liveTranscript}</p>
                            </div>
                        </div>
                    )}
                    
                    {isLoading && !liveTranscript && (
                        <div className="flex justify-start w-full">
                            <div className="bg-gray-700 text-gray-200 rounded-xl p-4 shadow-md flex items-center gap-2">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                        </div>
                    )}
                    
                    {/* Floating Stop Reading Button (visible when scrolling in chat) */}
                    {isSpeaking && !isSessionActive && (
                        <div className="flex justify-center w-full sticky bottom-4 z-30 pointer-events-none">
                            <button 
                                onClick={stopAudioPlayback}
                                className="pointer-events-auto flex items-center gap-2 bg-primary hover:bg-red-700 text-white px-4 py-2 rounded-full shadow-lg transition-all animate-bounce-in"
                            >
                                <span className="material-icons text-sm">stop_circle</span>
                                <span className="text-sm font-semibold">Stop Reading</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
      </main>

      {/* Footer / Interaction Area */}
      <div className="absolute bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-background-light via-background-light to-transparent dark:from-background-dark dark:via-background-dark pt-20 pb-6 px-4">
        
        <div className="max-w-2xl mx-auto w-full flex flex-col items-center">
            
            {/* Mic Button Section */}
            <div className="flex flex-col items-center mb-6 animate-fade-in-up">
                 <button 
                    onClick={handleMicClick}
                    disabled={isLoading && !isSessionActive}
                    className={`
                        flex items-center justify-center w-20 h-20 rounded-full shadow-2xl text-white transition-all duration-300
                        ${isSessionActive 
                            ? 'bg-primary scale-110 animate-pulse ring-4 ring-primary/30' 
                            : 'bg-primary hover:scale-105 active:scale-95 hover:shadow-primary/40'
                        }
                        ${isLoading && !isSessionActive ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                >
                    <span className="material-icons text-3xl">
                        {isSessionActive ? 'stop' : 'mic'}
                    </span>
                </button>
                
                {/* Label Badge */}
                <div className="mt-4 bg-black/90 dark:bg-black text-white text-[10px] font-bold px-3 py-1.5 rounded-md uppercase tracking-[0.2em] shadow-lg border border-gray-800">
                    {isSessionActive ? 'Tap to Stop' : 'Tap to Speak'}
                </div>
            </div>

            {/* Input Bar */}
            <div className="w-full relative">
                <input 
                    className="w-full bg-white dark:bg-[#1a212e] border border-gray-200 dark:border-gray-700 rounded-full py-4 px-6 pr-12 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder-gray-500 shadow-sm transition-all" 
                    placeholder="Type a message..."
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isSessionActive || isLoading}
                />
                <button 
                    onClick={() => handleUserTextMessage(textInput)}
                    disabled={!textInput.trim() || isSessionActive || isLoading}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 rounded-full text-gray-400 hover:text-primary dark:text-gray-500 dark:hover:text-primary transition-colors disabled:opacity-50"
                >
                    <span className="material-icons text-xl">send</span>
                </button>
            </div>
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-red-900/90 text-white px-6 py-3 rounded-lg shadow-xl border border-red-500 animate-fade-in-down z-50">
          {error}
        </div>
      )}
    </div>
  );
};

export default App;
