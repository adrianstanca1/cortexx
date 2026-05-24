/**
 * POST /api/tenders/:id/ai-score
 * AI-powered tender scoring using Ollama.
 * Analyses tender attributes across 6 dimensions and returns scores + reasoning.
 *
 * Body (optional): full tender record { title, client, value, deadline, status,
 *                probability, type, location, notes }
 *                If not provided, fetches from DB using :id.
 */
const express = require('express');
const pool    = require('../db');
const https   = require('https');
const http    = require('http');
const auth    = require('../middleware/auth');

const router = express.Router();
router.use(auth);

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const LLM_MODEL   = process.env.LLM_MODEL || process.env.OLLAMA_MODEL || 'qwen3.5:latest';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null) return 'N/A';
  return '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(String(dateStr));
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 3600 * 24));
}

function callOllama(messages, options = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: LLM_MODEL,
      messages,
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 600,
        ...options,
      },
    });

    const url = new URL(OLLAMA_HOST + '/api/chat');
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 11434),
      path:     '/api/chat',
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout:  60000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const p = JSON.parse(data);
          if (p.error) return reject(new Error(p.error));
          resolve(p.message?.content || '');
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Ollama request timed out')); });
    req.write(body);
    req.end();
  });
}

// ─── Contract type analysis ───────────────────────────────────────────────────

/**
 * Analyse contract type implications for a construction tender.
 * Returns structured contract analysis with risk flags and recommendations.
 */
function analyseContractType(tender) {
  const type = (tender.type || '').toLowerCase();
  const notes = (tender.notes || '').toLowerCase();
  const value = tender.value !== null && tender.value !== undefined ? Number(tender.value) : 0;

  // Detect contract family
  const isNEC   = /\bnec[23]?\b/i.test(type + notes);
  const isJCT   = /\bjct\b/i.test(type + notes);
  const isFIDIC = /\bfidic\b/i.test(type + notes);
  const isMW    = /\bminor works\b/i.test(type);
  const isDandB = /\bdesign.b?u?i?l?d\b/i.test(type) || /\bdesign and build\b/i.test(type);
  const isTwoStage = /\btwo.stage\b/i.test(type);

  const contract = isNEC ? 'NEC3/NEC4' : isJCT ? 'JCT' : isFIDIC ? 'FIDIC' : isMW ? 'JCT Minor Works' : null;

  // Contract-specific risk factors
  const risks = [];

  if (isNEC) {
    risks.push({
      type: 'NEC specific',
      description: 'NEC contracts use core clauses and secondary option clauses. Ensure all compensation events are properly notified within the required timescales.',
      severity: 'medium',
    });
    risks.push({
      type: 'Early warning',
      description: 'NEC requires early warning notices for any event that may cause delay or cost. Failure to notify within 2 weeks of becoming aware may reduce entitlement.',
      severity: 'high',
    });
    if (!isTwoStage) {
      risks.push({
        type: 'Programme',
        description: 'Programme is a contractually binding document under NEC. Any delay to the accepted programme may trigger disallowed costs.',
        severity: 'medium',
      });
    }
  }

  if (isJCT) {
    risks.push({
      type: 'JCT specific',
      description: 'JCT contracts are more prescriptive than NEC. Variations require fair valuation; loss and expense claims must be notified promptly under the relevant clause.',
      severity: 'medium',
    });
    if (!isMW) {
      risks.push({
        type: 'Retention',
        description: 'Standard JCT retention is 5% (3% defect period). Ensure retention percentage and defect notification procedures are clearly agreed.',
        severity: 'low',
      });
    }
  }

  if (isFIDIC) {
    risks.push({
      type: 'FIDIC specific',
      description: 'FIDIC contracts are widely used internationally and for major infrastructure. Notice requirements are strictly enforced — failure to give within 28 days may forfeit rights.',
      severity: 'high',
    });
    risks.push({
      type: 'Dispute resolution',
      description: 'FIDIC uses DAB (Dispute Adjudication Board) as primary dispute mechanism. Factor in DAB costs and timelines.',
      severity: 'medium',
    });
  }

  if (isDandB) {
    risks.push({
      type: 'Design liability',
      description: 'Under Design & Build the contractor bears design responsibility. Ensure professional indemnity insurance is adequate and design team appointments are secured.',
      severity: 'high',
    });
  }

  if (isTwoStage) {
    risks.push({
      type: 'Two-stage tender',
      description: 'Two-stage tendering carries risk of scope ambiguity in stage 1. Ensure a clear protocol for scope changes between stages 1 and 2.',
      severity: 'medium',
    });
  }

  if (value > 10_000_000 && !contract) {
    risks.push({
      type: 'Contract documentation',
      description: 'Large-value project without a specified contract form increases legal risk. Negotiate a standard form (NEC/JCT) before accepting.',
      severity: 'high',
    });
  }

  // Overall contract risk score (0-100, lower = less risk)
  let contractRisk = 40; // baseline
  if (isNEC)  contractRisk += 5;
  if (isFIDIC) contractRisk += 10;
  if (isDandB) contractRisk += 15;
  if (isTwoStage) contractRisk += 10;
  if (value > 5_000_000) contractRisk += 5;
  if (contract) contractRisk -= 10; // known contract form reduces risk
  contractRisk = Math.min(95, Math.max(5, contractRisk));

  return {
    contractType: contract || 'Not specified',
    risks,
    contractRisk,
    recommendation: contract
      ? `${contract} contract detected. Review the specific secondary options/appendices for risk allocation. Ensure early warning and notice procedures are embedded in your delivery plan.`
      : 'No recognised contract type detected. Clarify contract form with client before submission. Avoid proceeding on an unagreed contract basis for projects over £500K.',
  };
}

