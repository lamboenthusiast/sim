'use client';

import { useState, useEffect } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { Sidebar } from './components/Sidebar';
import { ContextSettings } from '@/types';
import { cn } from '@/lib/utils';
import { Dialog } from '@headlessui/react';

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

interface ExportState {
  contacts: Contact[];
  selectedContact?: Contact;
  loading: boolean;
  error?: string;
}

// Add new interface for export progress
interface ExportProgress {
  step: 'idle' | 'extracting' | 'compressing' | 'training' | 'complete' | 'error';
  message?: string;
}

interface TrainingProgress {
  is_training: boolean;
  progress: number;
  message: string;
  error: string | null;
}

export default function Home() {
  const [exportState, setExportState] = useState<ExportState>({
    contacts: [],
    loading: false
  });
  const [contextSettings, setContextSettings] = useState<ContextSettings>({
    background: '',
    style: 'casual'
  });
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [realtimeFeedback, setRealtimeFeedback] = useState<string>('');
  const [exportError, setExportError] = useState<string>();
  const [exportProgress, setExportProgress] = useState<ExportProgress>({ step: 'idle' });
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress>({
    is_training: false,
    progress: 0,
    message: '',
    error: null
  });
  const [activePhoneNumber, setActivePhoneNumber] = useState<string>('');

  // Add polling for training progress
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    // Only poll if dialog is open AND we're in training step
    if (showExportDialog && exportProgress.step === 'training') {
      pollInterval = setInterval(async () => {
        try {
          const response = await fetch('http://localhost:3001/api/v1/messages/training-progress');
          const progress = await response.json();
          setTrainingProgress(progress);

          if (progress.error) {
            setExportProgress({ 
              step: 'error', 
              message: progress.error 
            });
            clearInterval(pollInterval);
          } else if (progress.progress === 100) {
            setExportProgress({ step: 'complete' });
            clearInterval(pollInterval);
          }
        } catch (err) {
          console.error('Failed to fetch training progress:', err);
        }
      }, 1000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [exportProgress.step, showExportDialog]);

  const handleExport = async () => {
    if (!phoneNumber) return;
    
    setExportProgress({ step: 'extracting' });
    try {
      const response = await fetch('http://localhost:3001/api/v1/messages/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_filter: phoneNumber })
      });
      
      if (!response.ok) {
        const data = await response.json();
        setExportProgress({ 
          step: 'error', 
          message: data.message || 'Export failed' 
        });
        return;
      }
      
      const data = await response.json();
      
      // Set active phone number
      setActivePhoneNumber(phoneNumber);
      
      // Download the JSON file
      const a = document.createElement('a');
      a.href = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data))}`;
      a.download = `messages_${phoneNumber}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      setExportProgress({ step: 'training' });
      
    } catch (err) {
      setExportProgress({ 
        step: 'error', 
        message: err instanceof Error ? err.message : 'Export failed' 
      });
    }
  };

  const handleFeedbackChange = (newFeedback: Feedback[]) => {
    console.log('Page received new feedback:', newFeedback);
    setFeedback(newFeedback);
  };

  const handleFeedbackSelect = (text: string) => {
    console.log('Selected feedback text:', text);
    if (window.chatInterface) {
      window.chatInterface.setInput(text);
    }
  };

  return (
    <main className="flex min-h-screen h-screen overflow-hidden">
      {/* Export Button */}
      <div className="absolute top-[18px] right-8 z-10">
        <button
          onClick={() => setShowExportDialog(true)}
          className={cn(
            "px-4 py-2 bg-blue-500 text-white rounded-md",
            "hover:bg-blue-600 transition-colors",
            "flex items-center gap-2 shadow-sm text-sm",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          Export iMessage Texts
        </button>
      </div>

      {/* Export Dialog */}
      <Dialog 
        open={showExportDialog} 
        onClose={() => exportProgress.step === 'idle' && setShowExportDialog(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
            {/* Add close button for training */}
            {exportProgress.step === 'training' && (
              <button
                onClick={() => {
                  setShowExportDialog(false);
                  // Keep training running in background
                }}
                className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-500"
              >
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            
            <Dialog.Title className="text-lg font-medium mb-4">
              Export iMessage Texts
            </Dialog.Title>

            {exportProgress.step === 'idle' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1234567890"
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowExportDialog(false)}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={!phoneNumber}
                    className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                  >
                    Export
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col items-center py-4">
                  {exportProgress.step === 'error' ? (
                    <div className="text-red-500 text-center">
                      <div className="text-lg mb-2">❌</div>
                      <div className="text-sm">{exportProgress.message}</div>
                    </div>
                  ) : exportProgress.step === 'complete' ? (
                    <div className="text-green-500 text-center">
                      <div className="text-lg mb-2">✓</div>
                      <div className="text-sm">Export Complete!</div>
                    </div>
                  ) : (
                    <>
                      <div className="w-full max-w-xs bg-gray-200 rounded-full h-2.5 mb-4">
                        <div 
                          className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                          style={{ 
                            width: `${exportProgress.step === 'training' ? trainingProgress.progress : 
                                   exportProgress.step === 'extracting' ? 30 : 
                                   exportProgress.step === 'compressing' ? 60 : 0}%` 
                          }}
                        />
                      </div>
                      <div className="text-sm font-medium">
                        {exportProgress.step === 'extracting' && 'Extracting messages...'}
                        {exportProgress.step === 'compressing' && 'Compressing data...'}
                        {exportProgress.step === 'training' && trainingProgress.message}
                      </div>
                    </>
                  )}
                </div>
                
                {(exportProgress.step === 'error' || exportProgress.step === 'complete') && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        setShowExportDialog(false);
                        setExportProgress({ step: 'idle' });
                        setPhoneNumber('');
                      }}
                      className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            )}
          </Dialog.Panel>
        </div>
      </Dialog>

      <Sidebar
        exportState={exportState}
        onSelectContact={(contact) => setExportState(prev => ({ ...prev, selectedContact: contact }))}
        contextSettings={contextSettings}
        onContextSettingsChange={setContextSettings}
        feedback={feedback}
        onFeedbackSelect={handleFeedbackSelect}
        realtimeFeedback={realtimeFeedback}
      />
      
      <div className="flex-1 h-full">
        <ChatInterface 
          contextSettings={contextSettings} 
          onFeedbackChange={handleFeedbackChange}
          onRealtimeFeedback={setRealtimeFeedback}
          activePhoneNumber={activePhoneNumber}
        />
      </div>
    </main>
  );
}
