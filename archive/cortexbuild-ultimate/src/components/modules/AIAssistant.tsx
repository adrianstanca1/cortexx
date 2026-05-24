// Module: AIAssistant — CortexBuild Ultimate
import { useState, useEffect, useRef } from 'react';
import {
  Send, Zap, Shield, TrendingUp, FileText, Calendar,
  MessageSquare, Award, Brain, Clock, Archive, CheckSquare, Square, Trash2,
  Radio, WifiOff, Cpu, Mic, MicOff, AudioWaveform,
} from 'lucide-react';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import clsx from 'clsx';
import { streamChatMessage, fetchAgentStatus } from '../../services/ai';
import { aiConversationsApi, dashboardApi } from '../../services/api';
import { toast } from 'sonner';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';

// ── Render markdown-like content for AI responses ──────────────────────────────
function renderMessageContent(content: string): React.ReactNode {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={i} style={{
          fontFamily: "'Syne', sans-serif", fontSize: '14px', fontWeight: 700,
          color: '#f1f5f9', marginTop: '16px', marginBottom: '8px', letterSpacing: '-0.01em',
          borderBottom: '1px solid rgba(245,158,11,0.15)', paddingBottom: '6px',
        }}>
          {line.replace(/^##\s*/, '')}
        </h3>
      );
    } else if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(
        <p key={i} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#e2e8f0', fontWeight: 600, marginBottom: '6px' }}>
          {line.replace(/\*\*(.*?)\*\*/g, '$1')}
        </p>
      );
    } else if (line.startsWith('• ') || line.startsWith('- ')) {
      // Collect consecutive bullet points
      const bullets: string[] = [];
      while (i < lines.length && (lines[i].startsWith('• ') || lines[i].startsWith('- '))) {
        bullets.push(lines[i].replace(/^[•-]\s*/, ''));
        i++;
      }
      elements.push(
        <ul key={`bullet-${i}`} style={{ marginLeft: '16px', marginBottom: '8px' }}>
          {bullets.map((b, bi) => (
            <li key={bi} style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#94a3b8',
              marginBottom: '3px', lineHeight: 1.5,
              listStyleType: 'none',
              paddingLeft: '12px',
              position: 'relative',
            }}>
              <span style={{ position: 'absolute', left: 0, color: '#f59e0b' }}>›</span>
              {b.split(/\*\*(.*?)\*\*/g).map((part, pi) =>
                pi % 2 === 1
                  ? <strong key={pi} style={{ color: '#f1f5f9' }}>{part}</strong>
                  : <span key={pi}>{part}</span>
              )}
            </li>
          ))}
        </ul>
      );
      continue;
    } else if (line.match(/^\d+\.\s/)) {
      // Numbered list
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        items.push(lines[i].replace(/^\d+\.\s*/, ''));
        i++;
      }
      elements.push(
        <ol key={`num-${i}`} style={{ marginLeft: '16px', marginBottom: '8px' }}>
          {items.map((item, ni) => (
            <li key={ni} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#94a3b8', marginBottom: '4px', lineHeight: 1.5 }}>
              {item.split(/\*\*(.*?)\*\*/g).map((part, pi) =>
                pi % 2 === 1
                  ? <strong key={pi} style={{ color: '#f1f5f9' }}>{part}</strong>
                  : part
              )}
            </li>
          ))}
        </ol>
      );
      continue;
    } else if (line.startsWith('`') && line.endsWith('`')) {
      elements.push(
        <code key={i} style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#f59e0b',
          background: 'rgba(245,158,11,0.08)', padding: '2px 6px', borderRadius: '4px',
          border: '1px solid rgba(245,158,11,0.2)',
        }}>
          {line.replace(/`/g, '')}
        </code>
      );
    } else if (line.startsWith('⚠️') || line.startsWith('✓') || line.startsWith('•') || line.match(/^[✔✓✗!]/)) {
      const isPositive = line.startsWith('✓') || line.startsWith('✔');
      const isWarning = line.startsWith('⚠️');
      elements.push(
        <div key={i} style={{
          padding: '8px 12px', borderRadius: '8px', marginBottom: '6px',
          background: isPositive ? 'rgba(16,185,129,0.08)' : isWarning ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${isPositive ? 'rgba(16,185,129,0.25)' : isWarning ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'}`,
          fontFamily: "'DM Sans', sans-serif", fontSize: '12px',
          color: isPositive ? '#34d399' : isWarning ? '#fbbf24' : '#f87171',
        }}>
          {line}
        </div>
      );
    } else {
      // Regular paragraph with inline bold
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      elements.push(
        <p key={i} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, marginBottom: '6px' }}>
          {parts.map((part, pi) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pi} style={{ color: '#f1f5f9', fontWeight: 600 }}>{part.replace(/\*\*/g, '')}</strong>;
            }
            return part;
          })}
        </p>
      );
    }
    i++;
  }

  return <>{elements}</>;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface ChatSession {
  id: string;
  firstMessage: string;
  date: Date;
}