// ─── PAS 91 scoring ───────────────────────────────────────────────────────────

/**
 * Score PAS 91 compliance indicators for a construction tender.
 * PAS 91:2013 is the pre-qualification questionnaire standard for construction.
 * Returns a score 0-100 and flags missing criteria.
 */
function scorePAS91(tender) {
  const notes = (tender.notes || '').toLowerCase();
  const type  = (tender.type  || '').toLowerCase();
  const value = tender.value !== null && tender.value !== undefined ? Number(tender.value) : 0;

  let score    = 60; // baseline
  const flags  = [];
  const extras = [];

  // ─ Health & Safety ─
  let hsScore = 50;
  if (/chs|construction.*health.*safety|constructionphase.*plan/i.test(notes)) { hsScore += 30; extras.push('Construction Phase Plan referenced'); }
  else { flags.push({ area: 'H&S', issue: 'No Construction Phase Plan or CHS evidence mentioned', severity: 'high' }); }

  if (/safe.*contractor|achilles|she\.qc/i.test(notes) || /iso.*45001|ohsas.*18001/i.test(notes)) { hsScore += 15; extras.push('Safety certification (ISO 45001/CHAS/SSIP)'); }
  if (/toolbox.*talk|rutb/i.test(notes)) { hsScore += 5; extras.push('Toolbox talk procedure'); }

  // ─ Environmental ─
  let envScore = 50;
  if (/iso.*14001|ems|environmental.*policy/i.test(notes)) { envScore += 25; extras.push('ISO 14001 / Environmental management system'); }
  if (/waste.*management|site.*waste.*plan|swmp/i.test(notes)) { envScore += 15; extras.push('Site Waste Management Plan'); }
  if (/carbon.*zero|net.*zero|sustainability.*policy/i.test(notes)) { envScore += 10; extras.push('Net zero / carbon commitment'); }

  // ─ Quality ─
  let qualScore = 50;
  if (/iso.*9001|quality.*management/i.test(notes)) { qualScore += 25; extras.push('ISO 9001 / Quality management system'); }
  if (/bsi.*kitemark|bre|building.*research|kitemark/i.test(notes)) { qualScore += 10; extras.push('BSI/BRE certification'); }
  if (/bim|building.*information.*modelling/i.test(notes)) { qualScore += 10; extras.push('BIM capability'); }
  if (/supply.*chain|procurement/i.test(notes)) { qualScore += 5; extras.push('Supply chain management policy'); }

  // ─ Financial stability ─
  let finScore = 50;
  if (/cic.*assessment|turnover|audited.*accounts/i.test(notes)) { finScore += 20; extras.push('CIC or audited financial assessment'); }
  if (/public.*liability|pi.*insurance|professional.*indemnity/i.test(notes)) { finScore += 15; extras.push('Insurance cover confirmed'); }
  if (value > 1_000_000) {
    if (!/public.*liability|pl.*insurance/i.test(notes)) { flags.push({ area: 'Financial', issue: `Project >£1M — PL/EL insurance level not stated`, severity: 'medium' }); }
    if (!/pi.*insurance|professional.*indemnity/i.test(notes) && /design.*build|d&b/i.test(type)) { flags.push({ area: 'Financial', issue: 'Design & Build project — PI insurance not confirmed', severity: 'high' }); }
  }

  // ─ Social value / CSR ─
  let socialScore = 40;
  if (/social.*value|community.*benefit|local.*supply/i.test(notes)) { socialScore += 25; extras.push('Social value / community benefit commitments'); }
  if (/apprentice|training.*programme|skills.*plan/i.test(notes)) { socialScore += 15; extras.push('Apprenticeship / skills plan'); }
  if (/equality.*act|diversity|inclusive/i.test(notes)) { socialScore += 10; extras.push('Equality and diversity policy'); }

  // Clamp individual scores
  hsScore   = Math.min(100, Math.max(0, hsScore));
  envScore  = Math.min(100, Math.max(0, envScore));
  qualScore = Math.min(100, Math.max(0, qualScore));
  finScore  = Math.min(100, Math.max(0, finScore));
  socialScore = Math.min(100, Math.max(0, socialScore));

  // Weighted overall PAS 91 score
  const pas91Overall = Math.round(
    hsScore   * 0.25 +
    envScore  * 0.15 +
    qualScore * 0.25 +
    finScore  * 0.20 +
    socialScore * 0.15
  );

  // Confidence: how much evidence is there?
  const evidenceCount = extras.length;
  const confidence = Math.min(95, Math.max(30, 40 + evidenceCount * 8));

  return {
    overall:        pas91Overall,
    healthSafety:   hsScore,
    environmental:  envScore,
    quality:        qualScore,
    financial:      finScore,
    socialValue:    socialScore,
    confidence,
    flags:          flags.filter(f => f.severity === 'high'),
    warnings:       flags.filter(f => f.severity === 'medium'),
    extras,
    recommendation: flags.length > 0
      ? `PAS 91 compliance gaps detected: ${flags.map(f => f.area + ' (' + f.severity + ')').join(', ')}. Address flagged items before submission.`
      : `Good PAS 91 indicators. ${extras.length} positive criteria confirmed.`,
  };
}

