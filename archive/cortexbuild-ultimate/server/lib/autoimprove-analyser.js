/**
 * server/lib/autoimprove-analyser.js
 * Analyzes project metrics to detect trends and generate recommendations.
 * Uses LLM to reason about patterns in construction management data.
 */
const pool = require('../db');
const { getOllamaResponse } = require('../routes/ai-intents/ollama-client');

/**
 * Gather metrics for a tenant's projects.
 * @param {string} orgId
 * @param {string} companyId
 * @returns {Promise<object>} metrics object
 */
async function gatherMetrics(orgId, companyId) {
  const tid = orgId || companyId;
  if (!tid) return null;

  const tenantFilter = (col) => `COALESCE(${col}, company_id) = $1`;
  const params = [tid];

  // Budget variance: projects with budget vs actual spend
  const { rows: budgetRows } = await pool.query(`
    SELECT id, name, budget AS contract_sum, spent, start_date, end_date AS finish_date,
           CASE WHEN budget > 0 THEN ((spent - budget) / budget * 100) ELSE 0 END AS variance_pct
    FROM projects
    WHERE ${tenantFilter('organization_id')} AND status != 'completed'
    ORDER BY created_at DESC
  `, params);

  // Safety incidents in last 30 days
  const { rows: safetyRows } = await pool.query(`
    SELECT id, project_id, severity, description, date AS reported_at
    FROM safety_incidents
    WHERE ${tenantFilter('organization_id')}
      AND date > NOW() - INTERVAL '30 days'
    ORDER BY date DESC
  `, params);

  // Open defects
  const { rows: defectRows } = await pool.query(`
    SELECT id, project_id, title, priority, status, created_at
    FROM defects
    WHERE ${tenantFilter('organization_id')} AND status NOT IN ('closed', 'resolved')
    ORDER BY created_at DESC
    LIMIT 20
  `, params);

  // Change orders in last 30 days
  const { rows: changeOrderRows } = await pool.query(`
    SELECT id, project_id, title, value, status, created_at
    FROM change_orders
    WHERE ${tenantFilter('organization_id')}
      AND created_at > NOW() - INTERVAL '30 days'
    ORDER BY created_at DESC
    LIMIT 20
  `, params);

  // Daily reports trend (last 14 days) — worker count and progress notes
  const { rows: dailyReportRows } = await pool.query(`
    SELECT id, project_id, report_date, workers_on_site, notes, created_at
    FROM daily_reports
    WHERE ${tenantFilter('organization_id')}
      AND report_date > NOW() - INTERVAL '14 days'
    ORDER BY report_date DESC
  `, params);

  // Resource utilization (open purchase orders vs budget)
  const { rows: resourceRows } = await pool.query(`
    SELECT id, project_id, supplier_name, total_value, status, created_at
    FROM purchase_orders
    WHERE ${tenantFilter('organization_id')} AND status NOT IN ('cancelled', 'completed')
    ORDER BY created_at DESC
    LIMIT 20
  `, params);

  return {
    projects: budgetRows,
    safetyIncidents: safetyRows,
    defects: defectRows,
    changeOrders: changeOrderRows,
    dailyReports: dailyReportRows,
    purchaseOrders: resourceRows,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Detect trends and generate recommendations from metrics.
 * @param {string} orgId
 * @param {string} companyId
 * @param {object} schedule - autoimprove_schedule settings (thresholds)
 * @returns {Promise<{recommendations: Array, atRiskItems: Array}>}
 */
async function analyzeAndRecommend(orgId, companyId, schedule) {
  const metrics = await gatherMetrics(orgId, companyId);
  if (!metrics) {
    return { recommendations: [], atRiskItems: [] };
  }

  const {
    projects = [],
    safetyIncidents = [],
    defects = [],
    changeOrders = [],
    dailyReports = [],
    purchaseOrders = [],
  } = metrics;

  // Compute aggregate stats
  const totalProjects = projects.length;
  const overBudgetProjects = projects.filter(p => p.variance_pct > (schedule?.budget_threshold || 5));
  const highSeveritySafety = safetyIncidents.filter(s => s.severity === 'high' || s.severity === 'critical');
  const openDefects = defects.length;
  const pendingChangeOrders = changeOrders.filter(co => co.status === 'pending' || co.status === 'draft');
  const totalChangeOrderValue = changeOrders.reduce((s, co) => s + (parseFloat(co.value) || 0), 0);

  // Build summary for LLM
  const summaryText = `
CortexBuild Project Metrics Summary — Generated ${metrics.generatedAt}

## Projects (${totalProjects} active)
${projects.map(p => `  - ${p.name}: £${p.contract_sum?.toLocaleString() || 0} contract, £${p.spent?.toLocaleString() || 0} spent (${p.variance_pct > 0 ? '+' : ''}${p.variance_pct?.toFixed(1)}% variance)`).join('\n')}

## Safety Incidents (last 30 days: ${safetyIncidents.length})
${safetyIncidents.length === 0 ? '  None reported' : safetyIncidents.map(s => `  - [${s.severity}] ${s.description?.substring(0, 80)} (${s.reported_at})`).join('\n')}

## Open Defects (${openDefects})
${defects.slice(0, 5).map(d => `  - ${d.title} (${d.priority}, ${d.status})`).join('\n') || '  None'}

## Change Orders (last 30 days: ${changeOrders.length})
${changeOrders.length === 0 ? '  None' : changeOrders.map(co => `  - ${co.title}: £${co.value?.toLocaleString() || 0} (${co.status})`).join('\n')}

## Purchase Orders (open: ${purchaseOrders.length})
  Total value of open POs: £${purchaseOrders.reduce((s, p) => s + (parseFloat(p.total_value) || 0), 0).toLocaleString()}
`;

  // If we don't have enough data for meaningful analysis, return early
  if (totalProjects === 0 && safetyIncidents.length === 0 && openDefects === 0) {
    return {
      recommendations: [],
      atRiskItems: [],
    };
  }

  const analysisPrompt = `You are a construction project management analyst. Review the following CortexBuild metrics and identify:

1. **Recommendations** — Concrete, actionable recommendations (3-8). Each should include: what to do, why it matters, and the expected outcome. Focus on: budget overruns, safety trends, defect accumulation, and resource optimization.

2. **At-Risk Items** — Specific projects or items that need immediate attention. Flag anything with: >${schedule?.budget_threshold || 5}% budget variance, high/critical safety incidents, >${schedule?.defect_threshold || 10} open defects.

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "recommendations": [
    {
      "type": "budget_variance|schedule_slip|safety_trend|defect_rate|resource_optimization",
      "severity": "low|medium|high",
      "recommendation": "Specific action to take",
      "auto_actions": [{"action": "create_change_order", "params": {"project_id": "uuid"}}],
      "project_id": "uuid or null"
    }
  ],
  "atRiskItems": [
    {
      "project_id": "uuid",
      "project_name": "string",
      "risk_type": "string",
      "details": "string",
      "severity": "low|medium|high"
    }
  ]
}`;

  try {
    const raw = await getOllamaResponse(
      analysisPrompt + '\n\nMetrics data:\n' + summaryText,
      '',
      [],
      null
    );

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('No JSON found');
    }

    if (!Array.isArray(parsed.recommendations)) parsed.recommendations = [];
    if (!Array.isArray(parsed.atRiskItems)) parsed.atRiskItems = [];

    return {
      recommendations: parsed.recommendations.map(r => ({
        type: r.type || 'resource_optimization',
        severity: r.severity || 'medium',
        recommendation: String(r.recommendation || '').substring(0, 500),
        autoActions: r.auto_actions || [],
        projectId: r.project_id || null,
      })),
      atRiskItems: parsed.atRiskItems.map(a => ({
        projectId: a.project_id || null,
        projectName: a.project_name || '',
        riskType: a.risk_type || '',
        details: a.details || '',
        severity: a.severity || 'medium',
      })),
    };
  } catch (err) {
    console.error('[autoimprove-analyser] Analysis failed:', err.message);
    // Fallback: rule-based recommendations
    const recommendations = [];

    if (overBudgetProjects.length > 0) {
      recommendations.push({
        type: 'budget_variance',
        severity: 'high',
        recommendation: `${overBudgetProjects.length} project(s) exceed budget threshold. Review and raise change orders.`,
        autoActions: [],
        projectId: overBudgetProjects[0]?.id || null,
      });
    }
    if (highSeveritySafety.length > 0) {
      recommendations.push({
        type: 'safety_trend',
        severity: 'high',
        recommendation: `${highSeveritySafety.length} high/critical safety incident(s) in last 30 days. Review safety procedures.`,
        autoActions: [],
        projectId: highSeveritySafety[0]?.project_id || null,
      });
    }
    if (openDefects > (schedule?.defect_threshold || 10)) {
      recommendations.push({
        type: 'defect_rate',
        severity: 'medium',
        recommendation: `${openDefects} open defects. Prioritize closing low-priority defects to improve project handover.`,
        autoActions: [],
        projectId: null,
      });
    }
    return { recommendations, atRiskItems: [] };
  }
}

module.exports = { gatherMetrics, analyzeAndRecommend };
