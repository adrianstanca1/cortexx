import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera, Eye, AlertTriangle, CheckCircle2,
  AlertOctagon, Play, Pause, ScanLine,
  Target, Activity, Upload, Image as ImageIcon,
  X, ArrowRight, FileText, Download,
  TrendingUp, BarChart3 as BarChartIcon,
  Zap, Shield, Wrench
} from 'lucide-react';
import { toast } from 'sonner';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { aiVisionApi } from '../../services/api';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';


type AnalysisMode = 'SAFETY' | 'QUALITY' | 'PROGRESS';
type TabType = 'live' | 'history' | 'insights' | 'settings';

interface Detection {
  id: string;
  timestamp: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'PASS';
  title: string;
  description: string;
  recommendation: string;
  coordinates?: { x: number, y: number, w: number, h: number };
  confidence: number;
}

interface AnalysisResult {
  detections: Detection[];
  summary: {
    total: number;
    critical: number;
    warnings: number;
    passed: number;
  };
  processedAt: string;
}

interface HistoryRecord {
  id: string;
  date: string;
  imageName: string;
  analysisType: 'SAFETY' | 'QUALITY' | 'PROGRESS';
  findingsCount: number;
  confidenceScore: number;
  report: string;
}

interface InsightCard {
  id: string;
  title: string;
  severity: 'Critical' | 'Warning' | 'Info';
  description: string;
}

interface SettingsState {
  autoAnalyzeOnUpload: boolean;
  safetyDetection: boolean;
  progressTracking: boolean;
  qualityControl: boolean;
  ppeComplianceDetection: boolean;
  modelSelector: 'Fast' | 'Accurate' | 'Detailed';
  confidenceThreshold: number;
  emailAlerts: boolean;
}