// ─── Rule-based seed scores ───────────────────────────────────────────────────

/**
 * Generate rule-based seed scores for each dimension before AI refinement.
 */
function ruleBasedScores(tender) {
  const now       = Date.now();
  const deadline  = tender.deadline ? new Date(String(tender.deadline)).getTime() : null;
  const daysLeft  = deadline ? Math.ceil((deadline - now) / (1000 * 3600 * 24)) : null;
  const value     = tender.value !== null && tender.value !== undefined ? Number(tender.value) : 0;
  const prob      = tender.probability !== null && tender.probability !== undefined ? Number(tender.probability) : 50;

  // Client relationship (0-100): probability is a strong proxy
  let clientRel = Math.min(95, Math.max(15, prob + (daysLeft && daysLeft > 30 ? 10 : 0)));

  // Technical fit (0-100): infer from tender type + value
  let techFit = 60;
  if (/\bdesign\s*&\s*build\b|design\s*and\s*build\b/i.test(tender.type)) techFit += 15;
  if (/\btwo\s*stage\b/i.test(tender.type)) techFit += 10;
  if (/\bminor\s*works\b/i.test(tender.type)) techFit -= 10;
  if (value > 5_000_000) techFit += 10;   // large projects need strong fit
  if (value < 100_000)   techFit -= 10;   // small works = lower complexity bar
  techFit = Math.min(95, Math.max(10, techFit));

  // Price competitiveness (0-100): invert risk from value scale
  let priceComp = 65;
  if (value > 10_000_000) priceComp -= 15;  // big projects = tight margins risk
  else if (value > 1_000_000) priceComp += 5;
  else if (value < 250_000)    priceComp += 10; // small works often more competitive
  if (prob < 30)  priceComp -= 15;  // low probability may mean price is too high
  if (prob > 70)  priceComp += 10;
  priceComp = Math.min(95, Math.max(10, priceComp));

  // Programme risk (0-100, lower = less risk): deadline proximity is key
  let progRisk = 50;
  if (daysLeft !== null) {
    if (daysLeft < 0)       progRisk += 30;  // already past deadline
    else if (daysLeft < 7)  progRisk += 20;
    else if (daysLeft < 14) progRisk += 10;
    else if (daysLeft > 60) progRisk -= 15;  // comfortable time
  }
  if (tender.status === 'submitted') progRisk -= 10; // further along = less risk
  progRisk = Math.min(95, Math.max(5, progRisk));

  // Resource availability (0-100): status-based heuristic
  let resources = 60;
  if (tender.status === 'drafting')    resources += 10;
  if (tender.status === 'submitted')   resources += 5;
  if (tender.status === 'shortlisted') resources += 15;
  if (tender.status === 'won')          resources += 20;
  if (value > 5_000_000)              resources -= 15; // big projects strain resources
  resources = Math.min(95, Math.max(10, resources));

  return { clientRel, techFit, priceComp, progRisk, resources };
}

