import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Users, Hash, Plus, X, Search, Smile, Paperclip, Pin, Trash2, MessageCircle, MoreVertical, ChevronRight, Heart, Laugh, PartyPopper, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../lib/auth-storage';
import { buildWebSocketUrl } from '../../lib/wsUrl';
import { toast } from 'sonner';
import { EmptyState } from '../ui/EmptyState';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';

interface ChatMessage {
  id: string;
  channel_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  content: string;
  created_at: string;
  pinned: boolean;
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
  thread_count?: number;
}

interface MessageAttachment {
  id: string;
  name: string;
  size: number;
  url?: string;
}

interface MessageReaction {
  emoji: string;
  count: number;
  users: string[];
}

interface DirectMessage {
  id: string;
  text: string;
  sender_id: string;
  sender_name: string;
  created_at: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  online: boolean;
  avatar_color?: string;
}

interface Channel {
  id: string;
  name: string;
  description: string;
  member_count: number;
  created_at: string;
}

interface ThreadReply {
  id: string;
  parent_id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

const MOCK_TEAM_MEMBERS: TeamMember[] = [
  { id: '1', name: 'Alice Johnson', role: 'Project Manager', online: true, avatar_color: 'bg-blue-500' },
  { id: '2', name: 'Bob Smith', role: 'Site Engineer', online: true, avatar_color: 'bg-green-500' },
  { id: '3', name: 'Carol White', role: 'Safety Officer', online: false, avatar_color: 'bg-yellow-500' },
  { id: '4', name: 'Dave Brown', role: 'Foreman', online: true, avatar_color: 'bg-purple-500' },
  { id: '5', name: 'Eve Davis', role: 'Architect', online: false, avatar_color: 'bg-pink-500' },
];

const EMOJI_REACTIONS = ['👍', '❤️', '😂', '🎉', '👏', '🔥'];

export default function TeamChat() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [showDirectMessages, setShowDirectMessages] = useState(false);
  const [activeDmUser, setActiveDmUser] = useState<TeamMember | null>(null);
  const [directMessages, setDirectMessages] = useState<Record<string, DirectMessage[]>>({});
  const [dmInput, setDmInput] = useState('');
  const [showPinsPanel, setShowPinsPanel] = useState(false);
  const [selectedThread, setSelectedThread] = useState<ChatMessage | null>(null);
  const [threadReplies, setThreadReplies] = useState<Record<string, ThreadReply[]>>({});
  const [threadReplyInput, setThreadReplyInput] = useState('');
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    loadChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ⚡ Bolt Performance Optimization:
  // Removed `startPolling` and the redundant `setInterval` that refetched messages
  // every 3 seconds. The `TeamChat` component already maintains a real-time WebSocket connection
  // that listens for 'chat_message' events and updates the `messages` state accordingly.
  // By relying exclusively on WebSockets for real-time updates, we eliminate unnecessary
  // network requests and prevent layout-wide React state re-renders every 3 seconds.
  useEffect(() => {
    if (activeChannel) {
      loadMessages(activeChannel.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannel]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const wsUrl = buildWebSocketUrl('/ws');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setOnlineUsers(prev => [...prev, user?.name || 'You']);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'collaboration' && data.event === 'chat_message') {
          setMessages(prev => {
            if (prev.some(m => m.id === data.payload.id)) return prev;
            return [...prev, data.payload];
          });
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      setOnlineUsers(prev => prev.filter(u => u !== (user?.name || 'You')));
    };

    return () => {
      ws.close();
    };
  }, [user]);

  async function loadChannels() {
    try {
      const res = await fetch(`${API_BASE}/chat/channels`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setChannels(data);
        if (data.length > 0 && !activeChannel) {
          setActiveChannel(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load channels:', err);
    }
  }

  async function loadMessages(channelId: string) {
    try {
      const res = await fetch(`${API_BASE}/chat/channels/${channelId}/messages`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }

  async function handleSendMessage() {
    if (!newMessage.trim() || !activeChannel || !user) return;
    try {
      const res = await fetch(`${API_BASE}/chat/channels/${activeChannel.id}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage.trim(), attachments: attachedFile ? [{ name: attachedFile.name, size: attachedFile.size }] : [] }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages(prev => [...prev, msg]);
        setNewMessage('');
        setAttachedFile(null);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'collaboration',
            event: 'chat_message',
            payload: { ...msg, user_name: user.name, user_role: user.role },
          }));
        }
      } else {
        toast.error('Failed to send message');
      }
    } catch {
      toast.error('Failed to send message');
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFile({ name: file.name, size: file.size });
      toast.success(`File "${file.name}" attached`);
    }
  }

  function handleSendDM() {
    if (!dmInput.trim() || !activeDmUser || !user) return;
    const newDM: DirectMessage = {
      id: Date.now().toString(),
      text: dmInput.trim(),
      sender_id: user.id,
      sender_name: user.name,
      created_at: new Date().toISOString(),
    };
    setDirectMessages(prev => ({
      ...prev,
      [activeDmUser.id]: [...(prev[activeDmUser.id] || []), newDM],
    }));
    setDmInput('');
    toast.success('Message sent');
  }

  function handlePinMessage(messageId: string) {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, pinned: !m.pinned } : m));
    const msg = messages.find(m => m.id === messageId);
    if (msg) {
      toast.success(msg.pinned ? 'Message unpinned' : 'Message pinned');
    }
  }

  function handleAddReaction(messageId: string, emoji: string) {
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        const reactions = [...(m.reactions || [])];
        const existingReaction = reactions.find(r => r.emoji === emoji);
        if (existingReaction) {
          existingReaction.count += 1;
          if (!existingReaction.users.includes(user?.name || '')) {
            existingReaction.users.push(user?.name || '');
          }
        } else {
          reactions.push({ emoji, count: 1, users: [user?.name || ''] });
        }
        return { ...m, reactions };
      }
      return m;
    }));
    setShowEmojiPicker(null);
  }

  function handleReplyThread(messageId: string) {
    const msg = messages.find(m => m.id === messageId);
    if (msg) {
      setSelectedThread(msg);
      setThreadReplyInput('');
    }
  }

  function handleSendThreadReply() {
    if (!threadReplyInput.trim() || !selectedThread || !user) return;
    const reply: ThreadReply = {
      id: Date.now().toString(),
      parent_id: selectedThread.id,
      user_id: user.id,
      user_name: user.name,
      content: threadReplyInput.trim(),
      created_at: new Date().toISOString(),
    };
    setThreadReplies(prev => ({
      ...prev,
      [selectedThread.id]: [...(prev[selectedThread.id] || []), reply],
    }));
    setMessages(prev => prev.map(m => m.id === selectedThread.id ? { ...m, thread_count: (m.thread_count || 0) + 1 } : m));
    setThreadReplyInput('');
    toast.success('Reply posted');
  }

  async function handleCreateChannel() {
    if (!newChannelName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/chat/channels`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
          description: newChannelDesc,
        }),
      });
      if (res.ok) {
        const channel = await res.json();
        setChannels(prev => [...prev, channel]);
        setActiveChannel(channel);
        setShowCreateChannel(false);
        setNewChannelName('');
        setNewChannelDesc('');
        toast.success(`Channel #${channel.name} created`);
      } else {
        toast.error('Failed to create channel');
      }
    } catch {
      toast.error('Failed to create channel');
    }
  }

  async function handleDeleteMessage(messageId: string) {
    if (!activeChannel) return;
    try {
      const res = await fetch(`${API_BASE}/chat/channels/${activeChannel.id}/messages/${messageId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
        toast.success('Message deleted');
      }
    } catch {
      toast.error('Failed to delete message');
    }
  }

  const filteredMessages = searchQuery
    ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()) || m.user_name.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const pinnedMessages = messages.filter(m => m.pinned);

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString();
  }

  return (
    <>
      <ModuleBreadcrumbs currentModule="team-chat" />
      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Sidebar - Channels & DMs */}
        <div className={`${showDirectMessages ? 'w-64' : 'w-64'} bg-gray-900 border-r border-gray-800 flex flex-col`}>
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-2 flex-1">
                <button
                  onClick={() => setShowDirectMessages(false)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${!showDirectMessages ? 'bg-amber-500/10 text-amber-400' : 'text-gray-400 hover:text-white'}`}
                >
                  Channels
                </button>
                <button
                  onClick={() => setShowDirectMessages(true)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${showDirectMessages ? 'bg-amber-500/10 text-amber-400' : 'text-gray-400 hover:text-white'}`}
                >
                  DMs
                </button>
              </div>
              {!showDirectMessages && (
                <button
                  onClick={() => setShowCreateChannel(true)}
                  className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-800 rounded-md">
              <Search size={14} className="text-gray-500" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent text-sm text-white placeholder-gray-500 outline-none flex-1"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {!showDirectMessages ? (
              channels.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    activeChannel?.id === ch.id
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Hash size={16} />
                  <span className="truncate">{ch.name}</span>
                  {ch.member_count > 0 && (
                    <span className="ml-auto text-xs text-gray-600">{ch.member_count}</span>
                  )}
                </button>
              ))
            ) : (
              MOCK_TEAM_MEMBERS.map(member => (
                <button
                  key={member.id}
                  onClick={() => setActiveDmUser(member)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    activeDmUser?.id === member.id
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <div className="relative">
                    <div className={`w-6 h-6 rounded-full ${member.avatar_color} flex items-center justify-center text-xs font-bold text-white`}>
                      {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-gray-900 ${member.online ? 'bg-green-500' : 'bg-gray-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{member.name}</div>
                    <div className="text-xs text-gray-500 truncate">{member.role}</div>
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="p-4 border-t border-gray-800">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Users size={14} />
              <span>{onlineUsers.length} online</span>
            </div>
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col">
          {showDirectMessages && activeDmUser ? (
            <>
              {/* DM header */}
              <div className="px-6 py-3 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${activeDmUser.avatar_color} flex items-center justify-center text-white font-bold`}>
                    {activeDmUser.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{activeDmUser.name}</h2>
                    <p className="text-xs text-gray-500">{activeDmUser.online ? 'Online' : 'Offline'}</p>
                  </div>
                </div>
              </div>

              {/* DM messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {(directMessages[activeDmUser.id] || []).length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500 text-sm">Start a conversation with {activeDmUser.name}</p>
                  </div>
                ) : (
                  (directMessages[activeDmUser.id] || []).map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-4 py-2 rounded-lg text-sm ${
                        msg.sender_id === user?.id
                          ? 'bg-amber-500/10 text-amber-100 rounded-tr-none'
                          : 'bg-gray-800 text-gray-200 rounded-tl-none'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* DM input */}
              <div className="px-6 py-4 border-t border-gray-800">
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <textarea
                      value={dmInput}
                      onChange={e => setDmInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendDM();
                        }
                      }}
                      placeholder={`Message ${activeDmUser.name}...`}
                      rows={1}
                      className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-lg px-4 py-2.5 text-sm outline-none resize-none focus:ring-1 focus:ring-amber-500/50"
                    />
                  </div>
                  <button
                    onClick={handleSendDM}
                    disabled={!dmInput.trim()}
                    className="p-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </>
          ) : activeChannel ? (
            <>
              {/* Channel header */}
              <div className="px-6 py-3 border-b border-gray-800 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Hash size={18} className="text-gray-500" />
                    {activeChannel.name}
                  </h2>
                  {activeChannel.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{activeChannel.description}</p>
                  )}
                </div>
                <button
                  onClick={() => setShowPinsPanel(!showPinsPanel)}
                  className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-amber-400 transition-colors"
                  title="Pinned messages"
                >
                  <Pin size={18} />
                </button>
              </div>

              {/* Pinned messages */}
              {pinnedMessages.length > 0 && (
                <div className="px-6 py-2 bg-amber-500/5 border-b border-amber-500/20">
                  <div className="flex items-center gap-2 text-amber-400 text-xs mb-1">
                    <Pin size={12} />
                    <span className="font-semibold">Pinned Messages</span>
                  </div>
                  {pinnedMessages.map(m => (
                    <p key={m.id} className="text-xs text-gray-400 truncate">
                      <span className="text-gray-300">{m.user_name}:</span> {m.content}
                    </p>
                  ))}
                </div>
              )}

              {/* Thread view */}
              {selectedThread ? (
                <div className="flex flex-col h-full">
                  {/* Parent message */}
                  <div className="px-6 py-3 border-b border-gray-800 bg-gray-800/50">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-300">Thread</h3>
                      <button
                        onClick={() => setSelectedThread(null)}
                        className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-bold flex-shrink-0">
                        {selectedThread.user_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-white">{selectedThread.user_name}</span>
                          <span className="text-xs text-gray-600">{formatTime(selectedThread.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-300">{selectedThread.content}</p>
                      </div>
                    </div>
                  </div>

                  {/* Thread replies */}
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                    {(threadReplies[selectedThread.id] || []).map(reply => (
                      <div key={reply.id} className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold flex-shrink-0">
                          {reply.user_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white">{reply.user_name}</span>
                            <span className="text-xs text-gray-600">{formatTime(reply.created_at)}</span>
                          </div>
                          <p className="text-sm text-gray-300">{reply.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Thread reply input */}
                  <div className="px-6 py-3 border-t border-gray-800">
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <textarea
                          value={threadReplyInput}
                          onChange={e => setThreadReplyInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendThreadReply();
                            }
                          }}
                          placeholder="Reply in thread..."
                          rows={1}
                          className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-lg px-4 py-2.5 text-sm outline-none resize-none focus:ring-1 focus:ring-amber-500/50"
                        />
                      </div>
                      <button
                        onClick={handleSendThreadReply}
                        disabled={!threadReplyInput.trim()}
                        className="p-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {filteredMessages.length === 0 ? (
                      <EmptyState
                        icon={Hash}
                        title={searchQuery ? 'No messages match your search' : 'No messages yet'}
                        description={searchQuery ? 'Try a different search term' : 'Start the conversation in this channel'}
                        variant="default"
                      />
                    ) : (
                      (() => {
                        let lastDate = '';
                        return filteredMessages.map(msg => {
                          const msgDate = formatDate(msg.created_at);
                          const showDate = msgDate !== lastDate;
                          lastDate = msgDate;
                          const isOwn = msg.user_name === user?.name;
                          return (
                            <div key={msg.id}>
                              {showDate && (
                                <div className="flex items-center gap-3 my-4">
                                  <div className="flex-1 h-px bg-gray-800" />
                                  <span className="text-xs text-gray-500 font-medium">{msgDate}</span>
                                  <div className="flex-1 h-px bg-gray-800" />
                                </div>
                              )}
                              <div
                                className={`flex gap-3 group ${isOwn ? 'flex-row-reverse' : ''}`}
                                onMouseEnter={() => setHoveredMessageId(msg.id)}
                                onMouseLeave={() => setHoveredMessageId(null)}
                              >
                                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-bold flex-shrink-0">
                                  {msg.user_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                </div>
                                <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium text-white">{msg.user_name}</span>
                                    <span className="text-xs text-gray-600">{formatTime(msg.created_at)}</span>
                                    {msg.pinned && <Pin size={10} className="text-amber-400" />}
                                  </div>
                                  <div className={`px-4 py-2 rounded-lg text-sm ${
                                    isOwn
                                      ? 'bg-amber-500/10 text-amber-100 rounded-tr-none'
                                      : 'bg-gray-800 text-gray-200 rounded-tl-none'
                                  }`}>
                                    {msg.content}
                                  </div>
                                  {msg.attachments && msg.attachments.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {msg.attachments.map(att => (
                                        <div key={att.id} className="flex items-center gap-2 bg-blue-900/30 rounded px-2 py-1">
                                          <Paperclip size={12} className="text-blue-400" />
                                          <span className="text-xs text-blue-300 font-medium">{att.name}</span>
                                          <span className="text-xs text-blue-400">({(att.size / 1024).toFixed(1)}KB)</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {msg.reactions && msg.reactions.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {msg.reactions.map((reaction, idx) => (
                                        <button
                                          key={idx}
                                          className="text-xs bg-gray-700/50 hover:bg-gray-700 rounded px-2 py-0.5 transition-colors"
                                        >
                                          {reaction.emoji} {reaction.count}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  {hoveredMessageId === msg.id && (
                                    <div className={`flex gap-1 mt-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                                      <div className="relative">
                                        <button
                                          onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                                          className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-white text-sm"
                                          title="React"
                                        >
                                          😊
                                        </button>
                                        {showEmojiPicker === msg.id && (
                                          <div className="absolute bottom-full right-0 mb-2 bg-gray-800 rounded-lg shadow-lg p-2 flex gap-1 z-10">
                                            {EMOJI_REACTIONS.map(emoji => (
                                              <button
                                                key={emoji}
                                                onClick={() => handleAddReaction(msg.id, emoji)}
                                                className="text-lg hover:bg-gray-700 rounded px-1.5 py-0.5 transition-colors"
                                              >
                                                {emoji}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => handleReplyThread(msg.id)}
                                        className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-white"
                                        title="Reply"
                                      >
                                        <MessageCircle size={14} />
                                      </button>
                                      <button
                                        onClick={() => handlePinMessage(msg.id)}
                                        className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-amber-400"
                                        title="Pin"
                                      >
                                        <Pin size={12} />
                                      </button>
                                      {isOwn && (
                                        <button
                                          onClick={() => handleDeleteMessage(msg.id)}
                                          className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-red-400"
                                          title="Delete"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message input */}
                  <div className="px-6 py-4 border-t border-gray-800">
                    <div className="flex items-end gap-3">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 hover:bg-gray-800 rounded text-gray-500 hover:text-white transition-colors"
                      >
                        <Paperclip size={18} />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <div className="flex-1 relative">
                        {attachedFile && (
                          <div className="mb-2 flex items-center gap-2 bg-blue-900/30 rounded px-3 py-2">
                            <Paperclip size={14} className="text-blue-400" />
                            <span className="text-xs text-blue-300">{attachedFile.name}</span>
                            <button
                              onClick={() => setAttachedFile(null)}
                              className="ml-auto text-gray-500 hover:text-white"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}
                        <textarea
                          value={newMessage}
                          onChange={e => setNewMessage(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          placeholder={`Message #${activeChannel.name}`}
                          rows={1}
                          className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-lg px-4 py-2.5 text-sm outline-none resize-none focus:ring-1 focus:ring-amber-500/50"
                        />
                      </div>
                      <button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim()}
                        className="p-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={Hash}
                title="No channel selected"
                description="Select a channel from the sidebar or create a new one"
                variant="default"
              />
            </div>
          )}
        </div>

        {/* Right panel - Pinned messages */}
        {showPinsPanel && activeChannel && (
          <div className="w-72 bg-gray-900 border-l border-gray-800 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Pin size={16} className="text-amber-400" />
                Pinned Messages
              </h3>
              <button
                onClick={() => setShowPinsPanel(false)}
                className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.filter(m => m.pinned).length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-8">No pinned messages</p>
              ) : (
                messages.filter(m => m.pinned).map(msg => (
                  <div key={msg.id} className="bg-gray-800/50 rounded-lg p-3 hover:bg-gray-800 transition-colors group">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-amber-400">{msg.user_name}</span>
                      <span className="text-xs text-gray-600">{formatTime(msg.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-300 line-clamp-3">{msg.content}</p>
                    <button
                      onClick={() => handlePinMessage(msg.id)}
                      className="mt-2 text-xs text-gray-500 hover:text-red-400 flex items-center gap-1"
                    >
                      <Pin size={12} />
                      Unpin
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}


        {/* Create channel modal */}
        {showCreateChannel && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md">
              <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Create Channel</h3>
                <button onClick={() => setShowCreateChannel(false)} className="text-gray-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Channel Name</label>
                  <div className="flex items-center gap-2">
                    <Hash size={16} className="text-gray-500" />
                    <input
                      type="text"
                      value={newChannelName}
                      onChange={e => setNewChannelName(e.target.value)}
                      placeholder="general"
                      className="flex-1 bg-gray-800 text-white rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-amber-500/50"
                      autoFocus
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={newChannelDesc}
                    onChange={e => setNewChannelDesc(e.target.value)}
                    placeholder="What is this channel about?"
                    className="w-full bg-gray-800 text-white rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-amber-500/50"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
                <button onClick={() => setShowCreateChannel(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">
                  Cancel
                </button>
                <button
                  onClick={handleCreateChannel}
                  disabled={!newChannelName.trim()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-md text-sm font-medium"
                >
                  Create Channel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
