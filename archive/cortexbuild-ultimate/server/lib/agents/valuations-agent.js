/**
 * Valuations Agent
 * Handles interim valuations, payment applications, PC sums, cash flow forecasting
 */

const VALUATION_STATUSES = ['draft', 'submitted', 'certified', 'paid', 'partially_paid', 'withheld', 'overdue'];

const MEASUREMENT_BASIS = {
  'NEC3 ECC': 'Actual quantities measured',
  'NEC4 ECC': 'Actual quantities measured',
  'JCT': 'Measurement agreement',
  'ICC': 'Bill of quantities (BoQ)'
};

const CASH_FLOW_CATEGORIES = {
  very_low: { threshold: 0.25, description: 'Early stage — mobilization and design' },
  low: { threshold: 0.40, description: 'Procurement and early construction' },
  medium: { threshold: 0.70, description: 'Main construction phase' },
  high: { threshold: 0.90, description: 'Finishing and handover' },
  very_high: { threshold: 1.0, description: 'Practical completion and defects liability' }
};

const WITHHOLDING_REASONS = {
  'unspecified': { common: true, noticeRequired: false },
  'defective_work': { common: true, noticeRequired: true, days: 7 },
  'prolongation_costs': { common: true, noticeRequired: true, days: 14 },
  'liquidated_damages': { common: true, noticeRequired: true, days: 14 },
  'cis_deduction': { common: true, noticeRequired: false },
  'retention': { common: true, noticeRequired: false },
  'unpaid_previous': { common: true, noticeRequired: true, days: 7 }
};

function calculateInterimValue(workDone, materials, PC_Sums, retentionPercent, previousCertifications) {
  const gross = parseFloat(workDone || 0) + parseFloat(materials || 0) + parseFloat(PC_Sums || 0);
  const retention = gross * (parseFloat(retentionPercent) / 100);
  const previousDeductions = parseFloat(previousCertifications || 0);
  const net = gross - retention;

  return {
    workDone: parseFloat(workDone || 0),
    materialsOnSite: parseFloat(materials || 0),
    pcSums: parseFloat(PC_Sums || 0),
    grossValue: gross,
    retentionAmount: retention,
    netInterim: net,
    lessPrevious: previousDeductions,
    totalDue: net - previousDeductions
  };
}

function forecastCashFlow(projectValue, progressPercent, remainingMonths) {
  const stage = Object.entries(CASH_FLOW_CATEGORIES).find(([, v]) => progressPercent <= v.threshold)?.[0] || 'very_high';
  const monthlyAverage = projectValue * progressPercent / (12 - remainingMonths || 1);

  return {
    stage,
    stageDescription: CASH_FLOW_CATEGORIES[stage].description,
    totalProjectValue: projectValue,
    certifiedToDate: projectValue * progressPercent,
    forecastMonthly: monthlyAverage,
    remaining: projectValue * (1 - progressPercent),
    projections: Array.from({ length: Math.min(remainingMonths, 12) }, (_, i) => ({
      month: i + 1,
      projected: monthlyAverage * (1 + (i * 0.05))
    }))
  };
}

function formatPaymentNotice(valuation) {
  return {
    reference: valuation.reference || `VAL-${valuation.id}`,
    date: valuation.date || new Date().toISOString().split('T')[0],
    applicationNumber: valuation.application_number,
    period: valuation.period || 'Monthly',
    workDone: valuation.work_done,
    materialsOnSite: valuation.materials_on_site,
    pcSums: valuation.pc_sums,
    grossValue: valuation.gross_value,
    retention: valuation.retention,
    netValue: valuation.net_value,
    amountsDue: [
      { description: 'Work executed to date', amount: valuation.work_done },
      { description: 'Materials on site', amount: valuation.materials_on_site },
      { description: 'PC Sums', amount: valuation.pc_sums }
    ],
    withholdings: valuation.withholdings || [],
    certifiedValue: valuation.certified_value,
    status: valuation.status
  };
}

function assessWithholding(valuation) {
  const reasons = [];
  const lower = (JSON.stringify(valuation).toLowerCase());

  for (const [reason, config] of Object.entries(WITHHOLDING_REASONS)) {
    if (lower.includes(reason)) {
      reasons.push({
        reason,
        ...config,
        note: `Common withholding: ${config.common ? 'Yes' : 'No'}`
      });
    }
  }

  return {
    hasWithholding: reasons.length > 0,
    reasons,
    totalWithheld: reasons.reduce((s, r) => s + parseFloat(r.amount || 0), 0),
    noticeRequired: reasons.some(r => r.noticeRequired)
  };
}

function parseValuationSchedule(documentText) {
  const lines = (documentText || '').split('\n').filter(l => l.trim());
  const items = [];

  for (const line of lines) {
    const parts = line.split(/\t|,/);
    if (parts.length >= 3) {
      items.push({
        reference: parts[0]?.trim(),
        description: parts[1]?.trim(),
        amount: parseFloat(parts[2]?.replace(/[£,$]/g, '')) || 0
      });
    }
  }

  return {
    total: items.reduce((s, i) => s + i.amount, 0),
    items,
    itemCount: items.length
  };
}

module.exports = {
  VALUATION_STATUSES,
  MEASUREMENT_BASIS,
  CASH_FLOW_CATEGORIES,
  WITHHOLDING_REASONS,
  calculateInterimValue,
  forecastCashFlow,
  formatPaymentNotice,
  assessWithholding,
  parseValuationSchedule
};
