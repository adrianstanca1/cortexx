const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { broadcastNotification } = require('../lib/ws-broadcast');
const { buildTenantFilter, isSuperAdmin } = require('../middleware/tenantFilter');

const router = express.Router();
router.use(authMiddleware);

/**
 * GET /api/insights
 * Returns rule-based + trend insights derived from real project data.
 * Multi-tenant: filters by organization_id/company_id from req.user.
 */
router.get('/', async (req, res) => {
  try {
    const { clause: orgFilter, params } = buildTenantFilter(req, 'WHERE');

    const insights = [];

    await Promise.all([
      generateFinancialInsights(orgFilter, params, insights),
      generateContractVsBudgetInsights(orgFilter, params, insights),
      generateInvoiceAgingInsights(orgFilter, params, insights),
      generateSubcontractorInsights(orgFilter, params, insights),
      generateSafetyInsights(orgFilter, params, insights),
      generateProgrammeInsights(orgFilter, params, insights),
      generateResourceInsights(orgFilter, params, insights),
      generateTrendInsights(orgFilter, params, insights),
    ]);

    // ── Broadcast real-time notifications for high/critical insights ─────────
    const notifiable = insights.filter(i => i.severity === 'critical' || i.severity === 'high');
    for (const insight of notifiable) {
      broadcastNotification(
        `[${insight.severity.toUpperCase()}] ${insight.title}`,
        insight.description,
        insight.severity === 'critical' ? 'critical' : 'warning',
        {
          insightId: insight.id,
          category: insight.category,
          link: `/insights?category=${insight.category}`,
          recommendation: insight.recommendation,
        }
      );
    }

    res.json(insights);
  } catch (err) {
    console.error('insights error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Financial: overdue invoices ──────────────────────────────────────────────

async function generateFinancialInsights(orgFilter, params, insights) {
  const whereClause = orgFilter ? `${orgFilter} AND` : 'WHERE 1=1 AND';
  const p = params;

  const overdueResult = await pool.query(`
    SELECT
      COUNT(*) AS overdue_count,
      COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE AND status NOT IN ('paid', 'disputed')
        THEN amount ELSE 0 END), 0) AS overdue_amount,
      COALESCE(SUM(CASE WHEN status NOT IN ('paid', 'disputed') THEN amount ELSE 0 END), 0) AS total_outstanding,
      COUNT(CASE WHEN due_date < CURRENT_DATE AND status NOT IN ('paid', 'disputed') THEN 1 END) AS overdue_invoice_count
    FROM invoices
    ${whereClause} status NOT IN ('paid', 'disputed')
  `, p);

  const row = overdueResult.rows[0];
  const overdueInvoiceCount = parseInt(row?.overdue_invoice_count ?? 0, 10);
  const overdueAmount = parseFloat(row?.overdue_amount ?? 0);
  const totalOutstanding = parseFloat(row?.total_outstanding ?? 0);

  if (overdueInvoiceCount > 0) {
    const overdueRatio = totalOutstanding > 0 ? overdueAmount / totalOutstanding : 0;
    let severity = 'medium';
    if (overdueRatio > 0.5 || overdueAmount > 50000) severity = 'high';
    else if (overdueRatio < 0.2 && overdueAmount < 5000) severity = 'low';

    insights.push({
      id: 'fin-001',
      category: 'financial',
      severity,
      title: 'Invoice Payment Delays Detected',
      description: `${overdueInvoiceCount} invoice(s) overdue totalling £${overdueAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}.`,
      recommendation: 'Prioritise follow-up with clients representing the largest overdue amounts. Consider automated payment reminders at 7, 14, and 30 days past due.',
      impact: `Working capital constraint of £${overdueAmount.toLocaleString('en-GB', { minimumFractionDigits: 0 })} affecting supplier payments and material procurement.`,
      confidence: Math.min(95, 60 + overdueInvoiceCount * 3),
      dataPoints: overdueInvoiceCount,
      generatedAt: new Date().toISOString(),
    });
  }

  // Payment trend: paid invoices last 30d vs prior 30d
  const trendResult = await pool.query(`
    SELECT
      COALESCE(SUM(CASE WHEN due_date >= CURRENT_DATE - INTERVAL '60 days' AND due_date < CURRENT_DATE - INTERVAL '30 days'
        AND status = 'paid' THEN 1 ELSE 0 END), 0) AS paid_previous,
      COALESCE(SUM(CASE WHEN due_date >= CURRENT_DATE - INTERVAL '30 days'
        AND status = 'paid' THEN 1 ELSE 0 END), 0) AS paid_recent
    FROM invoices
    ${whereClause} due_date >= CURRENT_DATE - INTERVAL '60 days'
  `, p);

  const trend = trendResult.rows[0];
  const paidPrevious = parseInt(trend?.paid_previous ?? 0, 10);
  const paidRecent = parseInt(trend?.paid_recent ?? 0, 10);

  if (paidPrevious > 0 && paidRecent < paidPrevious * 0.8) {
    insights.push({
      id: 'fin-002',
      category: 'financial',
      severity: 'medium',
      title: 'Payment Collection Rate Declining',
      description: `Paid invoices in the last 30 days (${paidRecent}) are notably lower than the prior 30-day period (${paidPrevious}).`,
      recommendation: 'Review aged debtor report. Escalate discussions with clients on outstanding retentions.',
      impact: 'Reduced cash flow may delay material orders and subcontractor payments.',
      confidence: 72,
      dataPoints: paidPrevious + paidRecent,
      generatedAt: new Date().toISOString(),
    });
  }
}

// ─── Financial: contract value vs budget variance ───────────────────────────────

async function generateContractVsBudgetInsights(orgFilter, params, insights) {
  const whereClause = orgFilter ? `${orgFilter} AND` : 'WHERE 1=1 AND';
  const p = params;

  // Projects where spent > budget (over budget)
  const overResult = await pool.query(`
    SELECT name, client, budget, spent,
           COALESCE(spent - budget, 0) AS overspend,
           CASE WHEN budget > 0 THEN ROUND((spent / budget) * 100, 1) ELSE 0 END AS spend_pct
    FROM projects
    ${whereClause} spent > budget AND status NOT IN ('completed', 'archived')
    ORDER BY (spent - budget) DESC
    LIMIT 10
  `, p);

  for (const row of overResult.rows) {
    const overspend = parseFloat(row.overspend ?? 0);
    const spendPct = parseFloat(row.spend_pct ?? 0);

    let severity = 'medium';
    if (spendPct > 120 || overspend > 100000) severity = 'high';
    else if (spendPct < 105) severity = 'low';

    insights.push({
      id: `fin-budget-${row.name?.replace(/[^a-z0-9]/gi, '-').substring(0, 20)}`,
      category: 'financial',
      severity,
      title: `Project Over Budget: ${row.name}`,
      description: `"${row.name}" (${row.client || 'N/A'}) has spent £${overspend.toLocaleString('en-GB', { minimumFractionDigits: 0 })} over its £${parseFloat(row.budget ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 0 })} budget — ${spendPct}% of budget consumed.`,
      recommendation: 'Conduct an emergency cost review. Identify cost drivers and freeze non-essential spend. Raise a change order for approved variations.',
      impact: `Financial exposure of £${overspend.toLocaleString('en-GB', { minimumFractionDigits: 0 })}. Uncontrolled overspend erodes margin and may require additional funding.`,
      confidence: 88,
      dataPoints: 1,
      generatedAt: new Date().toISOString(),
    });
  }

  // Projects with zero budget set
  const noBudgetResult = await pool.query(`
    SELECT name, client, spent, status
    FROM projects
    ${whereClause} (budget IS NULL OR budget = 0) AND status NOT IN ('completed', 'archived')
    LIMIT 10
  `, p);

  if (noBudgetResult.rows.length > 0) {
    insights.push({
      id: 'fin-budget-missing',
      category: 'financial',
      severity: 'high',
      title: 'Projects Without Budget Set',
      description: `${noBudgetResult.rows.length} active project(s) have no budget configured — spend cannot be tracked against targets.`,
      recommendation: 'Immediately set a budget for each active project. Without a budget baseline, cost overruns will go undetected until they become critical.',
      impact: 'No financial control visibility. Overspend risk is unmonitored.',
      confidence: 95,
      dataPoints: noBudgetResult.rows.length,
      generatedAt: new Date().toISOString(),
    });
  }
}

// ─── Financial: invoice aging buckets ─────────────────────────────────────────

async function generateInvoiceAgingInsights(orgFilter, params, insights) {
  const whereClause = orgFilter ? `${orgFilter} AND` : 'WHERE 1=1 AND';
  const p = params;

  // Invoice aging: 30-60 days, 60-90 days, 90+ days overdue
  const agingResult = await pool.query(`
    SELECT
      COUNT(CASE WHEN CURRENT_DATE - due_date BETWEEN 30 AND 59 THEN 1 END) AS age_30_60,
      COUNT(CASE WHEN CURRENT_DATE - due_date BETWEEN 60 AND 89 THEN 1 END) AS age_60_90,
      COUNT(CASE WHEN CURRENT_DATE - due_date >= 90 THEN 1 END) AS age_90_plus,
      COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date BETWEEN 30 AND 59 THEN amount ELSE 0 END), 0) AS amount_30_60,
      COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date BETWEEN 60 AND 89 THEN amount ELSE 0 END), 0) AS amount_60_90,
      COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date >= 90 THEN amount ELSE 0 END), 0) AS amount_90_plus
    FROM invoices
    ${whereClause} status NOT IN ('paid', 'disputed') AND due_date < CURRENT_DATE
  `, p);

  const row = agingResult.rows[0];
  const age30_60 = parseInt(row?.age_30_60 ?? 0, 10);
  const age60_90 = parseInt(row?.age_60_90 ?? 0, 10);
  const age90plus = parseInt(row?.age_90_plus ?? 0, 10);
  const amount30_60 = parseFloat(row?.amount_30_60 ?? 0);
  const amount60_90 = parseFloat(row?.amount_60_90 ?? 0);
  const amount90plus = parseFloat(row?.amount_90_plus ?? 0);

  if (age60_90 > 0 || age90plus > 0) {
    const severeCount = age60_90 + age90plus;
    const severeAmount = amount60_90 + amount90plus;

    insights.push({
      id: 'fin-aging-severe',
      category: 'financial',
      severity: severeAmount > 20000 || severeCount > 3 ? 'high' : 'medium',
      title: 'Significant Aged Debt Requires Escalation',
      description: `${severeCount} invoice(s) are 60+ days overdue totalling £${severeAmount.toLocaleString('en-GB', { minimumFractionDigits: 0 })}. ${age30_60 > 0 ? `${age30_60} more (30-60 days, £${amount30_60.toLocaleString('en-GB', { minimumFractionDigits: 0 })}).` : ''}`,
      recommendation: 'Escalate to senior management. Consider legal action for 90+ day debts. Review client creditworthiness before awarding further contracts.',
      impact: 'Aged debt over 60 days significantly increases the risk of non-recovery. May require bad debt provisions.',
      confidence: 90,
      dataPoints: severeCount,
      generatedAt: new Date().toISOString(),
    });
  } else if (age30_60 > 0) {
    insights.push({
      id: 'fin-aging-moderate',
      category: 'financial',
      severity: amount30_60 > 10000 ? 'medium' : 'low',
      title: 'Moderate Invoice Aging Building',
      description: `${age30_60} invoice(s) are 30-60 days overdue totalling £${amount30_60.toLocaleString('en-GB', { minimumFractionDigits: 0 })}.`,
      recommendation: 'Issue formal payment demands. Negotiate payment schedules with clients showing goodwill.',
      impact: 'Moderate cash flow pressure. Prompt action should recover funds before they age further.',
      confidence: 85,
      dataPoints: age30_60,
      generatedAt: new Date().toISOString(),
    });
  }
}

// ─── Subcontractor performance insights ───────────────────────────────────────

async function generateSubcontractorInsights(orgFilter, params, insights) {
  const whereClause = orgFilter ? `${orgFilter} AND` : 'WHERE 1=1 AND';
  const p = params;

  // Unverified CIS subcontractors who are active
  const unverifiedResult = await pool.query(`
    SELECT company, trade, status, current_project
    FROM subcontractors
    ${whereClause} (cis_verified = false OR cis_verified = 'false' OR cis_verified IS NULL)
      AND status = 'active'
    LIMIT 20
  `, p);

  if (unverifiedResult.rows.length > 0) {
    insights.push({
      id: 'sub-001',
      category: 'subcontractor',
      severity: unverifiedResult.rows.length > 3 ? 'high' : 'medium',
      title: 'Unverified CIS Subcontractors on Active Projects',
      description: `${unverifiedResult.rows.length} active subcontractor(s) have unverified CIS status. Under the Construction Industry Scheme, all subcontractors must be CIS-verified before engaging.`,
      recommendation: 'Immediately request CIS verification for all unverified subcontractors. Do not make payments to unverified subcontractors without deducting 30% CIS charge.',
      impact: 'Non-compliance with HMRC CIS regulations. Risk of disallowed expenses and penalties. Unverified subs may not be legitimate businesses.',
      confidence: 95,
      dataPoints: unverifiedResult.rows.length,
      generatedAt: new Date().toISOString(),
    });
  }

  // Insurance expiring within 30 days
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const insResult = await pool.query(`
    SELECT company, trade, insurance_expiry
    FROM subcontractors
    ${whereClause} status = 'active'
    LIMIT 50
  `, p);

  const expiringIns = insResult.rows.filter(r => {
    if (!r.insurance_expiry) return false;
    const d = new Date(String(r.insurance_expiry));
    return d >= now && d <= in30;
  });

  if (expiringIns.length > 0) {
    insights.push({
      id: 'sub-002',
      category: 'subcontractor',
      severity: expiringIns.length > 2 ? 'high' : 'medium',
      title: 'Subcontractor Insurance Expiring Soon',
      description: `${expiringIns.length} active subcontractor(s) have insurance expiring within the next 30 days.`,
      recommendation: 'Contact each subcontractor and request evidence of renewed insurance before their current policy lapses. Suspend works if insurance lapses.',
      impact: 'Without valid insurance, the main contractor may be liable for any incidents involving the subcontractor. Contractual and HSE implications.',
      confidence: 92,
      dataPoints: expiringIns.length,
      generatedAt: new Date().toISOString(),
    });
  }

  // Subcontractors with no current project (idle capacity)
  const idleResult = await pool.query(`
    SELECT company, trade, status
    FROM subcontractors
    ${whereClause} status = 'active' AND (current_project IS NULL OR current_project = '')
    LIMIT 20
  `, p);

  if (idleResult.rows.length > 2) {
    insights.push({
      id: 'sub-003',
      category: 'subcontractor',
      severity: 'low',
      title: 'Idle Subcontractor Capacity Available',
      description: `${idleResult.rows.length} active subcontractor(s) currently have no project assigned. This represents unused capacity that could be deployed on current works.`,
      recommendation: 'Review upcoming project programmes and match idle subcontractors to areas where their trade is needed.',
      impact: 'Underutilised subcontractor relationships. May lead to subcontractors seeking work elsewhere.',
      confidence: 80,
      dataPoints: idleResult.rows.length,
      generatedAt: new Date().toISOString(),
    });
  }
}

// ─── Safety insights ──────────────────────────────────────────────────────────

async function generateSafetyInsights(orgFilter, params, insights) {
  const whereClause = orgFilter ? `${orgFilter} AND` : 'WHERE 1=1 AND';
  const p = params;

  const incidentResult = await pool.query(`
    SELECT
      COALESCE(SUM(CASE WHEN date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 ELSE 0 END), 0) AS recent,
      COALESCE(SUM(CASE WHEN date >= CURRENT_DATE - INTERVAL '60 days' AND date < CURRENT_DATE - INTERVAL '30 days' THEN 1 ELSE 0 END), 0) AS previous
    FROM safety_incidents
    ${whereClause} date >= CURRENT_DATE - INTERVAL '60 days'
  `, p);

  const row = incidentResult.rows[0];
  const recentCount = parseInt(row?.recent ?? 0, 10);
  const previousCount = parseInt(row?.previous ?? 0, 10);

  if (recentCount > previousCount) {
    const increase = previousCount > 0
      ? Math.round(((recentCount - previousCount) / previousCount) * 100)
      : 100;

    let severity = 'medium';
    if (recentCount >= 5 || increase >= 50) severity = 'high';
    if (recentCount >= 10 || increase >= 100) severity = 'critical';

    insights.push({
      id: 'saf-001',
      category: 'safety',
      severity,
      title: 'Safety Incident Rate Increasing',
      description: `${recentCount} incident(s) in the last 30 days vs ${previousCount} in the prior 30 days — a ${increase}% increase.`,
      recommendation: 'Conduct a safety stand-down meeting. Review recent incident reports for common root causes. Increase toolbox talk frequency and PPE inspections.',
      impact: 'Elevated HSE enforcement risk. Potential site suspension. Increased insurance premiums.',
      confidence: Math.min(95, 55 + recentCount * 4),
      dataPoints: recentCount + previousCount,
      generatedAt: new Date().toISOString(),
    });
  }

  const unclosedResult = await pool.query(`
    SELECT COUNT(*) AS count
    FROM safety_incidents
    ${whereClause} status != 'closed'
      AND date < CURRENT_DATE - INTERVAL '7 days'
  `, p);

  const unclosedCount = parseInt(unclosedResult.rows[0]?.count ?? 0, 10);
  if (unclosedCount > 0) {
    insights.push({
      id: 'saf-002',
      category: 'safety',
      severity: unclosedCount > 3 ? 'high' : 'medium',
      title: 'Unresolved Safety Incidents',
      description: `${unclosedCount} safety incident(s) remain open and are more than 7 days old.`,
      recommendation: 'Review each open incident and assign corrective actions. Close or escalate any that cannot be resolved within 14 days.',
      impact: 'Unresolved incidents may constitute non-compliance with HSE reporting requirements.',
      confidence: 88,
      dataPoints: unclosedCount,
      generatedAt: new Date().toISOString(),
    });
  }
}

// ─── Programme insights ───────────────────────────────────────────────────────

async function generateProgrammeInsights(orgFilter, params, insights) {
  const whereClause = orgFilter ? `${orgFilter} AND` : 'WHERE 1=1 AND';
  const p = params;

  const openRfiResult = await pool.query(`
    SELECT COUNT(*) AS count
    FROM rfis
    ${whereClause} status NOT IN ('closed', 'answered')
      AND due_date < CURRENT_DATE - INTERVAL '30 days'
  `, p);

  const openRfiCount = parseInt(openRfiResult.rows[0]?.count ?? 0, 10);

  if (openRfiCount > 0) {
    let severity = 'low';
    if (openRfiCount > 10) severity = 'high';
    else if (openRfiCount > 5) severity = 'medium';

    insights.push({
      id: 'prg-001',
      category: 'programme',
      severity,
      title: 'Stale RFIs Need Attention',
      description: `${openRfiCount} RFI(s) have been open for more than 30 days without a response.`,
      recommendation: 'Review with the design team. Escalate RFIs older than 45 days to the project manager.',
      impact: `Programme delay risk: each unresolved RFI blocks downstream work.`,
      confidence: Math.min(92, 60 + openRfiCount * 2),
      dataPoints: openRfiCount,
      generatedAt: new Date().toISOString(),
    });
  }

  const totalOpenResult = await pool.query(`
    SELECT COUNT(*) AS count
    FROM rfis
    ${whereClause} status NOT IN ('closed', 'answered')
  `, p);

  const totalOpenCount = parseInt(totalOpenResult.rows[0]?.count ?? 0, 10);
  if (totalOpenCount > 15) {
    insights.push({
      id: 'prg-002',
      category: 'programme',
      severity: 'medium',
      title: 'High RFI Volume Requiring Coordination',
      description: `${totalOpenCount} RFIs are currently open across all projects.`,
      recommendation: 'Schedule a weekly RFI review meeting with the design team to drive closure.',
      impact: 'Coordination overhead and decision bottlenecks.',
      confidence: 78,
      dataPoints: totalOpenCount,
      generatedAt: new Date().toISOString(),
    });
  }

  // Overdue change orders
  const overdueCoResult = await pool.query(`
    SELECT COUNT(*) AS count
    FROM change_orders
    ${whereClause} status = 'pending'
      AND submitted_date < CURRENT_DATE - INTERVAL '30 days'
  `, p);

  const overdueCoCount = parseInt(overdueCoResult.rows[0]?.count ?? 0, 10);
  if (overdueCoCount > 0) {
    insights.push({
      id: 'prg-003',
      category: 'programme',
      severity: overdueCoCount > 3 ? 'high' : 'medium',
      title: 'Change Orders Overdue for Decision',
      description: `${overdueCoCount} change order(s) have been pending a decision for more than 30 days.`,
      recommendation: 'Escalate pending change orders to the client/employer for immediate decision. Unresolved variations create financial and programme uncertainty.',
      impact: 'Financial exposure from unapproved variations. Subcontractor and supplier commitments may be at risk without approved change orders.',
      confidence: 85,
      dataPoints: overdueCoCount,
      generatedAt: new Date().toISOString(),
    });
  }
}

// ─── Resource insights ────────────────────────────────────────────────────────

async function generateResourceInsights(orgFilter, params, insights) {
  const whereClause = orgFilter ? `${orgFilter} AND` : 'WHERE 1=1 AND';
  const p = params;

  const certResult = await pool.query(`
    SELECT COUNT(*) AS count
    FROM certifications
    ${whereClause} expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
  `, p);

  const expiringCertCount = parseInt(certResult.rows[0]?.count ?? 0, 10);

  if (expiringCertCount > 0) {
    let severity = 'low';
    if (expiringCertCount > 3) severity = 'high';
    else if (expiringCertCount > 1) severity = 'medium';

    insights.push({
      id: 'res-001',
      category: 'resource',
      severity,
      title: 'Team Certifications Expiring Soon',
      description: `${expiringCertCount} certification(s) are due to expire within the next 60 days.`,
      recommendation: 'Identify affected team members and schedule renewal training immediately.',
      impact: 'Site access restrictions. Potential HSE compliance breach.',
      confidence: 90,
      dataPoints: expiringCertCount,
      generatedAt: new Date().toISOString(),
    });
  }

  const trainingResult = await pool.query(`
    SELECT COUNT(*) AS count
    FROM training
    ${whereClause} (expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days')
       OR (expiry_date < CURRENT_DATE AND status != 'completed')
  `, p);

  const trainingIssues = parseInt(trainingResult.rows[0]?.count ?? 0, 10);
  if (trainingIssues > 0) {
    insights.push({
      id: 'res-002',
      category: 'resource',
      severity: trainingIssues > 5 ? 'high' : 'medium',
      title: 'Training Records Need Review',
      description: `${trainingIssues} training record(s) are either expired or expiring soon.`,
      recommendation: 'Audit all training records. Contact training providers to confirm renewal schedules.',
      impact: 'Competency gaps on site. Potential non-compliance with training requirements.',
      confidence: 85,
      dataPoints: trainingIssues,
      generatedAt: new Date().toISOString(),
    });
  }
}

// ─── Quarter-over-quarter trend insights ──────────────────────────────────────

async function generateTrendInsights(orgFilter, params, insights) {
  const whereClause = orgFilter || 'WHERE 1=1';
  const p = params;

  // Project spend trend: this quarter vs last quarter
  const quarterResult = await pool.query(`
    SELECT
      COALESCE(SUM(CASE WHEN created_at >= DATE_TRUNC('quarter', CURRENT_DATE)
        THEN spent ELSE 0 END), 0) AS spent_this_q,
      COALESCE(SUM(CASE WHEN created_at >= DATE_TRUNC('quarter', CURRENT_DATE - INTERVAL '3 months')
                         AND created_at < DATE_TRUNC('quarter', CURRENT_DATE)
        THEN spent ELSE 0 END), 0) AS spent_last_q
    FROM projects
    ${whereClause}
  `, p);

  const qRow = quarterResult.rows[0];
  const spentThisQ = parseFloat(qRow?.spent_this_q ?? 0);
  const spentLastQ = parseFloat(qRow?.spent_last_q ?? 0);

  if (spentLastQ > 0 && spentThisQ > spentLastQ * 1.3) {
    insights.push({
      id: 'trend-001',
      category: 'trend',
      severity: 'medium',
      title: 'Accelerating Project Spend This Quarter',
      description: `Total project spend this quarter (${spentThisQ > 0 ? '£' + spentThisQ.toLocaleString('en-GB', { minimumFractionDigits: 0 }) : '£0'}) is more than 30% higher than last quarter (${spentLastQ > 0 ? '£' + spentLastQ.toLocaleString('en-GB', { minimumFractionDigits: 0 }) : '£0'}).`,
      recommendation: 'Review project cost dashboards to identify which projects are driving the increase. Assess whether this is planned acceleration or uncontrolled overspend.',
      impact: 'Accelerated spend without corresponding income may pressure cash flow. Ensure valuations are submitted and certified on time.',
      confidence: 75,
      dataPoints: 2,
      generatedAt: new Date().toISOString(),
      trend: 'increasing',
    });
  }

  // Tender pipeline trend: new tenders this quarter vs last
  const tenderResult = await pool.query(`
    SELECT
      COUNT(CASE WHEN created_at >= DATE_TRUNC('quarter', CURRENT_DATE) THEN 1 END) AS new_this_q,
      COUNT(CASE WHEN created_at >= DATE_TRUNC('quarter', CURRENT_DATE - INTERVAL '3 months')
                 AND created_at < DATE_TRUNC('quarter', CURRENT_DATE) THEN 1 END) AS new_last_q,
      COALESCE(SUM(CASE WHEN created_at >= DATE_TRUNC('quarter', CURRENT_DATE) THEN value ELSE 0 END), 0) AS value_this_q,
      COALESCE(SUM(CASE WHEN created_at >= DATE_TRUNC('quarter', CURRENT_DATE - INTERVAL '3 months')
                        AND created_at < DATE_TRUNC('quarter', CURRENT_DATE) THEN value ELSE 0 END), 0) AS value_last_q
    FROM tenders
    ${whereClause}
  `, p);

  const tRow = tenderResult.rows[0];
  const newThisQ = parseInt(tRow?.new_this_q ?? 0, 10);
  const newLastQ = parseInt(tRow?.new_last_q ?? 0, 10);
  const valueThisQ = parseFloat(tRow?.value_this_q ?? 0);
  const valueLastQ = parseFloat(tRow?.value_last_q ?? 0);

  if (newThisQ > newLastQ * 1.5 && newThisQ >= 3) {
    insights.push({
      id: 'trend-002',
      category: 'trend',
      severity: 'low',
      title: 'Tender Pipeline Activity Increasing',
      description: `${newThisQ} new tender(s) added this quarter vs ${newLastQ} last quarter — pipeline activity is up significantly.`,
      recommendation: 'Ensure sufficient bid management resource to pursue the expanded pipeline. Prioritise highest-value opportunities.',
      impact: 'Increased pipeline is positive for business development but requires careful resource allocation to avoid spreading bid effort too thinly.',
      confidence: 80,
      dataPoints: newThisQ + newLastQ,
      generatedAt: new Date().toISOString(),
      trend: 'positive',
    });
  }

  if (valueThisQ < valueLastQ * 0.7 && valueLastQ > 0) {
    insights.push({
      id: 'trend-003',
      category: 'trend',
      severity: 'medium',
      title: 'Tender Pipeline Value Declining',
      description: `Total pipeline value this quarter (£${valueThisQ.toLocaleString('en-GB', { minimumFractionDigits: 0 })}) is notably lower than last quarter (£${valueLastQ.toLocaleString('en-GB', { minimumFractionDigits: 0 })}).`,
      recommendation: 'Prioritise pursuits for higher-value opportunities. Consider market analysis to identify new sectors or clients to approach.',
      impact: 'Lower pipeline value puts future revenue at risk. May indicate reduced win rate or insufficient business development activity.',
      confidence: 78,
      dataPoints: 2,
      generatedAt: new Date().toISOString(),
      trend: 'negative',
    });
  }

  // Defect trend: this quarter vs last
  const defectResult = await pool.query(`
    SELECT
      COUNT(CASE WHEN created_at >= DATE_TRUNC('quarter', CURRENT_DATE) THEN 1 END) AS defects_this_q,
      COUNT(CASE WHEN created_at >= DATE_TRUNC('quarter', CURRENT_DATE - INTERVAL '3 months')
                 AND created_at < DATE_TRUNC('quarter', CURRENT_DATE) THEN 1 END) AS defects_last_q
    FROM defects
    ${whereClause}
  `, p);

  const dRow = defectResult.rows[0];
  const defectsThisQ = parseInt(dRow?.defects_this_q ?? 0, 10);
  const defectsLastQ = parseInt(dRow?.defects_last_q ?? 0, 10);

  if (defectsLastQ > 0 && defectsThisQ > defectsLastQ * 1.4) {
    insights.push({
      id: 'trend-004',
      category: 'trend',
      severity: defectsThisQ - defectsLastQ > 5 ? 'high' : 'medium',
      title: 'Defect Rate Increasing',
      description: `${defectsThisQ} defect(s) raised this quarter vs ${defectsLastQ} last quarter — a ${Math.round(((defectsThisQ - defectsLastQ) / defectsLastQ) * 100)}% increase.`,
      recommendation: 'Investigate root causes of the increase. Review quality control procedures. Check if defects are concentrated in specific trades or projects.',
      impact: 'Rising defects indicate quality control issues. Unresolved defects at practical completion can trigger retention withholding and damage reputation.',
      confidence: 82,
      dataPoints: defectsThisQ + defectsLastQ,
      generatedAt: new Date().toISOString(),
      trend: 'negative',
    });
  }
}

module.exports = router;
