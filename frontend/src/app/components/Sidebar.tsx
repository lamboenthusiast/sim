import { cn } from '@/lib/utils';
import { ContactSelector } from './ContactSelector';
import { ContextSettingsPanel } from './ContextSettingsPanel';
import { FeedbackPanel } from './FeedbackPanel';
import { ContextSettings } from '@/types';
import { useState, useEffect } from 'react';
import { CheckIcon } from '@heroicons/react/24/outline';

interface Contact {
  id: string;
  name: string;
  service: string;
}

interface Feedback {
  text: string;
  score: number;
  explanation: string;
}

interface SidebarProps {
  exportState: {
    contacts: Contact[];
    selectedContact?: Contact;
    loading: boolean;
  };
  onSelectContact: (contact: Contact) => void;
  contextSettings: ContextSettings;
  onContextSettingsChange: (settings: ContextSettings) => void;
  feedback?: Feedback[];
  onFeedbackSelect?: (text: string) => void;
  realtimeFeedback?: string;
}

export function Sidebar({
  exportState,
  onSelectContact,
  contextSettings,
  onContextSettingsChange,
  feedback,
  onFeedbackSelect,
  realtimeFeedback,
}: SidebarProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [mounted, setMounted] = useState(false);

  // Load saved context on mount
  useEffect(() => {
    setMounted(true);
    const savedContext = localStorage.getItem('contextSettings');
    if (savedContext) {
      try {
        const parsed = JSON.parse(savedContext);
        onContextSettingsChange(parsed);
      } catch (err) {
        console.error('Failed to parse saved context:', err);
      }
    }
  }, []);

  // Debug feedback changes
  useEffect(() => {
    console.log('Feedback changed:', feedback);
  }, [feedback]);
  
  const handleSaveContext = async () => {
    if (!mounted) return;
    
    setIsSaving(true);
    setSaveStatus('saving');
    
    try {
      // Save to localStorage
      localStorage.setItem('contextSettings', JSON.stringify(contextSettings));
      
      // Simulate a short delay for the loading animation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setSaveStatus('saved');
      
      // Reset status after 2 seconds
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (err) {
      console.error('Failed to save context:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Don't render until mounted to prevent hydration issues
  if (!mounted) {
    return (
      <div className="w-[400px] min-w-[400px] h-full flex flex-col bg-gray-50 border-r">
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-4">
            <div className="p-4 bg-white rounded-lg shadow-sm border animate-pulse">
              <div className="h-24 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[400px] min-w-[400px] h-full flex flex-col bg-gray-50 border-r">
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-4">
          <ContactSelector
            contacts={exportState.contacts}
            selectedContact={exportState.selectedContact}
            onSelectContact={onSelectContact}
            loading={exportState.loading}
          />
          
          {/* Combined Context Box */}
          <div className="p-4 bg-white rounded-lg shadow-sm border">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Context & Goals</label>
                <textarea
                  placeholder="Enter your context and goals..."
                  value={contextSettings.goal || contextSettings.background || ''}
                  onChange={(e) => {
                    onContextSettingsChange({
                      ...contextSettings,
                      goal: e.target.value,
                      background: ''  // We'll just use one field for now
                    });
                    setSaveStatus('idle');
                  }}
                  className={cn(
                    "w-full px-3 py-2 border rounded-md text-sm min-h-[100px]",
                    "placeholder:text-gray-400",
                    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                    "text-black"
                  )}
                />
              </div>
              <button
                onClick={handleSaveContext}
                disabled={isSaving || saveStatus === 'saved'}
                className={cn(
                  "w-full px-3 py-1.5 rounded-md transition-all duration-200 relative text-sm",
                  saveStatus === 'saved' 
                    ? "bg-green-500 text-white hover:bg-green-600"
                    : "bg-blue-500 text-white hover:bg-blue-600",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <span className={cn(
                  "inline-flex items-center gap-1",
                  isSaving ? "opacity-0" : "opacity-100"
                )}>
                  {saveStatus === 'saved' ? (
                    <>
                      <CheckIcon className="w-3 h-3" />
                      Saved
                    </>
                  ) : (
                    'Save'
                  )}
                </span>
                {isSaving && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </button>
            </div>
          </div>
          
          {/* Real-time Analysis Panel */}
          <div className="p-3 bg-white rounded-lg shadow-sm border">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Analysis</h3>
            <div className="text-sm text-black">
              {realtimeFeedback ? (
                <div className="space-y-1">
                  {realtimeFeedback.split('\n').map((line, i) => (
                    <div key={i} className="flex items-start gap-2">
                      {line.startsWith('✓') ? (
                        <span className="text-green-500 flex-shrink-0">✓</span>
                      ) : (
                        <span className="text-yellow-500 flex-shrink-0">→</span>
                      )}
                      <p>{line.replace(/^[✓→]\s*/, '')}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-1 text-gray-500">
                  Start typing...
                </div>
              )}
            </div>
          </div>
          
          {/* Message Suggestions */}
          <div className="p-3 bg-white rounded-lg shadow-sm border">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Suggestions</h3>
            <div className="text-sm text-black">
              {Array.isArray(feedback) && feedback.length > 0 ? (
                <div className="space-y-2">
                  {feedback.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => onFeedbackSelect?.(item.text)}
                      className="w-full text-left p-2 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-xs font-medium",
                          item.score >= 9 ? "bg-green-100 text-green-800" :
                          item.score >= 8 ? "bg-green-100 text-green-700" :
                          item.score >= 7 ? "bg-lime-100 text-lime-700" :
                          item.score >= 6 ? "bg-yellow-100 text-yellow-700" :
                          item.score >= 5 ? "bg-orange-100 text-orange-700" :
                          item.score >= 4 ? "bg-red-50 text-red-600" :
                          "bg-red-100 text-red-700"
                        )}>
                          {item.score}/10
                        </span>
                      </div>
                      <p className="text-sm mb-1">{item.text}</p>
                      <p className="text-xs text-gray-500">{item.explanation}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-1 text-gray-500">
                  Send a message for suggestions...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 