interface Agent {
  id: string;
  name: string;
  icon: React.FC<{ className?: string }>;
  active: boolean;
  lastUsed: string;
  systemPrompt: string;
  suggestedPrompts: string[];
}

export function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string>('project-analyzer');
  const [isTyping, setIsTyping] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [liveCounts, setLiveCounts] = useState({ projects: 0, invoices: 0, incidents: 0 });
  const [agentPanelOpen, setAgentPanelOpen] = useState(false);
  const [backendAgents, setBackendAgents] = useState<{ key: string; name: string; description: string; aliases: string[] }[]>([]);
  const [agentHealth, setAgentHealth] = useState<'online' | 'offline' | 'checking'>('checking');
  const [_activeAgentKey, setActiveAgentKey] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(12).fill(0.1));
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const animateWaveform = () => {
    setWaveformBars(prev => prev.map(() => Math.random() * 0.8 + 0.2));
    animationFrameRef.current = requestAnimationFrame(animateWaveform);
  };

  const startBrowserRecording = () => {
    const SRConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SRConstructor) {
      toast.error('Speech recognition not supported in this browser');
      return;
    }

    const recognition: SpeechRecognition = new SRConstructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-GB';

    recognition.onstart = () => {
      setIsRecording(true);
      setRecordingError(null);
      animateWaveform();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + ' ';
        }
      }
      if (final) {
        setInput(prev => prev + final);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsRecording(false);
      if (event.error === 'not-allowed') {
        setRecordingError('Microphone access denied. Please allow microphone access.');
        toast.error('Microphone access denied');
      } else if (event.error === 'no-speech') {
        setRecordingError('No speech detected. Please try again.');
      } else {
        setRecordingError(`Recording error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      setWaveformBars(Array(12).fill(0.1));
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopBrowserRecording = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  };

  const startVoiceInput = async () => {
    setRecordingError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      startBrowserRecording();
    } catch {
      toast.error('Could not access microphone. Using server-side transcription.');
      setRecordingError('Falling back to server transcription...');
      setTimeout(() => setRecordingError(null), 3000);
    }
  };

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      stopBrowserRecording();
    } else {
      setIsRecording(false);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
  };

  // Fetch agent status and live KPIs on mount
  useEffect(() => {
    fetchAgentStatus()
      .then(data => { setBackendAgents(data.agents); setAgentHealth('online'); })
      .catch(() => setAgentHealth('offline'));

    dashboardApi.getOverview().then(d => {
      setLiveCounts({
        projects: d.kpi?.activeProjects ?? 0,
        invoices: d.kpi?.invoiceCount ?? 0,
        incidents: d.kpi?.safetyIncidents ?? 0,
      });
    }).catch(e => console.warn('[AIAssistant] dashboard fetch failed:', e));
  }, []);
  useEffect(() => {
    dashboardApi.getOverview().then(d => {
      setLiveCounts({
        projects: d.kpi?.activeProjects ?? 0,
        invoices: d.kpi?.invoiceCount ?? 0,
        incidents: d.kpi?.safetyIncidents ?? 0,
      });
    }).catch(e => console.warn('[AIAssistant] dashboard fetch failed:', e));
  }, []);

  // Load sessions from backend on mount, fall back to localStorage
  useEffect(() => {
    aiConversationsApi.getSessions().then(data => {
      if (data.sessions.length > 0) {
        setChatSessions(data.sessions.map(s => ({
          id: s.id,
          firstMessage: s.first_user_message || 'New conversation',
          date: new Date(s.updated_at),
        })));
        return;
      }
      throw new Error('empty');
    }).catch(err => {
      console.warn('[AIAssistant] sessions fetch failed, using sessionStorage fallback:', err);
      try {
        const saved = sessionStorage.getItem('cortex_ai_sessions');
        if (saved) setChatSessions(JSON.parse(saved));
      } catch (_e) { /* ignore sessionStorage failure */ }
    });
  }, []);

  // Save sessions to localStorage on change
  useEffect(() => {
    try { sessionStorage.setItem('cortex_ai_sessions', JSON.stringify(chatSessions)); } catch (err) {
      console.warn('Failed to save AI sessions to localStorage:', err);
    }
  }, [chatSessions]);

  // Load session messages from server (primary) with localStorage fallback
  const loadSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setMessages([]); // clear immediately so old messages don't flash

    // Server first, localStorage as fallback
    aiConversationsApi.getSession(sessionId)
      .then(({ messages: serverMessages }) => {
        // Adapt API response { id, role, content, model, created_at } → Message
        const adapted: Message[] = serverMessages.map((m) => ({
          id: m.id || String(Date.now() + Math.random()),
          role: m.role,
          content: m.content,
          timestamp: m.created_at ? new Date(m.created_at) : new Date(),
        }));
        setMessages(adapted);
        // Mirror to localStorage as backup
        try { sessionStorage.setItem(`cortex_ai_session_${sessionId}`, JSON.stringify(adapted)); } catch (e) { console.warn('[AI] Failed to persist session to sessionStorage:', e); }
      })
      .catch(err => {
        console.warn('[AIAssistant] messages fetch failed, falling back to sessionStorage:', err);
        try {
          const saved = sessionStorage.getItem(`cortex_ai_session_${sessionId}`);
          setMessages(saved ? JSON.parse(saved) : []);
        } catch (e) { console.warn('[AI] Failed to load session from sessionStorage:', e); setMessages([]); }
      });
  };

  // Persist current session messages to localStorage as backup
  useEffect(() => {
    if (!currentSessionId) return;
    try { localStorage.setItem(`cortex_ai_session_${currentSessionId}`, JSON.stringify(messages)); } catch (e) { console.warn('[AI] Failed to persist chat to localStorage:', e); }
  }, [messages, currentSessionId]);
  const { selectedIds, toggle, clearSelection } = useBulkSelection();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} chat session(s)?`)) return;
    try {
      // Delete from server (async, non-blocking) and localStorage
      await Promise.allSettled(
        ids.map(id => aiConversationsApi.deleteSession(id).catch(e => console.warn('[AI] Failed to delete session:', id, e)))
      );
      ids.forEach(id => { try { localStorage.removeItem(`cortex_ai_session_${id}`); } catch (e) { console.warn('[AI] Failed to remove session from localStorage:', e); } });
      setChatSessions(prev => prev.filter(s => !ids.includes(s.id)));
      if (ids.includes(currentSessionId || '')) { setCurrentSessionId(null); setMessages([]); }
      toast.success(`Deleted ${ids.length} session(s)`);
      clearSelection();
    } catch (err) {
      console.error('[AI] Bulk delete failed:', err);
      toast.error('Bulk delete failed');
    }
  }

  const agents: Agent[] = [
    {
      id: 'project-analyzer',
      name: 'Project Analyzer',
      icon: Brain,
      active: true,
      lastUsed: '2 hours ago',
      systemPrompt: 'You are an expert construction project manager. Provide insights on project progress, budgets, schedules, and risks. Reference real project data when answering questions.',
      suggestedPrompts: [
        'What projects are currently active?',
        'Show me the Canary Wharf project status',
        'Which projects are over budget?',
        'Project completion forecast for Q2?',
        'Compare Birmingham Bridge vs Manchester Apartments',
        'Show risk summary for all projects'
      ]
    },
    {
      id: 'safety-compliance',
      name: 'Safety Compliance',
      icon: Shield,
      active: true,
      lastUsed: '1 hour ago',
      systemPrompt: 'You are a safety and compliance expert. Analyze incidents, generate RAMS documents, ensure regulatory adherence, and provide safety recommendations. Use actual safety data in your responses.',
      suggestedPrompts: [
        "What are this week's safety incidents?",
        'Generate RAMS for scaffold erection',
        'Show serious hazards requiring action',
        'Compliance status across all sites?',
        'Near-miss trend analysis',
        'RAMS approval summary'
      ]
    },
    {
      id: 'financial-advisor',
      name: 'Financial Advisor',
      icon: TrendingUp,
      active: true,
      lastUsed: '30 mins ago',
      systemPrompt: 'You are a financial expert in construction. Analyze invoices, cash flow, CIS deductions, change orders, and profitability. Provide real financial data and recommendations.',
      suggestedPrompts: [
        'Any overdue invoices?',
        'What is our current cash position?',
        'Calculate CIS for Apex Electrical',
        'Change orders status summary',
        'Invoice aging analysis',
        'Project profitability breakdown'
      ]
    },
    {
      id: 'document-processor',
      name: 'Document Processor',
      icon: FileText,
      active: true,
      lastUsed: '3 days ago',
      systemPrompt: 'You are an expert in construction documentation. Help with RFIs, drawings, contracts, permits, and document management. Reference actual documents and RFI data.',
      suggestedPrompts: [
        'Draft response for RFI-CW-042',
        'RFI status across all projects',
        'What documents do we need for Sheffield Hospital?',
        'Pending RFI responses',
        'Document version control summary',
        'Create specification clarification'
      ]
    },
    {
      id: 'schedule-manager',
      name: 'Schedule Manager',
      icon: Calendar,
      active: true,
      lastUsed: '5 days ago',
      systemPrompt: 'You are a construction scheduling expert. Manage timelines, milestone tracking, schedule impacts, and resource planning. Use actual project schedule data.',
      suggestedPrompts: [
        'Project timeline overview',
        'Critical path analysis — Canary Wharf',
        'Schedule delay risks',
        'Upcoming milestones this month',
        'Resource allocation by project',
        'Programme impact of change orders'
      ]
    },
    {
      id: 'rams-generator',
      name: 'RAMS Generator',
      icon: Zap,
      active: true,
      lastUsed: '1 week ago',
      systemPrompt: 'You are a RAMS (Risk Assessment Method Statement) specialist. Generate comprehensive RAMS documents with hazard identification, controls, and method statements.',
      suggestedPrompts: [
        'Generate RAMS for concrete pour',
        'RAMS for crane operations',
        'Working at height method statement',
        'Excavation and shoring RAMS',
        'Steelwork erection RAMS',
        'Review RAMS approval status'
      ]
    },
    {
      id: 'rfi-responder',
      name: 'RFI Responder',
      icon: MessageSquare,
      active: true,
      lastUsed: '2 days ago',
      systemPrompt: 'You are an RFI (Request For Information) specialist. Respond to RFI queries with technical accuracy, referencing drawings and specifications. Use actual RFI data.',
      suggestedPrompts: [
        'Outstanding RFI list',
        'Draft technical response for RFI-MC-018',
        'RFI priority matrix',
        'Average RFI response time',
        'Critical path RFIs',
        'RFI resolution summary'
      ]
    },
    {
      id: 'tender-scorer',
      name: 'Tender Scorer',
      icon: Award,
      active: true,
      lastUsed: '3 days ago',
      systemPrompt: 'You are a tender and bid specialist. Evaluate opportunities, score tenders, assess win probability, and provide strategy recommendations.',
      suggestedPrompts: [
        'Tender pipeline status',
        'Win probability analysis',
        'Tender scoring breakdown',
        'Royal Liverpool University Hospital opportunity',
        'Resource capacity for upcoming tenders?',
        'Tender strategy recommendations'
      ]
    }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date()
    };

    const isNewSession = messages.length === 0;
    const sessionIdForSave = isNewSession ? Date.now().toString() : currentSessionId;

    // Persist user message to server (async, non-blocking) and localStorage backup
    if (sessionIdForSave) {
      aiConversationsApi.saveMessage({ sessionId: sessionIdForSave, role: 'user', content: messageText }).catch(e => console.warn('[AI] Failed to persist user message:', e));
    }

    if (isNewSession) {
      const newSessionId = sessionIdForSave as string;
      setChatSessions(prev => [
        { id: newSessionId, firstMessage: messageText, date: new Date() },
        ...prev
      ]);
      setCurrentSessionId(newSessionId);
    }

    const finalSessionId = sessionIdForSave;

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    setIsTyping(true);

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    };

    setMessages(prev => [...prev, assistantMessage]);

    streamChatMessage(
      messageText,
      {
        agent: selectedAgent,
        liveKpis: liveCounts,
        timestamp: new Date().toISOString()
      },
      (token) => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.isStreaming) {
            return [...prev.slice(0, -1), { ...last, content: last.content + token }];
          }
          return prev;
        });
      },
      (intent) => {
        const finalMsg: Message = {
          id: assistantMessage.id,
          role: 'assistant',
          content: messages.length > 0
            ? (messages[messages.length - 1]?.content || '')
            : assistantMessage.content,
          timestamp: new Date(),
          isStreaming: false
        };
        setMessages(prev => {
          const filtered = prev.filter(m => m.isStreaming);
          return filtered.length ? prev : [...prev, finalMsg];
        });
        setIsTyping(false);
        setActiveAgentKey(intent || null);
        if (finalSessionId) {
          aiConversationsApi.saveMessage({ sessionId: finalSessionId, role: 'assistant', content: finalMsg.content }).catch(e => console.warn('[AI] Failed to persist assistant message:', e));
        }
      },
      (error) => {
        console.error('AI streaming error:', error);
        setMessages(prev => prev.filter(m => m.isStreaming));
        setIsTyping(false);
        toast.error('AI request failed');
      }
    );
  };

  const selectedAgentData = agents.find(a => a.id === selectedAgent)!;

  return (
    <>
      <ModuleBreadcrumbs currentModule="ai-assistant" />
      <div className="h-full flex bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Left Sidebar - Chat History & Agents - hidden on mobile */}
      <div className="hidden md:flex w-64 border-r border-gray-800 bg-gray-900/50 p-4 overflow-y-auto flex-col">
        {/* Agent Status Toggle */}
        <button
          onClick={() => setAgentPanelOpen(p => !p)}
          className={clsx(
            'mb-4 w-full flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition',
            agentPanelOpen
              ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
              : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:text-gray-300 hover:border-gray-600'
          )}
        >
          {agentHealth === 'online' ? (
            <><Radio className="h-4 w-4 text-emerald-400" /> Agent Status</>
          ) : agentHealth === 'offline' ? (
            <><WifiOff className="h-4 w-4 text-red-400" /> Agent Offline</>
          ) : (
            <><Cpu className="h-4 w-4 text-gray-400 animate-pulse" /> Checking Agents...</>
          )}
        </button>

        {/* Agent Status Panel */}
        {agentPanelOpen && (
          <div className="mb-4 rounded-xl border border-amber-500/20 bg-gray-900/80 p-3">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-400/70">Active Agents</h3>
            <div className="space-y-2">
              {backendAgents.length === 0 && agentHealth === 'checking' && (
                <p className="text-xs text-gray-500">Loading...</p>
              )}
              {backendAgents.map(agent => (
                <div key={agent.key} className="flex items-start gap-2">
                  <div className={clsx(
                    'mt-0.5 h-2 w-2 rounded-full flex-shrink-0',
                    agentHealth === 'online' ? 'bg-emerald-400' : 'bg-gray-600'
                  )} />
                  <div>
                    <p className="text-xs font-semibold text-white">{agent.name}</p>
                    <p className="text-xs text-gray-500 leading-tight">{agent.description}</p>
                  </div>
                </div>
              ))}
              {agentHealth === 'offline' && (
                <p className="text-xs text-red-400">Backend agents unreachable. Check API server.</p>
              )}
            </div>
          </div>
        )}

        {/* Chat History */}
        {chatSessions.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500">Today's Chats</h3>
            <div className="space-y-1">
              {chatSessions.map(session => {
                const isSelected = selectedIds.has(session.id);
                return (
                  <button
                    key={session.id}
                    onClick={() => {
                      if (currentSessionId) {
                        try { localStorage.setItem(`cortex_ai_session_${currentSessionId}`, JSON.stringify(messages)); } catch (e) { console.warn('[AI] Failed to persist chat to localStorage:', e); }
                      }
                      setCurrentSessionId(session.id);
                      loadSession(session.id);
                    }}
                    className={clsx(
                      'w-full rounded-lg border px-3 py-2 text-left text-xs transition flex items-start gap-2',
                      currentSessionId === session.id
                        ? 'border-blue-600 bg-blue-900/30 text-white'
                        : 'border-gray-700 bg-gray-800/20 text-gray-400 hover:text-gray-300'
                    )}
                  >
                    <button type="button" onClick={e => { e.stopPropagation(); toggle(session.id); }} className="mt-0.5">
                      {isSelected ? <CheckSquare size={14} className="text-blue-400"/> : <Square size={14} className="text-gray-500"/>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-3 w-3" />
                        <span className="truncate font-medium">{session.firstMessage.slice(0, 40)}</span>
                      </div>
                      <div className="text-xs text-gray-500">{session.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Agents */}
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">AI Agents</h2>
        <div className="space-y-2 flex-1">
          {agents.map(agent => {
            const Icon = agent.icon;
            return (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent.id)}
                className={clsx(
                  'w-full rounded-xl border p-3 text-left transition-all',
                  selectedAgent === agent.id
                    ? 'border-blue-600 bg-blue-900/30'
                    : 'border-gray-800 bg-gray-800/30 hover:bg-gray-800/50'
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-semibold text-white">{agent.name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Active
                  </span>
                  <span className="text-gray-500">{agent.lastUsed}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b border-gray-800 bg-gradient-to-r from-blue-900/20 to-purple-900/10 px-4 md:px-6 py-3 md:py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <h1 className="mb-1 text-xl md:text-2xl font-bold text-white">CortexBuild AI</h1>
              <p className="text-xs text-blue-300 hidden sm:block">
                {selectedAgentData.name} · {selectedAgentData.systemPrompt.slice(0, 60)}...
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-gray-800/50 px-3 py-2 text-xs">
              <Archive className="h-4 w-4 text-gray-400" />
              <span className="text-gray-300 hidden sm:inline">
                <span className="font-semibold text-white">{liveCounts.projects}</span> Projects ·
                <span className="ml-1 font-semibold text-white">{liveCounts.invoices}</span> Invoices ·
                <span className="ml-1 font-semibold text-white">{liveCounts.incidents}</span> Incidents
              </span>
              <span className="sm:hidden text-gray-300">
                <span className="font-semibold text-white">{liveCounts.projects}</span>P ·
                <span className="font-semibold text-white">{liveCounts.invoices}</span>I ·
                <span className="font-semibold text-white">{liveCounts.incidents}</span>S
              </span>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center">
              <selectedAgentData.icon className="mb-4 h-12 w-12 text-blue-500/50" />
              <h2 className="mb-2 text-xl font-bold text-white">{selectedAgentData.name}</h2>
              <p className="mb-6 text-center text-sm text-gray-400 max-w-md">
                {selectedAgentData.systemPrompt}
              </p>
              <div className="grid grid-cols-1 gap-2 w-full max-w-2xl">
                {selectedAgentData.suggestedPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="quick-chip rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-sm text-gray-300 text-left hover:border-blue-600 hover:bg-gray-800 hover:text-white"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <span style={{ fontFamily: "'DM Sans', sans-serif" }}>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map(msg => (
                <div key={msg.id} className={clsx('flex gap-3 message-enter', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {msg.role === 'assistant' && (
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-600/20 flex items-center justify-center mt-1">
                      <selectedAgentData.icon className="h-4 w-4 text-blue-400" />
                    </div>
                  )}
                  <div
                    className={clsx(
                      'max-w-2xl rounded-xl px-4 py-3 text-sm leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-100 border border-gray-700'
                    )}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-invert prose-sm">
                        {renderMessageContent(msg.content)}
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-600/20 flex items-center justify-center mt-1">
                    <selectedAgentData.icon className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="bg-gray-800 text-gray-400 rounded-xl px-4 py-3 border border-gray-700">
                    <div className="flex gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-gray-500 typing-dot" />
                      <div className="h-2 w-2 rounded-full bg-gray-500 typing-dot" />
                      <div className="h-2 w-2 rounded-full bg-gray-500 typing-dot" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Quick Prompts */}
        <div className="border-t border-gray-800 bg-gray-900/50 px-4 pt-3 pb-1">
          <div className="flex flex-wrap gap-2">
            {[
              'Summarise this project',
              "What's my project status?",
              'Show me overdue items',
              'Safety incidents this week',
              'Cash position update',
              'Next milestones',
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSendMessage(prompt)}
                className="quick-prompt-chip text-xs px-3 py-1.5 rounded-full border border-blue-800/60 bg-blue-900/30 text-blue-300 hover:bg-blue-800/50 hover:text-white hover:border-blue-600 transition-all cursor-pointer font-medium"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-800 bg-gray-900/50 p-4">
          {recordingError && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
              <MicOff className="h-4 w-4 text-red-400" />
              <span className="text-xs text-red-400">{recordingError}</span>
            </div>
          )}
          {isRecording && (
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                </div>
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Recording</span>
              </div>
              <div className="flex items-center gap-0.5">
                {waveformBars.map((height, i) => (
                  <div
                    key={i}
                    className="w-1 rounded-full bg-amber-400/70"
                    style={{ height: `${height * 24 + 4}px` }}
                  />
                ))}
              </div>
              <span className="ml-2 text-xs text-amber-400/60">Click mic to stop</span>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={isRecording ? stopVoiceInput : startVoiceInput}
              className={clsx(
                'rounded-xl border p-3 transition-all flex-shrink-0 mobile-tap-target',
                isRecording
                  ? 'border-red-500/50 bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'border-gray-700 bg-gray-800 text-gray-400 hover:text-white hover:border-blue-600 hover:bg-gray-700'
              )}
              title={isRecording ? 'Stop recording' : 'Voice input'}
              aria-label={isRecording ? 'Stop recording' : 'Voice input'}
            >
              {isRecording ? (
                <AudioWaveform className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={`Ask ${selectedAgentData.name.toLowerCase()}...`}
              className="flex-1 rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-600"
            />
            <button
              onClick={() => handleSendMessage()}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 p-3 text-white transition hover:from-blue-500 hover:to-blue-600"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>

        <BulkActionsBar
          selectedIds={Array.from(selectedIds)}
          actions={[
            { id: 'delete', label: 'Delete Selected', icon: Trash2, variant: 'danger', onClick: handleBulkDelete, confirm: 'This action cannot be undone.' },
          ]}
          onClearSelection={clearSelection}
        />
      </div>
    </div>
    </>
  );
}
export default AIAssistant;
