import { cn } from '@/lib/utils';

interface Feedback {
  text: string;
  score: number;
  explanation: string;
}

interface FeedbackPanelProps {
  feedback?: Feedback[];
  onSelect?: (text: string) => void;
}

export function FeedbackPanel({ feedback = [], onSelect }: FeedbackPanelProps) {
  return (
    <div className="border-l bg-white p-6 overflow-y-auto h-full">
      <h3 className="font-medium text-lg mb-4">Message Suggestions</h3>
      {feedback.length > 0 ? (
        <div className="space-y-4">
          {feedback.map((option, index) => (
            <button
              key={index}
              onClick={() => onSelect?.(option.text)}
              className="w-full text-left p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2 py-1 rounded text-xs font-medium",
                    option.score >= 80 ? "bg-green-100 text-green-700" :
                    option.score >= 60 ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  )}>
                    Score: {option.score}
                  </span>
                </div>
                {index === 0 && (
                  <span className="text-xs font-medium text-green-600">Recommended</span>
                )}
              </div>
              <p className="text-sm mb-2 font-medium">{option.text}</p>
              <p className="text-xs text-gray-600 italic">{option.explanation}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-32 text-gray-500 text-sm">
          <p>Send a message to get suggestions...</p>
        </div>
      )}
    </div>
  );
} 