export const AIVision: React.FC = () => {
  // Camera and Analysis State
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<AnalysisMode>('SAFETY');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('live');

  // File Upload State
  const [staticImage, setStaticImage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Filter State
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO' | 'PASS'>('ALL');

  // History State
  const [historyRecords] = useState<HistoryRecord[]>([
    { id: '1', date: '2026-04-27 14:32', imageName: 'Site_North_Elevation.jpg', analysisType: 'SAFETY', findingsCount: 3, confidenceScore: 94, report: 'Missing handrails on scaffolding west side detected' },
    { id: '2', date: '2026-04-27 10:15', imageName: 'Concrete_Pour_Phase2.jpg', analysisType: 'QUALITY', findingsCount: 1, confidenceScore: 87, report: 'Surface finish acceptable, minor aggregate exposure in corner sections' },
    { id: '3', date: '2026-04-26 16:45', imageName: 'Steel_Frame_Check.jpg', analysisType: 'PROGRESS', findingsCount: 0, confidenceScore: 96, report: 'Column alignment within tolerance, welding completed on Level 3' },
    { id: '4', date: '2026-04-26 09:20', imageName: 'Formwork_Inspection.jpg', analysisType: 'SAFETY', findingsCount: 5, confidenceScore: 91, report: 'PPE compliance: 2 workers without hard hats, 1 without safety vest' },
    { id: '5', date: '2026-04-25 15:30', imageName: 'MEP_Rough_In.jpg', analysisType: 'QUALITY', findingsCount: 2, confidenceScore: 88, report: 'Pipe routing deviation detected; electrical conduit spacing non-compliant in section C' },
    { id: '6', date: '2026-04-25 11:00', imageName: 'Facade_Progress.jpg', analysisType: 'PROGRESS', findingsCount: 0, confidenceScore: 93, report: 'Cladding installation 45% complete, material quality verified' },
    { id: '7', date: '2026-04-24 14:15', imageName: 'Ground_Floor_Slab.jpg', analysisType: 'QUALITY', findingsCount: 4, confidenceScore: 89, report: 'Curing defects noted; hairline cracks in 3 bays, surface preparation inadequate' },
    { id: '8', date: '2026-04-24 10:30', imageName: 'Site_Wide_Safety.jpg', analysisType: 'SAFETY', findingsCount: 2, confidenceScore: 92, report: 'Spill kit located; access route obstructed near generator' },
    { id: '9', date: '2026-04-23 16:00', imageName: 'Roof_Membrane_Install.jpg', analysisType: 'PROGRESS', findingsCount: 1, confidenceScore: 90, report: 'Membrane coverage 78% complete; seaming work ongoing' },
    { id: '10', date: '2026-04-23 09:45', imageName: 'Internal_Wall_Frame.jpg', analysisType: 'QUALITY', findingsCount: 3, confidenceScore: 85, report: 'Plumb deviation on partition wall 12mm; structural studs aligned within spec' },
  ]);

  // Insights State
  const [insights] = useState<InsightCard[]>([
    { id: '1', title: 'Missing Handrail Protection', severity: 'Critical', description: 'West side scaffolding lacks proper fall protection. Immediate remediation required before work resumes.' },
    { id: '2', title: 'PPE Compliance Gap', severity: 'Critical', description: '2 workers detected without hard hats in north sector. Toolbox talk scheduled.' },
    { id: '3', title: 'Concrete Surface Defect', severity: 'Warning', description: 'Minor aggregate exposure in Floor 2 corner sections. Monitor for water ingress during weather.' },
    { id: '4', title: 'MEP Routing Deviation', severity: 'Warning', description: 'Electrical conduit spacing non-compliant in Section C. Coordination meeting required with MEP lead.' },
    { id: '5', title: 'Curing Progress Good', severity: 'Info', description: 'Slab curing on schedule. Formwork removal safe to proceed in 48 hours.' },
  ]);

  const [safetyTrendData] = useState([
    { week: 'W1', score: 88 },
    { week: 'W2', score: 85 },
    { week: 'W3', score: 87 },
    { week: 'W4', score: 89 },
    { week: 'W5', score: 91 },
    { week: 'W6', score: 93 },
    { week: 'W7', score: 92 },
    { week: 'W8', score: 94 },
  ]);

  const [findingsByCategory] = useState([
    { name: 'PPE Compliance', value: 12 },
    { name: 'Fall Protection', value: 8 },
    { name: 'Surface Quality', value: 9 },
    { name: 'Structural Alignment', value: 5 },
    { name: 'Routing Deviation', value: 4 },
  ]);

  // Settings State
  const [settings, setSettings] = useState<SettingsState>({
    autoAnalyzeOnUpload: true,
    safetyDetection: true,
    progressTracking: true,
    qualityControl: true,
    ppeComplianceDetection: true,
    modelSelector: 'Accurate',
    confidenceThreshold: 75,
    emailAlerts: true,
  });

  const [reportPanelOpen, setReportPanelOpen] = useState(false);
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<HistoryRecord | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modeRef = useRef<AnalysisMode>(mode);
  modeRef.current = mode;

  // File handling

  // Image Analysis
  const analyzeImage = useCallback(async (imageData: string) => {
    setIsProcessing(true);

    try {
      const result = await aiVisionApi.analyze(imageData, modeRef.current);
      setAnalysisResults(prev => [result, ...prev.slice(0, 19)]); // Keep last 20 results

    } catch (error) {
      console.error('Analysis failed:', error);
      toast.error('AI Analysis failed');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Camera Capture and Analysis
  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Capture frame
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);

    // Convert to base64
    const imageData = canvas.toDataURL('image/jpeg', 0.8);

    // Analyze image
    await analyzeImage(imageData);
  }, [analyzeImage]);

  // File handling
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setStaticImage(result);
        analyzeImage(result);
      };
      reader.readAsDataURL(file);
    }
  }, [analyzeImage, setStaticImage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setStaticImage(result);
        analyzeImage(result);
      };
      reader.readAsDataURL(file);
    }
  }, [analyzeImage, setStaticImage]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  // Camera Management functions (now defined after necessary callbacks)
  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 }, 
          facingMode: 'environment' 
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsActive(true);
        
        // Start periodic analysis
        intervalRef.current = window.setInterval(captureAndAnalyze, 5000);
      }
    } catch (error) {
      setCameraError('Camera access denied or unavailable');
      console.error('Camera error:', error);
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsActive(false);
  }, []);

  // Cleanup effect (needs stopCamera)
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Filter results
  const filteredResults = analysisResults.filter(result => {
    if (severityFilter === 'ALL') return true;
    return result.detections.some(d => d.severity === severityFilter);
  });

  const getSeverityColor = (severity: Detection['severity']) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-400 bg-red-900/20 border-red-800';
      case 'WARNING': return 'text-orange-400 bg-orange-900/20 border-orange-800';
      case 'INFO': return 'text-blue-400 bg-blue-900/20 border-blue-800';
      case 'PASS': return 'text-green-400 bg-green-900/20 border-green-800';
    }
  };

  const getSeverityIcon = (severity: Detection['severity']) => {
    switch (severity) {
      case 'CRITICAL': return <AlertOctagon className="h-4 w-4" />;
      case 'WARNING': return <AlertTriangle className="h-4 w-4" />;
      case 'INFO': return <Eye className="h-4 w-4" />;
      case 'PASS': return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  const handleDownloadReport = (record: HistoryRecord) => {
    const element = document.createElement('a');
    const file = new Blob([`Analysis Report - ${record.imageName}\n\n${record.report}`], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `report_${record.id}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('Report downloaded');
  };

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen">
      {/* Hidden file input for image upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        accept="image/*"
      />

      {/* Breadcrumbs */}
      <ModuleBreadcrumbs currentModule="ai-vision" />

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display text-white flex items-center gap-2">
              <ScanLine className="h-8 w-8 text-blue-500" />
              AI Vision Analytics
            </h1>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">DEMO</span>
          </div>
          <p className="text-gray-400 mt-1">Real-time construction site monitoring and analysis — demo mode with simulated detections</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Analysis Mode Selector */}
          <div className="flex bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            {(['SAFETY', 'QUALITY', 'PROGRESS'] as AnalysisMode[]).map((modeOption) => (
              <button
                key={modeOption}
                onClick={() => setMode(modeOption)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  mode === modeOption
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {modeOption}
              </button>
            ))}
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm">
            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
            {isActive ? 'Live' : 'Offline'}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-700 pb-2 overflow-x-auto">
        {(['live', 'history', 'insights', 'settings'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'text-blue-400 border-b-2 border-blue-400 -mb-2'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {tab === 'live' && 'Live Feed'}
            {tab === 'history' && 'History'}
            {tab === 'insights' && 'Insights'}
            {tab === 'settings' && 'Settings'}
          </button>
        ))}
      </div>

      {/* LIVE FEED TAB */}
      {activeTab === 'live' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main Vision Area */}
          <div className="xl:col-span-2 space-y-6">
            {/* Camera/Image Input */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Camera className="h-5 w-5 text-blue-400" />
                Vision Input
              </h2>
              {/* Camera View */}
              <div className="relative bg-black rounded-lg overflow-hidden mb-4">
                {isActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-80 object-cover"
                  />
                ) : staticImage ? (
                  <img
                    src={staticImage}
                    alt="Analysis target"
                    className="w-full h-80 object-cover"
                  />
                ) : (
                  <div
                    className={`w-full h-80 flex items-center justify-center border-2 border-dashed transition-colors ${
                      dragActive ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700'
                    }`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                  >
                    <div className="text-center">
                      <ImageIcon className="h-12 w-12 text-gray-500 mx-auto mb-2" />
                      <p className="text-gray-400 mb-2">Drop an image here or click to upload</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-blue-400 hover:text-blue-300 font-medium"
                      >
                        Choose File
                      </button>
                    </div>
                  </div>
                )}

                {/* Processing Overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center gap-3">
                      <div className="w-6 h-6 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                      <span className="text-white font-medium">Analyzing...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex justify-between items-center">
                <div className="flex gap-3">
                  {!isActive ? (
                    <button
                      onClick={startCamera}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Play className="h-4 w-4" />
                      Start Camera
                    </button>
                  ) : (
                    <button
                      onClick={stopCamera}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <Pause className="h-4 w-4" />
                      Stop Camera
                    </button>
                  )}

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-700 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Image
                  </button>
                </div>

                {staticImage && (
                  <button
                    onClick={() => setStaticImage(null)}
                    className="text-gray-400 hover:text-gray-300"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>

              {cameraError && (
                <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
                  {cameraError}
                </div>
              )}
            </div>

            {/* Recent Detections */}
            {analysisResults.length > 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-400" />
                    Latest Analysis
                  </h2>
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value as typeof severityFilter)}
                    className="text-sm border border-gray-600 rounded px-2 py-1 bg-gray-700 text-gray-300"
                  >
                    <option value="ALL">All Severity</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="WARNING">Warning</option>
                    <option value="INFO">Info</option>
                    <option value="PASS">Pass</option>
                  </select>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {filteredResults[0]?.detections.map((detection) => (
                    <div
                      key={detection.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${getSeverityColor(detection.severity)}`}
                      onClick={() => setSelectedDetection(detection)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {getSeverityIcon(detection.severity)}
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-200">{detection.title}</h3>
                            <p className="text-sm text-gray-400 mt-1">{detection.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span>{detection.timestamp}</span>
                              <span>Confidence: {Math.round(detection.confidence * 100)}%</span>
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Summary Stats */}
            {analysisResults.length > 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  <Activity className="h-5 w-5 text-blue-400" />
                  Analysis Summary
                </h3>
                {analysisResults[0] && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-3 bg-red-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-red-400">{analysisResults[0].summary.critical}</div>
                        <div className="text-xs text-red-400 font-medium">Critical</div>
                      </div>
                      <div className="text-center p-3 bg-orange-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-orange-400">{analysisResults[0].summary.warnings}</div>
                        <div className="text-xs text-orange-400 font-medium">Warnings</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="text-center p-3 bg-blue-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-blue-400">{analysisResults[0].summary.total - analysisResults[0].summary.critical - analysisResults[0].summary.warnings - analysisResults[0].summary.passed}</div>
                        <div className="text-xs text-blue-400 font-medium">Info</div>
                      </div>
                      <div className="text-center p-3 bg-green-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-green-400">{analysisResults[0].summary.passed}</div>
                        <div className="text-xs text-green-400 font-medium">Passed</div>
                      </div>
                    </div>
                    <div className="space-y-2 mt-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">Total Detections:</span>
                        <span className="font-medium text-gray-200">{analysisResults[0].summary.total}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">Processed At:</span>
                        <span className="font-medium text-gray-200">{new Date(analysisResults[0].processedAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Individual Detection Details */}
            {selectedDetection && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-400" />
                    Detection Details
                  </h3>
                  <button
                    onClick={() => setSelectedDetection(null)}
                    className="text-gray-400 hover:text-gray-300"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div className={`p-3 border rounded-lg ${getSeverityColor(selectedDetection.severity)}`}>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {getSeverityIcon(selectedDetection.severity)}
                      {selectedDetection.severity.toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-300 mb-1">Title:</p>
                    <p className="text-gray-100">{selectedDetection.title}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-300 mb-1">Description:</p>
                    <p className="text-gray-100">{selectedDetection.description}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-300 mb-1">Recommendation:</p>
                    <p className="text-gray-100">{selectedDetection.recommendation}</p>
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-400">
                    <span>Timestamp:</span>
                    <span className="text-gray-200">{selectedDetection.timestamp}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-400">
                    <span>Confidence:</span>
                    <span className="text-gray-200">{Math.round(selectedDetection.confidence * 100)}%</span>
                  </div>
                  {selectedDetection.coordinates && (
                    <div className="text-sm text-gray-400">
                      Coordinates: ({selectedDetection.coordinates.x.toFixed(2)}, {selectedDetection.coordinates.y.toFixed(2)}, {selectedDetection.coordinates.w.toFixed(2)}, {selectedDetection.coordinates.h.toFixed(2)})
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900 border-b border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Image Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Analysis Type</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Findings</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Confidence</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {historyRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 text-gray-300">{record.date}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-white">
                          <ImageIcon className="h-4 w-4 text-gray-500" />
                          {record.imageName}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          record.analysisType === 'SAFETY' ? 'bg-red-900/30 text-red-400' :
                          record.analysisType === 'QUALITY' ? 'bg-blue-900/30 text-blue-400' :
                          'bg-amber-900/30 text-amber-400'
                        }`}>
                          {record.analysisType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-gray-300">{record.findingsCount}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`font-medium ${record.confidenceScore >= 90 ? 'text-green-400' : record.confidenceScore >= 75 ? 'text-amber-400' : 'text-red-400'}`}>
                          {record.confidenceScore}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => { setSelectedHistoryRecord(record); setReportPanelOpen(true); }}
                            className="p-1 text-blue-400 hover:bg-blue-900/30 rounded transition-colors"
                            title="View Report"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadReport(record)}
                            className="p-1 text-green-400 hover:bg-green-900/30 rounded transition-colors"
                            title="Download Report"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* INSIGHTS TAB */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          {/* Insights Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {insights.map((insight) => (
              <div key={insight.id} className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <div className="flex items-start gap-3 mb-2">
                  <div className={`p-2 rounded-lg ${
                    insight.severity === 'Critical' ? 'bg-red-900/20' :
                    insight.severity === 'Warning' ? 'bg-amber-900/20' :
                    'bg-blue-900/20'
                  }`}>
                    <AlertTriangle className={`h-5 w-5 ${
                      insight.severity === 'Critical' ? 'text-red-400' :
                      insight.severity === 'Warning' ? 'text-amber-400' :
                      'text-blue-400'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{insight.title}</h3>
                    <p className={`text-sm font-medium ${
                      insight.severity === 'Critical' ? 'text-red-400' :
                      insight.severity === 'Warning' ? 'text-amber-400' :
                      'text-blue-400'
                    }`}>{insight.severity}</p>
                  </div>
                </div>
                <p className="text-gray-400 text-sm">{insight.description}</p>
              </div>
            ))}
          </div>

          {/* Findings by Category Chart */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BarChartIcon className="h-5 w-5 text-blue-400" />
              Findings by Category
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={findingsByCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }} />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Safety Score Trend */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
              Safety Score Trend (8 Weeks)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={safetyTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="week" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} domain={[80, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }} />
                <Legend />
                <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} name="Safety Score" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <div className="space-y-6 max-w-2xl">
          {/* Analysis Options */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              Analysis Options
            </h3>
            <div className="space-y-4">
              {[
                { key: 'autoAnalyzeOnUpload', label: 'Auto-analyze on upload' },
                { key: 'safetyDetection', label: 'Safety detection' },
                { key: 'progressTracking', label: 'Progress tracking' },
                { key: 'qualityControl', label: 'Quality control' },
                { key: 'ppeComplianceDetection', label: 'PPE compliance detection' },
              ].map((option) => (
                <div key={option.key} className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                  <label className="text-gray-300 font-medium cursor-pointer">{option.label}</label>
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, [option.key]: !prev[option.key as keyof SettingsState] }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings[option.key as keyof SettingsState] ? 'bg-blue-600' : 'bg-gray-600'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings[option.key as keyof SettingsState] ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Model Selection */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Wrench className="h-5 w-5 text-blue-400" />
              Model Configuration
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Analysis Model</label>
                <select
                  value={settings.modelSelector}
                  onChange={(e) => setSettings(prev => ({ ...prev, modelSelector: e.target.value as SettingsState['modelSelector'] }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="Fast">Fast (Real-time, lower accuracy)</option>
                  <option value="Accurate">Accurate (Balanced)</option>
                  <option value="Detailed">Detailed (Comprehensive, slower)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Confidence Threshold: {settings.confidenceThreshold}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.confidenceThreshold}
                  onChange={(e) => setSettings(prev => ({ ...prev, confidenceThreshold: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Only report findings above this confidence level</p>
              </div>
            </div>
          </div>

          {/* Alert Settings */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-purple-400" />
              Alert Settings
            </h3>
            <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <div>
                <label className="text-gray-300 font-medium block">Email Alerts on Critical Issues</label>
                <p className="text-xs text-gray-500 mt-1">Receive notifications for safety-critical findings</p>
              </div>
              <button
                onClick={() => setSettings(prev => ({ ...prev, emailAlerts: !prev.emailAlerts }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.emailAlerts ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.emailAlerts ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={() => toast.success('Settings saved')}
            className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save Settings
          </button>
        </div>
      )}

      {/* Report Panel Side Drawer */}
      {reportPanelOpen && selectedHistoryRecord && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm p-4 flex justify-end">
          <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-xl max-h-screen overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Analysis Report</h2>
              <button
                onClick={() => setReportPanelOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-400">Image</p>
                <p className="text-lg font-semibold text-white">{selectedHistoryRecord.imageName}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Analysis Type</p>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium mt-1 ${
                    selectedHistoryRecord.analysisType === 'SAFETY' ? 'bg-red-900/30 text-red-400' :
                    selectedHistoryRecord.analysisType === 'QUALITY' ? 'bg-blue-900/30 text-blue-400' :
                    'bg-amber-900/30 text-amber-400'
                  }`}>
                    {selectedHistoryRecord.analysisType}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Date</p>
                  <p className="text-base font-semibold text-white mt-1">{selectedHistoryRecord.date}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-900 rounded-lg border border-gray-700">
                  <p className="text-xs text-gray-400 font-medium mb-1">Findings Count</p>
                  <p className="text-2xl font-bold text-white">{selectedHistoryRecord.findingsCount}</p>
                </div>
                <div className="p-3 bg-gray-900 rounded-lg border border-gray-700">
                  <p className="text-xs text-gray-400 font-medium mb-1">Confidence Score</p>
                  <p className={`text-2xl font-bold ${selectedHistoryRecord.confidenceScore >= 90 ? 'text-green-400' : 'text-amber-400'}`}>
                    {selectedHistoryRecord.confidenceScore}%
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-300 mb-2">Full Report</p>
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <p className="text-gray-200 text-sm leading-relaxed">{selectedHistoryRecord.report}</p>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => handleDownloadReport(selectedHistoryRecord)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download Report
                </button>
                <button
                  onClick={() => setReportPanelOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIVision;