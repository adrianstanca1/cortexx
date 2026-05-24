import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Terminal, Play, AlertCircle, CheckCircle,
  Activity, Code, Settings, X, Upload, Download, RefreshCw, Copy, FileText,
  Wifi, WifiOff, Plus, Trash2, ToggleRight, GripVertical, Send, Zap, Globe, Flag, Filter
} from 'lucide-react';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';

type TabType = 'ai-tester' | 'api-explorer' | 'websocket' | 'feature-flags' | 'logs';
type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  source?: string;
}

interface ApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTime: number;
}

interface AIPreset {
  id: string;
  name: string;
  system: string;
  prompt: string;
}

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  environment: 'production' | 'staging' | 'dev';
  accessLevel: 'everyone' | 'admins' | 'devs';
}

interface WebSocketMessage {
  id: string;
  timestamp: string;
  type: string;
  payload: string;
  direction: 'in' | 'out';
}

const generateMockResponse = (prompt: string): string => {
  // Mock AI responses based on prompt content
  if (prompt.toLowerCase().includes('bim')) {
    return 'Building Information Modeling (BIM) is a digital representation process that combines 3D models with data to provide comprehensive project visualization, enabling better collaboration, planning, and lifecycle management in construction projects.';
  }
  if (prompt.toLowerCase().includes('construction')) {
    return 'Construction management involves coordinating resources, schedules, and processes to deliver building projects safely, on time, and within budget while maintaining quality standards.';
  }
  if (prompt.toLowerCase().includes('safety')) {
    return 'Construction safety protocols include hazard identification, risk assessment, PPE requirements, safety training, and continuous monitoring to prevent accidents and ensure worker wellbeing.';
  }

  return `Processed prompt: "${prompt}"\n\nThis is a mock response from the DevSandbox environment. In production, this would connect to your preferred AI service (OpenAI, Anthropic, Google, etc.) with the configured parameters.`;
};

const DEFAULT_PRESETS: AIPreset[] = [
  {
    id: 'summarize-rfi',
    name: 'Summarize RFI',
    system: 'You are a construction project administrator. Summarize RFI requests concisely.',
    prompt: 'Please summarize this RFI request in bullet points:',
  },
  {
    id: 'rams-assessment',
    name: 'Generate RAMS risk assessment',
    system: 'You are a construction safety expert specializing in risk assessment and method statements.',
    prompt: 'Generate a RAMS document for:',
  },
  {
    id: 'variation-notice',
    name: 'Draft variation notice',
    system: 'You are a construction contract manager. Draft professional variation notices.',
    prompt: 'Please draft a variation notice for the following change:',
  },
  {
    id: 'safety-analysis',
    name: 'Analyze safety data',
    system: 'You are a health and safety specialist. Analyze incident data and provide insights.',
    prompt: 'Analyze the following safety incident data:',
  },
];

const DEFAULT_FEATURE_FLAGS: FeatureFlag[] = [
  { id: 'bim-viewer', name: 'BIM Viewer', description: 'View 3D BIM models', enabled: true, environment: 'production', accessLevel: 'everyone' },
  { id: 'bim-4d', name: '4D BIM', description: 'Time-based construction sequencing', enabled: false, environment: 'production', accessLevel: 'admins' },
  { id: 'ai-vision', name: 'AI Vision', description: 'Image analysis with AI', enabled: true, environment: 'production', accessLevel: 'everyone' },
  { id: 'carbon-est', name: 'Carbon Estimating', description: 'Estimate project carbon footprint', enabled: true, environment: 'staging', accessLevel: 'everyone' },
  { id: 'client-portal', name: 'Client Portal', description: 'Client dashboard access', enabled: true, environment: 'production', accessLevel: 'everyone' },
  { id: 'pred-analytics', name: 'Predictive Analytics', description: 'ML-based forecasting', enabled: false, environment: 'staging', accessLevel: 'devs' },
  { id: 'adv-analytics', name: 'Advanced Analytics', description: 'Custom reporting engine', enabled: true, environment: 'production', accessLevel: 'admins' },
  { id: 'webhooks', name: 'Webhooks', description: 'Event-driven integrations', enabled: true, environment: 'production', accessLevel: 'devs' },
  { id: 'mobile-app', name: 'Mobile App', description: 'Native mobile applications', enabled: true, environment: 'production', accessLevel: 'everyone' },
  { id: 'dark-mode', name: 'Dark Mode', description: 'Dark theme interface', enabled: true, environment: 'production', accessLevel: 'everyone' },
  { id: 'debug-mode', name: 'Debug Mode', description: 'Enhanced logging and dev tools', enabled: false, environment: 'dev', accessLevel: 'devs' },
];