// ─── Main scoring handler ─────────────────────────────────────────────────────

router.post('/:id/ai-score', async (req, res) => {
  const { id } = req.params;
  const orgId  = req.user?.organization_id;
  const isSuper = req.user?.role === 'super_admin';

  try {
    // ── 1. Resolve tender record ────────────────────────────────────────────
    let tender = req.body;
    if (!tender || Object.keys(tender).length === 0) {
      let whereClause = 'WHERE id = $1';
      let params = [id];
      if (!isSuper && (orgId || req.user.company_id)) {
        whereClause += ' AND COALESCE(organization_id, company_id) = $2';
        params.push(orgId || req.user.company_id);
      }
      const { rows } = await pool.query(
        `SELECT title, client, value, deadline, status, probability, type, location, notes
         FROM tenders ${whereClause} LIMIT 1`,
        params
      );
      if (!rows.length) return res.status(404).json({ error: 'Tender not found' });
      tender = rows[0];
    }

    // ── 2. Build rule-based seeds ────────────────────────────────────────────
    const seeds     = ruleBasedScores(tender);
    const daysLeft  = daysUntil(tender.deadline);
    const contractAnalysis = analyseContractType(tender);
    const pas91                = scorePAS91(tender);

    // ── 3. Prompt Ollama for AI refinement + reasoning ──────────────────────
    const prompt = `You are a senior construction bid manager evaluating a tender opportunity.
Analyse the following tender and score it across 8 dimensions. Be rigorous and specific in your reasoning.

TENDER DETAILS:
- Title: ${tender.title || 'N/A'}
- Client: ${tender.client || 'N/A'}
- Value: ${fmt(tender.value)}
- Deadline: ${tender.deadline ? new Date(String(tender.deadline)).toLocaleDateString('en-GB') : 'Not specified'} (${daysLeft !== null ? (daysLeft >= 0 ? daysLeft + ' days remaining' : daysLeft + ' days overdue') : 'No deadline set'})
- Status: ${tender.status || 'drafting'}
- Win Probability: ${tender.probability ?? 'not specified'}%
- Type: ${tender.type || 'Not specified'}
- Location: ${tender.location || 'Not specified'}
- Notes: ${tender.notes || 'None'}

CONTRACT ANALYSIS (rule-based):
- Detected contract: ${contractAnalysis.contractType}
- Contract risk score: ${contractAnalysis.contractRisk}/100 (lower = less risk)
- Key risks: ${contractAnalysis.risks.length > 0 ? contractAnalysis.risks.map(r => r.type + ' (' + r.severity + ')').join(', ') : 'None detected'}

PAS 91 COMPLIANCE INDICATORS:
- PAS 91 overall: ${pas91.overall}/100
- H&S: ${pas91.healthSafety}/100 | Environmental: ${pas91.environmental}/100 | Quality: ${pas91.quality}/100
- Financial: ${pas91.financial}/100 | Social Value: ${pas91.socialValue}/100
- Confidence in PAS 91 assessment: ${pas91.confidence}%
- Gaps flagged: ${pas91.flags.length > 0 ? pas91.flags.map(f => f.issue).join('; ') : 'None'}

SEED SCORES (before AI refinement):
- Client Relationship: ${seeds.clientRel}/100
- Technical Fit: ${seeds.techFit}/100
- Price Competitiveness: ${seeds.priceComp}/100
- Programme Risk: ${seeds.progRisk}/100 (lower = less risk)
- Resource Availability: ${seeds.resources}/100

YOUR TASK:
Return a JSON object (no markdown, no code fences) with the following exact structure:
{
  "overall": 0-100,
  "clientRel": 0-100,
  "techFit": 0-100,
  "priceComp": 0-100,
  "progRisk": 0-100,
  "resources": 0-100,
  "contractRisk": 0-100,
  "pas91Score": 0-100,
  "confidence": 0-100,
  "reasoning": "2-4 sentence explanation of the overall score and key scoring factors"
}

Scoring criteria:
- overall: Weighted composite (clientRel 25%, techFit 20%, priceComp 20%, progRisk 15%, resources 10%, contractRisk -5% adjustment, pas91Score 15%). Normalise to 0-100.
- clientRel: Client relationship strength. High win probability + known client + comfortable deadline = high score.
- techFit: How well our capabilities match the project requirements. Design & Build, complex/large projects = higher fit bar needed.
- priceComp: Value for money perception. Competitive tender value, good margin potential = high.
- progRisk: Programme/delivery risk (inverted: low score = low risk). Short deadline, past deadline, complex scope = high risk.
- resources: Do we have capacity and capability? Shortlisted = we can resource it. Large project = capacity concern.
- contractRisk: Inherited risk from contract type. NEC early warning, FIDIC 28-day notices, D&B design liability = higher risk.
- pas91Score: PAS 91 compliance level based on H&S, environmental, quality, financial and social value criteria present in the tender documents.
- confidence: How certain are you about this scoring? Based on data quality (notes, probability, value known = high confidence; sparse data = lower).

Be honest. Do not inflate scores.`;

    let rawResponse = '';
    try {
      rawResponse = await callOllama([
        { role: 'user', content: prompt }
      ]);
    } catch (ollamaErr) {
      console.warn('[tender-ai] Ollama unavailable, using rule-based fallback:', ollamaErr.message);
      // Compute a confidence score for rule-based mode (lower)
      const confidence = Math.min(70, Math.max(35,
        35 + (tender.probability ? 10 : 0) + (tender.value ? 10 : 0) + (tender.deadline ? 10 : 0) + (tender.notes ? 5 : 0)
      ));
      const overall = Math.round(
        seeds.clientRel  * 0.25 +
        seeds.techFit    * 0.20 +
        seeds.priceComp  * 0.20 +
        (100 - seeds.progRisk) * 0.15 +
        seeds.resources  * 0.10 +
        pas91.overall    * 0.10
      );
      return res.json({
        overall:        Math.min(95, Math.max(5, overall)),
        clientRel:      seeds.clientRel,
        techFit:        seeds.techFit,
        priceComp:      seeds.priceComp,
        progRisk:       seeds.progRisk,
        resources:      seeds.resources,
        contractRisk:   contractAnalysis.contractRisk,
        pas91Score:     pas91.overall,
        confidence,
        reasoning:      `Rule-based scoring (Ollama unavailable). Contract: ${contractAnalysis.contractType}. PAS 91: ${pas91.overall}/100 (confidence: ${confidence}%). ${contractAnalysis.risks.length > 0 ? 'Key contract risk: ' + contractAnalysis.risks[0].type + '.' : ''}`,
        contractAnalysis,
        pas91,
        source:         'rule-based',
      });
    }

    // ── 4. Parse JSON response ───────────────────────────────────────────────
    let scores;
    try {
      // Strip any markdown fences or trailing text
      const jsonStr = rawResponse
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      // Find first { and last }
      const start = jsonStr.indexOf('{');
      const end   = jsonStr.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('No JSON object found');
      scores = JSON.parse(jsonStr.slice(start, end + 1));
    } catch (parseErr) {
      console.warn('[tender-ai] Failed to parse Ollama response, using seeds:', parseErr.message);
      const overall = Math.round(
        seeds.clientRel  * 0.25 +
        seeds.techFit    * 0.20 +
        seeds.priceComp  * 0.20 +
        (100 - seeds.progRisk) * 0.15 +
        seeds.resources  * 0.10 +
        pas91.overall    * 0.10
      );
      return res.json({
        overall:        Math.min(95, Math.max(5, overall)),
        clientRel:      seeds.clientRel,
        techFit:        seeds.techFit,
        priceComp:      seeds.priceComp,
        progRisk:       seeds.progRisk,
        resources:      seeds.resources,
        contractRisk:   contractAnalysis.contractRisk,
        pas91Score:     pas91.overall,
        confidence:     50,
        reasoning:       rawResponse.substring(0, 300) || 'Scoring completed with fallback.',
        contractAnalysis,
        pas91,
        source:         'rule-based',
      });
    }

    // ── 5. Validate and clamp scores ────────────────────────────────────────
    const clamp = (v, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(Number(v) || 50)));

    const overall      = clamp(scores.overall, 5, 95);
    const clientRel    = clamp(scores.clientRel);
    const techFit      = clamp(scores.techFit);
    const priceComp    = clamp(scores.priceComp);
    const progRisk     = clamp(scores.progRisk, 5, 95);
    const resources    = clamp(scores.resources);
    const contractRisk = clamp(scores.contractRisk ?? contractAnalysis.contractRisk, 5, 95);
    const pas91Score   = clamp(scores.pas91Score ?? pas91.overall);
    const confidence   = clamp(scores.confidence ?? 75, 20, 99);
    const reasoning    = String(scores.reasoning || '').substring(0, 500);

    // ── 6. Optionally persist the overall score to DB ─────────────────────────
    try {
      let updateQuery = 'UPDATE tenders SET ai_score = $1 WHERE id = $2';
      let updateParams = [overall, id];
      if (isCompanyOwner) {
        updateQuery += ' AND company_id = $3';
        updateParams.push(req.user.company_id);
      } else if (!isSuper && (orgId || req.user.company_id)) {
        updateQuery += ' AND COALESCE(organization_id, company_id) = $3';
        updateParams.push(orgId || req.user.company_id);
      }
      await pool.query(updateQuery, updateParams);
    } catch (dbErr) {
      console.warn('[tender-ai] Could not persist ai_score:', dbErr.message);
    }

    res.json({
      overall,
      clientRel,
      techFit,
      priceComp,
      progRisk,
      resources,
      contractRisk,
      pas91Score,
      confidence,
      reasoning,
      contractAnalysis,
      pas91,
      source: 'ollama',
    });
  } catch (err) {
    console.error('[tender-ai] Scoring error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /ai-score/batch ─────────────────────────────────────────────────────
// Score multiple tenders at once
router.post('/batch/ai-score', async (req, res) => {
  const { tenderIds } = req.body;
  if (!Array.isArray(tenderIds) || !tenderIds.length) {
    return res.status(400).json({ error: 'tenderIds array required' });
  }
  if (tenderIds.length > 20) {
    return res.status(400).json({ error: 'Maximum 20 tenders per batch' });
  }

  const orgId  = req.user?.organization_id;
  const isSuper = req.user?.role === 'super_admin';
  const results = [];

  for (const id of tenderIds) {
    try {
      let batchWhere = 'WHERE id = $1';
      let batchParams = [id];
      if (!isSuper && (orgId || req.user.company_id)) {
        batchWhere += ' AND COALESCE(organization_id, company_id) = $2';
        batchParams.push(orgId || req.user.company_id);
      }
      const { rows } = await pool.query(
        `SELECT title, client, value, deadline, status, probability, type, location, notes
         FROM tenders ${batchWhere} LIMIT 1`,
        batchParams
      );
      if (!rows.length) { results.push({ id, error: 'Not found' }); continue; }

      const tender = rows[0];
      const seeds  = ruleBasedScores(tender);

      // Run Ollama (single scoring, fast enough in loop for small batches)
      const daysLeft = daysUntil(tender.deadline);
      const prompt   = `Score this tender: title="${tender.title}", client="${tender.client}", value=${fmt(tender.value)}, deadline="${tender.deadline}", status="${tender.status}", probability="${tender.probability}", type="${tender.type}", location="${tender.location}". Return JSON only: {"overall":0-100,"clientRel":0-100,"techFit":0-100,"priceComp":0-100,"progRisk":0-100,"resources":0-100,"reasoning":"text"}.`;

      let overall;
      try {
        const raw = await callOllama([{ role: 'user', content: prompt }]);
        const start = raw.indexOf('{');
        const end   = raw.lastIndexOf('}');
        const parsed = JSON.parse(raw.slice(start, end + 1));
        overall = Math.min(95, Math.max(5, Math.round(Number(parsed.overall) || 50)));
      } catch {
        overall = Math.round(
          seeds.clientRel  * 0.30 +
          seeds.techFit    * 0.25 +
          seeds.priceComp  * 0.25 +
          (100 - seeds.progRisk) * 0.10 +
          seeds.resources  * 0.10
        );
      }

      const tenantFilter = !isSuper && (orgId || req.user.company_id)
        ? `AND COALESCE(organization_id, company_id) = $3`
        : '';
      const tenantParams = !isSuper && (orgId || req.user.company_id)
        ? [overall, id, orgId || req.user.company_id]
        : [overall, id];
      await pool.query(
        `UPDATE tenders SET ai_score = $1 WHERE id = $2 ${tenantFilter}`,
        tenantParams
      );

      results.push({ id, overall });
    } catch (e) {
      results.push({ id, error: e.message });
    }
  }

  res.json({ results });
});

module.exports = router;
