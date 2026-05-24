const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

router.use(authMiddleware);

// Rate limit: 10 analysis requests per minute (vision inference is GPU-intensive)
const visionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: 'Too many vision analysis requests. Please wait a moment.' },
});

/**
 * POST /api/ai-vision/analyze
 * Analyze an image for safety/quality/progress issues using Ollama vision model.
 * Body: { imageData: string (base64 data URL), mode: 'SAFETY'|'QUALITY'|'PROGRESS' }
 */
router.post('/analyze', visionLimiter, async (req, res) => {
  try {
    const { imageData, mode, projectId } = req.body;

    if (!imageData) {
      return res.status(400).json({ message: 'imageData is required' });
    }

    const orgId = req.user?.organization_id;
    const companyId = req.user?.company_id;
    const userId = req.user?.id;

    const analysisMode = (mode || 'SAFETY').toUpperCase();
    const modePrompts = {
      SAFETY: 'Analyze this construction site image for safety hazards. Identify any PPE violations, fall risks, scaffold issues, hazardous materials, or other safety concerns. For each finding, provide: title, description, severity (CRITICAL/WARNING/INFO/PASS), recommendation, and confidence (0-1).',
      QUALITY: 'Analyze this construction site image for quality issues. Identify any workmanship defects, material issues, structural concerns, or code violations. For each finding, provide: title, description, severity (CRITICAL/WARNING/INFO/PASS), recommendation, and confidence (0-1).',
      PROGRESS: 'Analyze this construction site image to assess construction progress. Identify completed work, ongoing activities, and any delays visible. For each finding, provide: title, description, severity (CRITICAL/WARNING/INFO/PASS), recommendation, and confidence (0-1).',
    };

    const systemPrompt = modePrompts[analysisMode] || modePrompts.SAFETY;

    // Strip data URL prefix to get raw base64
    const base64Match = imageData.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
    if (!base64Match) {
      return res.status(400).json({ message: 'Invalid imageData format. Expected data URL with base64 encoding.' });
    }

    const mediaType = base64Match[1] === 'jpg' ? 'jpeg' : base64Match[1];
    const base64Data = base64Match[2];

    // Call Ollama with vision-capable model
    const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
    const ollamaResponse = await fetch(`${ollamaHost}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.VISION_MODEL || 'llava:latest',
        messages: [
          {
            role: 'user',
            content: systemPrompt,
            images: [base64Data],
          },
        ],
        stream: false,
      }),
    });

    if (!ollamaResponse.ok) {
      console.error('[AI Vision] Ollama error:', ollamaResponse.status, await ollamaResponse.text().catch(() => ''));
      return res.status(502).json({ message: 'AI service unavailable' });
    }

    const ollamaData = await ollamaResponse.json();
    const aiReply = ollamaData.message?.content || '';

    // Parse AI response into structured detections
    const detections = parseDetections(aiReply);
    const summary = {
      total: detections.length,
      critical: detections.filter(d => d.severity === 'CRITICAL').length,
      warnings: detections.filter(d => d.severity === 'WARNING').length,
      passed: detections.filter(d => d.severity === 'PASS' || d.severity === 'INFO').length,
    };

    const result = {
      detections,
      summary,
      processedAt: new Date().toISOString(),
    };

    // Log the analysis (use COALESCE for company_owner users with null organization_id)
    const tenantOrgId = orgId || companyId || null;
    await pool.query(
      `INSERT INTO ai_vision_logs (organization_id, company_id, project_id, image_url, analysis_result, confidence_score, processed_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        orgId || null,
        companyId || null,
        projectId || null,
        `vision-analysis-${Date.now()}`,
        JSON.stringify(result),
        summary.total > 0 ? detections.reduce((sum, d) => sum + d.confidence, 0) / summary.total : 0,
      ]
    );

    res.json(result);
  } catch (err) {
    console.error('[POST /ai-vision/analyze]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * Parse the AI text response into structured detections.
 * Handles both structured JSON-like responses and freeform text.
 */
function parseDetections(text) {
  const detections = [];

  // Try to extract JSON array from the response
  const jsonMatch = text.match(/\[[\s\S]*?\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          detections.push({
            id: item.id || `det-${detections.length + 1}`,
            timestamp: new Date().toISOString(),
            severity: normalizeSeverity(item.severity),
            title: String(item.title || 'Finding'),
            description: String(item.description || ''),
            recommendation: String(item.recommendation || item.suggestion || ''),
            confidence: item.confidence !== null && item.confidence !== undefined ? Number(item.confidence) : 0.7,
          });
        }
        return detections;
      }
    } catch {
      // Not valid JSON, fall through to text parsing
    }
  }

  // Parse freeform text: look for bullet points or numbered items
  const lines = text.split('\n').filter(l => l.trim());
  let currentDetection = null;

  for (const line of lines) {
    const bulletMatch = line.match(/^[•\-\*\d]+\s*(.+)/);
    const titleMatch = line.match(/(?:title|finding|issue|concern)[:\s]+(.+)/i);
    const severityMatch = line.match(/(?:severity|level|risk)[:\s]*(CRITICAL|WARNING|INFO|PASS|HIGH|MEDIUM|LOW)/i);
    const descMatch = line.match(/(?:description|detail|note)[:\s]+(.+)/i);

    if (titleMatch) {
      if (currentDetection) detections.push(currentDetection);
      currentDetection = {
        id: `det-${detections.length + 1}`,
        timestamp: new Date().toISOString(),
        severity: 'WARNING',
        title: titleMatch[1].trim(),
        description: '',
        recommendation: '',
        confidence: 0.7,
      };
    } else if (severityMatch && currentDetection) {
      currentDetection.severity = normalizeSeverity(severityMatch[1]);
    } else if (descMatch && currentDetection) {
      currentDetection.description = descMatch[1].trim();
    } else if (bulletMatch) {
      if (currentDetection) detections.push(currentDetection);
      currentDetection = {
        id: `det-${detections.length + 1}`,
        timestamp: new Date().toISOString(),
        severity: 'INFO',
        title: bulletMatch[1].trim(),
        description: '',
        recommendation: '',
        confidence: 0.6,
      };
    }
  }

  if (currentDetection) detections.push(currentDetection);

  // If no detections parsed, create a single summary detection
  if (detections.length === 0) {
    detections.push({
      id: 'det-1',
      timestamp: new Date().toISOString(),
      severity: 'INFO',
      title: 'Analysis Complete',
      description: text.substring(0, 500),
      recommendation: 'Review the full analysis text for details.',
      confidence: 0.5,
    });
  }

  return detections;
}

function normalizeSeverity(raw) {
  if (!raw) return 'INFO';
  const s = String(raw).toUpperCase();
  if (s === 'CRITICAL' || s === 'HIGH') return 'CRITICAL';
  if (s === 'WARNING' || s === 'MEDIUM') return 'WARNING';
  if (s === 'PASS' || s === 'LOW') return 'PASS';
  return 'INFO';
}

module.exports = router;