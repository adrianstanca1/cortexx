/**
 * Contracts Agent
 * Handles contract review, JCT/NEC contracts, subcontract agreements, payment terms
 */

const CONTRACT_TYPES = {
  JCT: {
    name: 'JCT (Joint Contracts Tribunal)',
    variants: ['JCT 2016', 'JCT 2011', 'JCT 2005'],
    keyClauses: ['payment', 'defects liability', 'retention', 'termination', 'adjudication'],
    defaultRetention: 5
  },
  NEC3: {
    name: 'NEC3 (New Engineering Contract)',
    variants: ['NEC3 ECC', 'NEC3 PSC', 'NEC3 Term'],
    keyClauses: ['early warning', 'compensation events', 'title', 'risk', 'payment'],
    defaultRetention: 10
  },
  NEC4: {
    name: 'NEC4 (New Engineering Contract)',
    variants: ['NEC4 ECC', 'NEC4 PSC', 'NEC4 Term', 'NEC4 Supply'],
    keyClauses: ['early warning', 'levy', 'termination', 'reduced period', 'dispute resolution'],
    defaultRetention: 10
  },
  ICC: {
    name: 'ICC (International Contracts)',
    variants: ['ICC 2016', 'ICC 2022'],
    keyClauses: ['force majeure', 'dispute', 'payment', 'limitation of liability'],
    defaultRetention: 10
  }
};

const PAYMENT_MECHANISMS = {
  monthly: { description: 'Monthly applications', typical: 'JCT, NEC' },
  stage: { description: 'Stage/practical completion payments', typical: 'Residential' },
  interim: { description: 'Interim certificates', typical: 'NEC' },
  advanced: { description: 'Payment in advance', typical: 'Specialist contracts' }
};

const BOND_TYPES = {
  performance: { typicalRate: '5-10% of contract value', purpose: 'Guarantees contract completion' },
  advance_payment: { typicalRate: '100% of advance', purpose: 'Secures advance payment recovery' },
  retention: { typicalRate: '3-5% of contract value', purpose: 'Covers defects liability' },
  tender: { typicalRate: '2-5% of contract value', purpose: 'Guarantees tender submission' }
};

function identifyContractType(documentText) {
  const lower = (documentText || '').toLowerCase();
  if (lower.includes('nec3') || lower.includes('new engineering contract 3')) return 'NEC3';
  if (lower.includes('nec4') || lower.includes('new engineering contract 4')) return 'NEC4';
  if (lower.includes('jct') || lower.includes('joint contracts tribunal')) return 'JCT';
  if (lower.includes('icc') || lower.includes('international contracts')) return 'ICC';
  return 'Unknown';
}

function extractPaymentTerms(contractType, documentText) {
  const type = CONTRACT_TYPES[contractType] || CONTRACT_TYPES.JCT;
  return {
    mechanism: type.name.includes('NEC') ? 'interim' : 'monthly',
    retentionPercent: type.defaultRetention,
    defectsLiabilityPeriod: contractType === 'NEC4' ? '24 months' : '12 months',
    noticePeriodDays: contractType.includes('NEC') ? 7 : 14,
    paymentMechanism: PAYMENT_MECHANISMS[contractType.includes('NEC') ? 'interim' : 'monthly']
  };
}

function assessRiskLevel(value, type, retention) {
  const baseRisk = value > 500000 ? 'high' : value > 100000 ? 'medium' : 'low';
  const contractRisk = type === 'Unknown' ? 'high' : 'medium';
  const retentionRisk = retention < 3 ? 'high' : retention < 5 ? 'medium' : 'low';
  return baseRisk;
}

function reviewIndemnityClauses(documentText) {
  const findings = [];
  const lower = (documentText || '').toLowerCase();

  if (lower.includes('unlimited liability')) findings.push({ clause: 'Unlimited liability', severity: 'high', note: 'Negotiate cap' });
  if (lower.includes('mutual indemnity')) findings.push({ clause: 'Mutual indemnity', severity: 'low', note: 'Standard and acceptable' });
  if (lower.includes('carriage of risk')) findings.push({ clause: 'Risk transfer timing', severity: 'medium', note: 'Review transfer point' });
  if (!lower.includes('indemnity')) findings.push({ clause: 'No indemnity clause found', severity: 'medium', note: 'Verify coverage adequacy' });

  return findings;
}

function checkLiquidatedDamages(documentText) {
  const lower = (documentText || '').toLowerCase();
  const ldPattern = /liquidated[\s-]?damages?\s*:?\s*(\d+)/i;
  const match = lower.match(ldPattern);

  if (match) {
    return {
      found: true,
      amount: match[1],
      severity: 'info',
      note: 'Confirm LDs are reasonable reflection of actual loss'
    };
  }

  return {
    found: false,
    severity: 'medium',
    note: 'No liquidated damages clause — consider adding for large contracts'
  };
}

module.exports = {
  CONTRACT_TYPES,
  PAYMENT_MECHANISMS,
  BOND_TYPES,
  identifyContractType,
  extractPaymentTerms,
  assessRiskLevel,
  reviewIndemnityClauses,
  checkLiquidatedDamages
};