export const DevSandbox: React.FC = () => {
  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>('ai-tester');

  // AI Tester State
  const [prompt, setPrompt] = useState('Explain the concept of BIM (Building Information Modeling) in one sentence.');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [temperature, setTemperature] = useState(1.0);
  const [topP, setTopP] = useState(0.95);
  const [maxTokens, setMaxTokens] = useState(500);
  const [jsonMode, setJsonMode] = useState(false);
  const [systemInstruction, setSystemInstruction] = useState('');
  const [selectedModel, setSelectedModel] = useState('qwen3.5:9b');
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [presets, setPresets] = useState<AIPreset[]>(DEFAULT_PRESETS);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // API Explorer State
  const [apiMethod, setApiMethod] = useState('GET');
  const [apiEndpoint, setApiEndpoint] = useState('/api/projects');
  const [apiHeaders, setApiHeaders] = useState<Array<{ key: string; value: string }>>([{ key: 'Content-Type', value: 'application/json' }]);
  const [apiBody, setApiBody] = useState('{}');
  const [apiResponse, setApiResponse] = useState<{ status: number; body: string; time: number } | null>(null);
  const [apiLoading, setApiLoading] = useState(false);

  // WebSocket State
  const [wsConnected, setWsConnected] = useState(true);
  const [wsMessages, setWsMessages] = useState<WebSocketMessage[]>([]);
  const [wsTestPayload, setWsTestPayload] = useState('{"type":"ping"}');
  const [wsStats, setWsStats] = useState({ sent: 0, received: 0, uptime: '0s' });

  // Feature Flags State
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>(DEFAULT_FEATURE_FLAGS);

  // Logs State
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    const initialLogs: LogEntry[] = [
      { timestamp: new Date().toLocaleTimeString(), level: 'info', source: 'System', message: 'DevSandbox initialized' },
      { timestamp: new Date().toLocaleTimeString(), level: 'info', source: 'API', message: 'API Connection: Ready' },
    ];
    return initialLogs;
  });
  const [logFilter, setLogFilter] = useState<LogLevel | 'ALL'>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);

  // Configuration State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [environment, setEnvironment] = useState<'development' | 'staging' | 'production'>('development');
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Simulate log growth every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const levels: LogLevel[] = ['info', 'warn', 'error', 'debug', 'success'];
      const sources = ['System', 'API', 'WebSocket', 'AI', 'Database'];
      const messages = [
        'Request processed successfully',
        'Cache hit on endpoint',
        'Database query completed',
        'Model inference completed',
        'Webhook triggered',
        'Session updated',
        'Health check passed',
      ];
      const randomLevel = levels[Math.floor(Math.random() * levels.length)];
      const randomSource = sources[Math.floor(Math.random() * sources.length)];
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];

      addLog(randomLevel, randomMessage, randomSource);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const addLog = useCallback((level: LogLevel, message: string, source?: string) => {
    const entry: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      source,
    };
    setLogs(prev => [entry, ...prev.slice(0, 99)]);
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setSelectedImage(result);
        addLog('success', `Image loaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'AI');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRunPrompt = useCallback(async () => {
    if ((!prompt.trim() && !selectedImage) || isLoading) return;

    setIsLoading(true);
    const startTime = Date.now();

    addLog('info', `Sending request to ${selectedModel}...`, 'AI');
    addLog('info', `Params: Temp=${temperature}, TopP=${topP}, MaxTokens=${maxTokens}, JSON=${jsonMode}`, 'AI');

    try {
      const mockResponse: ApiResponse = {
        success: true,
        data: generateMockResponse(prompt),
        executionTime: Date.now() - startTime
      };

      setResponse(mockResponse.data as string);
      setResponseTime(mockResponse.executionTime);
      addLog('success', `Response received (${mockResponse.executionTime}ms, ~${Math.floor(Math.random() * 500 + 100)} tokens)`, 'AI');

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', `Request failed: ${errorMsg}`, 'AI');
      setResponse(`Error: ${errorMsg}`);
    }

    setIsLoading(false);
  }, [prompt, selectedImage, isLoading, temperature, topP, maxTokens, jsonMode, selectedModel, addLog]);

  const handleSavePreset = useCallback(() => {
    const presetName = window.prompt('Enter preset name:');
    if (presetName) {
      const newPreset: AIPreset = {
        id: `preset-${Date.now()}`,
        name: presetName,
        system: systemInstruction,
        prompt,
      };
      setPresets(prev => [...prev, newPreset]);
      addLog('success', `Preset "${presetName}" saved`, 'AI');
    }
  }, [prompt, systemInstruction, addLog]);

  const handleLoadPreset = useCallback((presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setSystemInstruction(preset.system);
      setPrompt(preset.prompt);
      setSelectedPreset(presetId);
      addLog('info', `Preset "${preset.name}" loaded`, 'AI');
    }
  }, [presets, addLog]);

  const handleSendApiRequest = useCallback(async () => {
    setApiLoading(true);
    const startTime = Date.now();
    addLog('info', `${apiMethod} ${apiEndpoint}`, 'API');

    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const mockStatus = Math.random() > 0.2 ? 200 : 400;
      const mockBody = mockStatus === 200
        ? JSON.stringify({ success: true, data: { id: '123', name: 'Sample Data' } }, null, 2)
        : JSON.stringify({ error: 'Not found' }, null, 2);

      setApiResponse({
        status: mockStatus,
        body: mockBody,
        time: Date.now() - startTime,
      });
      addLog(mockStatus === 200 ? 'success' : 'error', `${apiMethod} ${apiEndpoint} → ${mockStatus}`, 'API');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', `API request failed: ${errorMsg}`, 'API');
    }

    setApiLoading(false);
  }, [apiMethod, apiEndpoint, apiHeaders, apiBody, addLog]);

  const handleAddApiHeader = useCallback(() => {
    setApiHeaders(prev => [...prev, { key: '', value: '' }]);
  }, []);

  const handleRemoveApiHeader = useCallback((index: number) => {
    setApiHeaders(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleToggleFeatureFlag = useCallback((id: string) => {
    setFeatureFlags(prev =>
      prev.map(flag =>
        flag.id === id ? { ...flag, enabled: !flag.enabled } : flag
      )
    );
  }, []);

  const handleResetFeatureFlags = useCallback(() => {
    setFeatureFlags(DEFAULT_FEATURE_FLAGS);
    addLog('info', 'Feature flags reset to defaults', 'System');
  }, [addLog]);

  const handleToggleWebSocket = useCallback(() => {
    setWsConnected(!wsConnected);
    if (!wsConnected) {
      addLog('success', 'WebSocket connected', 'WebSocket');
    } else {
      addLog('warn', 'WebSocket disconnected', 'WebSocket');
    }
  }, [wsConnected, addLog]);

  const handleSendWsMessage = useCallback(() => {
    if (!wsConnected) {
      addLog('error', 'Cannot send message: WebSocket not connected', 'WebSocket');
      return;
    }

    const message: WebSocketMessage = {
      id: `msg-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      type: 'message',
      payload: wsTestPayload,
      direction: 'out',
    };

    setWsMessages(prev => [...prev, message]);
    addLog('info', `WS out: ${wsTestPayload}`, 'WebSocket');
    setWsStats(prev => ({ ...prev, sent: prev.sent + 1 }));

    // Simulate response
    setTimeout(() => {
      const response: WebSocketMessage = {
        id: `msg-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        type: 'response',
        payload: '{"type":"pong","status":"ok"}',
        direction: 'in',
      };
      setWsMessages(prev => [...prev, response]);
      addLog('info', 'WS in: {"type":"pong","status":"ok"}', 'WebSocket');
      setWsStats(prev => ({ ...prev, received: prev.received + 1 }));
    }, 200);
  }, [wsConnected, wsTestPayload, addLog]);

  const filteredLogs = logFilter === 'ALL' ? logs : logs.filter(log => log.level === logFilter);

  const getLogColor = (level: LogLevel): string => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-amber-400';
      case 'success': return 'text-green-400';
      case 'debug': return 'text-gray-400';
      default: return 'text-blue-400';
    }
  };

  const clearLogs = useCallback(() => {
    setLogs([]);
    addLog('info', 'Logs cleared', 'System');
  }, [addLog]);

  const exportLogs = useCallback(() => {
    const logData = logs.map(log => `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.source || 'System'}] ${log.message}`).join('\n');
    const blob = new Blob([logData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devsandbox-logs-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [logs]);

  const getLogIcon = (level: LogLevel) => {
    switch (level) {
      case 'error': return <AlertCircle className="h-3 w-3 text-red-500" />;
      case 'warn': return <AlertCircle className="h-3 w-3 text-amber-500" />;
      case 'success': return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'debug': return <Code className="h-3 w-3 text-gray-500" />;
      default: return <Activity className="h-3 w-3 text-blue-500" />;
    }
  };

  const QUICK_API_REQUESTS = [
    { label: 'List Projects', method: 'GET', endpoint: '/api/projects' },
    { label: 'Get Team', method: 'GET', endpoint: '/api/team' },
    { label: 'Safety Incidents', method: 'GET', endpoint: '/api/incidents' },
    { label: 'Check Health', method: 'GET', endpoint: '/api/health' },
    { label: 'List Invoices', method: 'GET', endpoint: '/api/invoices' },
    { label: 'Pending RFIs', method: 'GET', endpoint: '/api/rfis?status=pending' },
    { label: 'Active Tenders', method: 'GET', endpoint: '/api/tenders?status=active' },
    { label: 'Dashboard Data', method: 'GET', endpoint: '/api/dashboard' },
  ];

  const MODEL_OPTIONS = ['qwen3.5:9b', 'gemma3:12b', 'llama2:13b', 'openrouter', 'ollama-fast', 'ollama-heavy'];

  return (
    <div className="p-6 space-y-6 bg-gray-950 min-h-screen">
      <ModuleBreadcrumbs currentModule="dev-sandbox" />
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <Terminal className="h-8 w-8 text-amber-500" />
              Dev Sandbox
            </h1>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">DEMO</span>
          </div>
          <p className="text-gray-400 mt-1">AI Development & Testing Environment — simulated responses</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as typeof environment)}
            className="px-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white text-sm"
          >
            <option value="development">Development</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
          </select>
          <div className="flex items-center gap-2 px-3 py-2 bg-green-900/30 text-green-400 rounded-lg text-sm border border-green-800/30">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Online
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-800 flex gap-1">
        <button
          onClick={() => setActiveTab('ai-tester')}
          className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
            activeTab === 'ai-tester'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Zap className="h-4 w-4" />
          AI Tester
        </button>
        <button
          onClick={() => setActiveTab('api-explorer')}
          className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
            activeTab === 'api-explorer'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Globe className="h-4 w-4" />
          API Explorer
        </button>
        <button
          onClick={() => setActiveTab('websocket')}
          className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
            activeTab === 'websocket'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Wifi className="h-4 w-4" />
          WebSocket
        </button>
        <button
          onClick={() => setActiveTab('feature-flags')}
          className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
            activeTab === 'feature-flags'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Flag className="h-4 w-4" />
          Feature Flags
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
            activeTab === 'logs'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Terminal className="h-4 w-4" />
          Logs
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* AI TESTER TAB */}
        {activeTab === 'ai-tester' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Presets */}
              <div className="card bg-gray-900 border border-gray-800">
                <div className="card-header">
                  <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
                    <FileText className="h-5 w-5 text-amber-400" />
                    Preset Prompts
                  </h2>
                </div>
                <div className="card-content">
                  <select
                    value={selectedPreset || ''}
                    onChange={(e) => e.target.value && handleLoadPreset(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white text-sm"
                  >
                    <option value="">Select a preset...</option>
                    {presets.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Model Configuration */}
              <div className="card bg-gray-900 border border-gray-800">
                <div className="card-header">
                  <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
                    <Settings className="h-5 w-5 text-gray-400" />
                    Model Configuration
                  </h2>
                </div>
                <div className="card-content space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Model
                    </label>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white text-sm"
                    >
                      {MODEL_OPTIONS.map(model => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Temperature: {temperature.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={temperature}
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Top P: {topP.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={topP}
                        onChange={(e) => setTopP(parseFloat(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Max Tokens: {maxTokens}
                    </label>
                    <input
                      type="range"
                      min="100"
                      max="2000"
                      step="50"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={jsonMode}
                      onChange={(e) => setJsonMode(e.target.checked)}
                      className="w-4 h-4 text-amber-500 border-gray-600 rounded bg-gray-800"
                    />
                    <span className="text-sm font-medium text-gray-300">JSON Mode</span>
                  </label>
                </div>
              </div>

              {/* System Instruction */}
              <div className="card bg-gray-900 border border-gray-800">
                <div className="card-header">
                  <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
                    <Code className="h-5 w-5 text-gray-400" />
                    System Instruction
                  </h2>
                </div>
                <div className="card-content">
                  <textarea
                    value={systemInstruction}
                    onChange={(e) => setSystemInstruction(e.target.value)}
                    placeholder="Enter system instruction to guide AI behavior..."
                    className="w-full p-3 border border-gray-700 rounded-lg resize-none bg-gray-800 text-white placeholder-gray-500 font-mono text-xs"
                    rows={3}
                  />
                </div>
              </div>

              {/* User Prompt */}
              <div className="card bg-gray-900 border border-gray-800">
                <div className="card-header">
                  <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
                    <Code className="h-5 w-5 text-gray-400" />
                    User Prompt
                  </h2>
                </div>
                <div className="card-content space-y-4">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Enter your test prompt..."
                    className="w-full p-3 border border-gray-700 rounded-lg resize-none bg-gray-800 text-white placeholder-gray-500 font-mono text-sm"
                    rows={5}
                  />

                  {/* Image Upload */}
                  <div className="pt-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Image Input (Optional)
                    </label>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Image
                      </button>
                      {selectedImage && (
                        <div className="flex items-center gap-2">
                          <img src={selectedImage} alt="Preview" className="w-10 h-10 object-cover rounded border border-gray-700" />
                          <button
                            onClick={() => setSelectedImage(null)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleRunPrompt}
                      disabled={isLoading || (!prompt.trim() && !selectedImage)}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      {isLoading ? 'Processing...' : 'Run Test'}
                    </button>
                    <button
                      onClick={handleSavePreset}
                      className="flex items-center gap-2 px-4 py-3 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                      title="Save as preset"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Response Display */}
              {response && (
                <div className="card bg-gray-900 border border-gray-800">
                  <div className="card-header flex justify-between items-center">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
                      <FileText className="h-5 w-5 text-gray-400" />
                      Response
                      {responseTime && (
                        <span className="text-xs text-gray-500 font-normal ml-2">({responseTime}ms)</span>
                      )}
                    </h2>
                    <button
                      onClick={() => navigator.clipboard.writeText(response)}
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors"
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </button>
                  </div>
                  <div className="card-content">
                    <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                      <pre className="whitespace-pre-wrap text-sm text-gray-200 font-mono">
                        {response}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <div className="card bg-gray-900 border border-gray-800">
                <div className="card-header">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
                    Status
                  </h3>
                </div>
                <div className="card-content space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Environment:</span>
                    <span className="font-medium capitalize text-white">{environment}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Model:</span>
                    <span className="font-medium text-amber-400">{selectedModel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className="font-mono text-green-400">Ready</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* API EXPLORER TAB */}
        {activeTab === 'api-explorer' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="card bg-gray-900 border border-gray-800">
                  <div className="card-header">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
                      <Globe className="h-5 w-5 text-amber-400" />
                      Request Builder
                    </h2>
                  </div>
                  <div className="card-content space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Method</label>
                        <select
                          value={apiMethod}
                          onChange={(e) => setApiMethod(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white text-sm"
                        >
                          <option>GET</option>
                          <option>POST</option>
                          <option>PUT</option>
                          <option>PATCH</option>
                          <option>DELETE</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-300 mb-2">Endpoint</label>
                        <input
                          type="text"
                          value={apiEndpoint}
                          onChange={(e) => setApiEndpoint(e.target.value)}
                          placeholder="/api/projects"
                          className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white text-sm"
                        />
                      </div>
                    </div>

                    {/* Headers */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-300">Headers</label>
                        <button
                          onClick={handleAddApiHeader}
                          className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
                        >
                          <Plus className="h-3 w-3" /> Add
                        </button>
                      </div>
                      <div className="space-y-2">
                        {apiHeaders.map((header, idx) => (
                          <div key={idx} className="flex gap-2">
                            <input
                              type="text"
                              value={header.key}
                              onChange={(e) => {
                                const updated = [...apiHeaders];
                                updated[idx].key = e.target.value;
                                setApiHeaders(updated);
                              }}
                              placeholder="Key"
                              className="flex-1 px-2 py-1 border border-gray-700 rounded bg-gray-800 text-white text-xs"
                            />
                            <input
                              type="text"
                              value={header.value}
                              onChange={(e) => {
                                const updated = [...apiHeaders];
                                updated[idx].value = e.target.value;
                                setApiHeaders(updated);
                              }}
                              placeholder="Value"
                              className="flex-1 px-2 py-1 border border-gray-700 rounded bg-gray-800 text-white text-xs"
                            />
                            <button
                              onClick={() => handleRemoveApiHeader(idx)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Request Body */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Request Body</label>
                      <textarea
                        value={apiBody}
                        onChange={(e) => setApiBody(e.target.value)}
                        placeholder='{}'
                        className="w-full p-3 border border-gray-700 rounded-lg bg-gray-800 text-white font-mono text-xs resize-none"
                        rows={4}
                      />
                    </div>

                    <button
                      onClick={handleSendApiRequest}
                      disabled={apiLoading}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors font-medium"
                    >
                      {apiLoading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {apiLoading ? 'Sending...' : 'Send Request'}
                    </button>
                  </div>
                </div>

                {/* Response */}
                {apiResponse && (
                  <div className="card bg-gray-900 border border-gray-800">
                    <div className="card-header">
                      <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
                        Response
                        <span className={`text-xs font-mono px-2 py-1 rounded ${apiResponse.status < 300 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {apiResponse.status}
                        </span>
                        <span className="text-xs text-gray-500 ml-auto">{apiResponse.time}ms</span>
                      </h2>
                    </div>
                    <div className="card-content">
                      <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                        <pre className="whitespace-pre-wrap text-sm text-gray-200 font-mono text-xs">
                          {apiResponse.body}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Access */}
              <div className="space-y-4">
                <div className="card bg-gray-900 border border-gray-800">
                  <div className="card-header">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
                      Quick Requests
                    </h3>
                  </div>
                  <div className="card-content space-y-2">
                    {QUICK_API_REQUESTS.map((req, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setApiMethod(req.method);
                          setApiEndpoint(req.endpoint);
                          handleSendApiRequest();
                        }}
                        className="w-full text-left px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300 transition-colors"
                      >
                        {req.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WEBSOCKET TAB */}
        {activeTab === 'websocket' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="card bg-gray-900 border border-gray-800">
                <div className="card-header">
                  <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
                    <Wifi className="h-5 w-5 text-amber-400" />
                    WebSocket Connection
                  </h2>
                </div>
                <div className="card-content space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                      <span className="text-lg font-semibold text-white">
                        {wsConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                    <button
                      onClick={handleToggleWebSocket}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        wsConnected
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      {wsConnected ? 'Disconnect' : 'Connect'}
                    </button>
                  </div>

                  {/* Message Log */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Message Log</label>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 h-48 overflow-y-auto space-y-2">
                      {wsMessages.length === 0 ? (
                        <div className="text-center text-gray-500 text-sm py-8">
                          No messages yet
                        </div>
                      ) : (
                        wsMessages.map(msg => (
                          <div key={msg.id} className={`text-xs font-mono p-2 rounded ${msg.direction === 'out' ? 'bg-blue-900/30 text-blue-300' : 'bg-green-900/30 text-green-300'}`}>
                            <div className="text-gray-400">{msg.timestamp} [{msg.direction === 'out' ? 'OUT' : 'IN'}]</div>
                            <div className="break-all">{msg.payload}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Send Message */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Send Test Message</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={wsTestPayload}
                        onChange={(e) => setWsTestPayload(e.target.value)}
                        placeholder='{"type":"ping"}'
                        className="flex-1 px-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white text-sm font-mono"
                        disabled={!wsConnected}
                      />
                      <button
                        onClick={handleSendWsMessage}
                        disabled={!wsConnected}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="card bg-gray-900 border border-gray-800">
              <div className="card-header">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
                  Statistics
                </h3>
              </div>
              <div className="card-content space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Sent:</span>
                  <span className="font-mono text-amber-400">{wsStats.sent}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Received:</span>
                  <span className="font-mono text-green-400">{wsStats.received}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Uptime:</span>
                  <span className="font-mono text-blue-400">{wsStats.uptime}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FEATURE FLAGS TAB */}
        {activeTab === 'feature-flags' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button
                onClick={handleResetFeatureFlags}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors text-sm"
              >
                <RefreshCw className="h-4 w-4" />
                Reset to Defaults
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featureFlags.map(flag => (
                <div key={flag.id} className="card bg-gray-900 border border-gray-800 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white text-sm">{flag.name}</h3>
                      <p className="text-xs text-gray-400 mt-1">{flag.description}</p>
                    </div>
                    <button
                      onClick={() => handleToggleFeatureFlag(flag.id)}
                      className={`flex-shrink-0 relative inline-flex h-6 w-11 rounded-full ${
                        flag.enabled ? 'bg-amber-600' : 'bg-gray-700'
                      } transition-colors`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          flag.enabled ? 'translate-x-6' : 'translate-x-0.5'
                        } mt-0.5`}
                      />
                    </button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-400">
                      {flag.environment}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-900/30 text-blue-300">
                      {flag.accessLevel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LOGS TAB */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG'].map(level => (
                  <button
                    key={level}
                    onClick={() => setLogFilter(level as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      logFilter === level
                        ? 'bg-amber-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-400">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  Auto-scroll
                </label>
                <button
                  onClick={exportLogs}
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm"
                >
                  <Download className="h-4 w-4 inline mr-1" />
                  Export
                </button>
                <button
                  onClick={clearLogs}
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="bg-black border border-gray-800 rounded-lg p-4 h-96 overflow-y-auto font-mono text-xs">
              {filteredLogs.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  No logs
                </div>
              ) : (
                filteredLogs.map((log, idx) => (
                  <div key={idx} className="mb-1">
                    <span className="text-gray-600">[{log.timestamp}]</span>
                    {' '}
                    <span className={`font-semibold ${getLogColor(log.level)}`}>
                      [{log.level.toUpperCase()}]
                    </span>
                    {' '}
                    <span className="text-blue-400">[{log.source || 'System'}]</span>
                    {' '}
                    <span className="text-gray-300">{log.message}</span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DevSandbox;
