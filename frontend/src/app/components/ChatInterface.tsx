'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import { FeedbackPanel } from './FeedbackPanel';
import { PaperAirplaneIcon, MicrophoneIcon, StopIcon, PlusCircleIcon, PencilIcon, UserCircleIcon } from '@heroicons/react/24/solid';
import { cn } from '@/lib/utils';
import { ContextSettings } from '@/types';
import { Sidebar } from './Sidebar';

interface Contact {
  phoneNumber: string;
  alias?: string;
  avatar?: string;
}

interface Message {
  text: string;
  isUser: boolean;
  id?: string;
  timestamp?: string;
}

interface Feedback {
  text: string;
  score: number;
  explanation: string;
}

interface PracticeResponse {
  response: string;
  feedback: Feedback[];
}

type ChatTab = 'practice' | 'real';

interface ChatInterfaceProps {
  contextSettings: ContextSettings;
  onFeedbackChange: (feedback: Feedback[]) => void;
  onRealtimeFeedback: (feedback: string) => void;
  activePhoneNumber: string;
}

export function ChatInterface({ contextSettings, onFeedbackChange, onRealtimeFeedback, activePhoneNumber }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [contact, setContact] = useState<Contact>({ 
    phoneNumber: activePhoneNumber || '?',
    alias: ''
  });
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [tempAlias, setTempAlias] = useState(contact.alias || '');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeFeedback, setRealtimeFeedback] = useState<string>('');
  const pollingIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastAnalyzedInputRef = useRef<string>('');

  // Update contact when activePhoneNumber changes
  useEffect(() => {
    if (activePhoneNumber) {
      setContact(prev => ({ 
        ...prev, 
        phoneNumber: activePhoneNumber,
        alias: '' // Reset alias when phone number changes
      }));
    }
  }, [activePhoneNumber]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleListen = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
        
        setInput(transcript);
      };
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    
    setIsAnalyzing(true);
    try {
      const response = await fetch('http://localhost:3001/api/v1/messages/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input.trim(),
          context: contextSettings,
          conversation_history: messages.map(m => `${m.isUser ? 'User' : 'Assistant'}: ${m.text}`).join('\n')
        })
      });

      if (!response.ok) throw new Error('Failed to get feedback');
      
      const data = await response.json();
      if (data.feedback) {
        console.log('Analysis feedback:', data.feedback);
        onRealtimeFeedback(data.feedback);
      }
    } catch (err) {
      console.error('Failed to analyze message:', err);
      onRealtimeFeedback('');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInput(newValue);
    
    if (!newValue.trim()) {
      onRealtimeFeedback('');
    }
  };

  // For suggestions, let's add a retry mechanism
  const getSuggestions = async (retries = 3) => {
    if (!messages.length) return; // Exit if no messages

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return; // Extra safety check

    for (let i = 0; i < retries; i++) {
      try {
        const suggestionsResponse = await fetch('http://localhost:3001/api/v1/messages/real', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: lastMessage.text,
            context: contextSettings,
            messages: messages
          })
        });

        if (suggestionsResponse.ok) {
          const suggestionsData = await suggestionsResponse.json();
          if (suggestionsData.feedback && Array.isArray(suggestionsData.feedback)) {
            console.log('Setting suggestions (attempt ' + (i + 1) + '):', suggestionsData.feedback);
            onFeedbackChange(suggestionsData.feedback);
            return; // Success, exit
          }
        }
        // If we get here, try again after a short delay
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error('Failed to get suggestions (attempt ' + (i + 1) + '):', err);
        if (i === retries - 1) onFeedbackChange([]); // Clear on final failure
      }
    }
  };

  const handleSubmit = async (message: string) => {
    if (!message.trim()) return;

    const userMessage: Message = {
        text: message,
        isUser: true,
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
        const response = await fetch('http://localhost:3001/api/v1/messages/practice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                context: contextSettings,
                conversation_history: messages.length > 0 ? 
                    messages.map(m => `${m.isUser ? 'User' : 'Assistant'}: ${m.text}`).join('\n') : 
                    '',
                use_claude: true
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('API Response:', {
            status: response.status,
            data: data,
            feedback: data.feedback,
            feedbackLength: data.feedback?.length
        });

        // Handle AI response
        if (data.response) {
            const aiMessage: Message = {
                text: data.response,
                isUser: false,
                id: (Date.now() + 1).toString(),
                timestamp: new Date().toLocaleTimeString()
            };
            setMessages(prev => [...prev, aiMessage]);

            // Get suggestions with retry mechanism
            await getSuggestions();
        }

        // Handle initial feedback
        if (data.feedback && Array.isArray(data.feedback)) {
            console.log('Setting initial feedback:', data.feedback);
            onFeedbackChange(data.feedback);
        } else {
            console.log('No valid feedback received:', data.feedback);
            onFeedbackChange([]);
        }
    } catch (err) {
        console.error('Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to send message');
        onFeedbackChange([]);
    } finally {
        setIsLoading(false);
    }
  };

  // Make setInput available globally for feedback selection
  useEffect(() => {
    (window as any).chatInterface = {
      setInput
    };
    return () => {
      delete (window as any).chatInterface;
    };
  }, []);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setContact(prev => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Chat header */}
      <div className="px-8 py-4 bg-white border-b">
        <div className="flex items-center gap-4">
          <div 
            className="relative cursor-pointer group"
            onClick={handleAvatarClick}
          >
            {contact.avatar ? (
              <img 
                src={contact.avatar} 
                alt="Contact" 
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <UserCircleIcon className="w-10 h-10 text-gray-400" />
            )}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-full transition-all flex items-center justify-center">
              <PencilIcon className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
            </div>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleAvatarChange}
          />
          <div className="flex-1">
            <h1 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <span className="whitespace-nowrap">Practice Chat with</span>
              {isEditingContact ? (
                <input
                  type="text"
                  value={tempAlias}
                  onChange={(e) => setTempAlias(e.target.value)}
                  onBlur={() => {
                    setIsEditingContact(false);
                    setContact(prev => ({ ...prev, alias: tempAlias }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsEditingContact(false);
                      setContact(prev => ({ ...prev, alias: tempAlias }));
                    }
                  }}
                  className="border-b border-gray-300 focus:border-blue-500 focus:outline-none px-1 min-w-[120px]"
                  autoFocus
                />
              ) : (
                <span className="flex items-center gap-2 min-w-[120px]">
                  <span className="truncate">{contact.alias || contact.phoneNumber}</span>
                  <button
                    onClick={() => {
                      setIsEditingContact(true);
                      setTempAlias(contact.alias || '');
                    }}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
                  >
                    <PencilIcon className="w-4 h-4 text-gray-400" />
                  </button>
                </span>
              )}
            </h1>
          </div>
        </div>
      </div>

      {/* Messages container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4 bg-gray-50">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm">
                <p>Start a conversation...</p>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div key={message.id} className="relative">
                    <ChatMessage
                      message={message.text}
                      isUser={message.isUser}
                      timestamp={message.timestamp}
                      avatar={!message.isUser ? contact.avatar : undefined}
                    />
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-start gap-2 max-w-2xl">
                    <div className="flex items-center gap-2 px-4 py-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input area */}
          <div className="px-8 py-6 bg-white border-t">
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(input); }} className="flex items-center gap-3">
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="Type a message..."
                className={cn(
                  "flex-1 px-4 py-3 rounded-xl border bg-gray-50",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                  "placeholder:text-gray-400 text-gray-900"
                )}
              />
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!input.trim() || isAnalyzing}
                className={cn(
                  "p-3 rounded-xl transition-colors",
                  isAnalyzing 
                    ? "bg-gray-300 text-gray-600" 
                    : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                )}
              >
                {isAnalyzing ? (
                  <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0012 18a3.374 3.374 0 00-2.988-1.913l-.548-.547z" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={handleListen}
                className={cn(
                  "p-3 rounded-xl transition-colors",
                  isListening 
                    ? "bg-red-500 hover:bg-red-600 text-white" 
                    : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                )}
              >
                {isListening ? (
                  <StopIcon className="w-5 h-5" />
                ) : (
                  <MicrophoneIcon className="w-5 h-5" />
                )}
              </button>
              <button
                type="submit"
                className={cn(
                  "p-3 rounded-xl bg-blue-500 text-white",
                  "hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500",
                  "transition-colors duration-200",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                disabled={!input.trim() || isLoading}
              >
                <PaperAirplaneIcon className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
