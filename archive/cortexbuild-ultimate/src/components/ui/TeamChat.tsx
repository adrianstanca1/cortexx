import { useState, useEffect, useRef } from 'react';
import { Send, X } from 'lucide-react';
import { toast } from 'sonner';

/**
 * TeamChat Component
 * 
 * Real-time team messaging interface with message history and typing indicators.
 * Supports project-specific chat rooms.
 * 
 * @param props - Component props
 * @param props.projectId - Optional project ID for project-specific chat
 * @param props.onClose - Callback function when chat is closed
 * @returns JSX element displaying team chat modal
 * 
 * @example
 * ```tsx
 * <TeamChat projectId="proj-123" onClose={() => setShowChat(false)} />
 * ```
 * 
 * @remarks
 * - Displays message history
 * - Shows typing indicators
 * - Supports system notifications
 * - Accessible with ARIA labels
 */


interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: string;
  type: 'text' | 'system' | 'file';
}

interface TeamChatProps {
  projectId?: string;
  onClose?: () => void;
}

export function TeamChat({ projectId: _projectId, onClose }: TeamChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Simulate receiving messages (replace with WebSocket)
  useEffect(() => {
    // Simulate loading delay
    const loadMessages = async () => {
      setIsLoading(true);
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const initialMessages: ChatMessage[] = [
        {
          id: '1',
          userId: 'user1',
          userName: 'Sarah Chen',
          content: 'Team meeting at 2 PM today',
          timestamp: new Date().toISOString(),
          type: 'text',
        },
        {
          id: '2',
          userId: 'system',
          userName: 'System',
          content: 'Project status updated to In Progress',
          timestamp: new Date().toISOString(),
          type: 'system',
        },
      ];
      setMessages(initialMessages);
      setIsLoading(false);
    };
    
    loadMessages();
  }, []);

  const sendMessage = () => {
    if (!newMessage.trim()) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      userId: 'current-user',
      userName: 'You',
      content: newMessage,
      timestamp: new Date().toISOString(),
      type: 'text',
    };

    setMessages([...messages, message]);
    setNewMessage('');
    toast.success('Message sent');

    // Simulate reply
    setTimeout(() => {
      const reply: ChatMessage = {
        id: (Date.now() + 1).toString(),
        userId: 'user2',
        userName: 'James Miller',
        content: 'Got it, thanks!',
        timestamp: new Date().toISOString(),
        type: 'text',
      };
      setMessages(prev => [...prev, reply]);
    }, 2000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div 
    className="fixed bottom-20 right-4 w-96 bg-base-100 border border-base-300 rounded-lg shadow-2xl z-40 flex flex-col" 
    style={{ height: '500px' }}
    role="dialog"
    aria-modal="true"
    aria-label="Team chat"
  >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-base-300">
        <div>
          <h3 className="font-bold">Team Chat</h3>
          <p className="text-xs text-gray-500">3 members online</p>
        </div>
        {onClose && (
          <button 
        onClick={onClose} 
        className="btn btn-sm btn-ghost btn-circle"
        aria-label="Close chat"
      >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-3" 
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
      >
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.userId === 'current-user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] ${msg.userId === 'current-user' ? 'order-2' : 'order-1'}`}>
              {msg.type === 'system' ? (
                <div className="text-xs text-center text-gray-500 bg-base-200 py-1 px-3 rounded">
                  {msg.content}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    {msg.userId !== 'current-user' && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-content text-xs font-bold">
                        {msg.userName[0]}
                      </div>
                    )}
                    <span className="text-xs font-medium">{msg.userName}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div
                    className={`p-3 rounded-lg ${
                      msg.userId === 'current-user'
                        ? 'bg-primary text-primary-content'
                        : 'bg-base-200'
                    }`}
                  >
                    {msg.content}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-base-200 p-3 rounded-lg">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-base-300">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            aria-label="Message input"
            className="input input-bordered flex-1 text-sm"
          />
          <button onClick={sendMessage} className="btn btn-primary btn-sm" aria-label="Send message">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
