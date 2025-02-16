import { cn } from '@/lib/utils';
import { UserCircleIcon } from '@heroicons/react/24/solid';

interface ChatMessageProps {
  message: string;
  isUser: boolean;
  timestamp?: string;
  avatar?: string;
}

export function ChatMessage({ message, isUser, timestamp, avatar }: ChatMessageProps) {
  return (
    <div className={cn(
      "flex items-start gap-2",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8">
          {avatar ? (
            <img 
              src={avatar} 
              alt="Contact" 
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <UserCircleIcon className="w-8 h-8 text-gray-400" />
          )}
        </div>
      )}
      <div className={cn(
        "px-4 py-2 rounded-xl inline-block",
        isUser ? "bg-blue-500 text-white" : "bg-white text-black",
        isUser ? "rounded-tr-sm" : "rounded-tl-sm"
      )}>
        <p className="whitespace-pre-wrap break-words">{message}</p>
        {timestamp && (
          <p className={cn(
            "text-xs mt-1",
            isUser ? "text-blue-100" : "text-gray-700"
          )}>
            {timestamp}
          </p>
        )}
      </div>
    </div>
  );
} 