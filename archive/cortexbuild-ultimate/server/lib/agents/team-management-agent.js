/**
 * Team Management Agent
 * Handles workforce planning, trade allocation, labour productivity, certifications
 */

const CERTIFICATION_TYPES = {
  CSCS: {
    name: 'Construction Skills Certification Scheme',
    validity: 'Card expiry date',
    types: ['Blue (skilled)', 'Green (basic)', 'Gold (supervisor)', 'Black (manager)']
  },
  CPCS: {
    name: 'Construction Plant Certification Scheme',
    validity: '5 years',
    types: ['A', 'B', 'C categories for plant operations']
  },
  SSSTS: {
    name: 'Site Supervisors Safety Training Scheme',
    validity: '5 years',
    note: 'Required for supervisors on most sites'
  },
  SMSTS: {
    name: 'Site Manager Safety Training Scheme',
    validity: '5 years',
    note: 'Required for site managers'
  },
  Fetac: {
    name: 'Further Education and Training Awards',
    validity: 'Permanent',
    note: 'Irish qualification framework'
  },
  IR35: {
    name: 'Off-payroll working rules',
    validity: 'Per engagement',
    note: 'Tax status determination for contractors'
  }
};

const LABOUR_CATEGORIES = {
  'groundworks': { trades: ['bricklayer', 'general', 'excavator operator'], productivity: '1.0' },
  'structural': { trades: ['steel fixer', 'concreter', 'formwork', 'bricklayer'], productivity: '1.2' },
  'M&E': { trades: ['electrician', 'plumber', 'HVAC', 'fire systems'], productivity: '1.1' },
  'finishing': { trades: ['plasterer', 'painter', 'floor layer', 'joiner'], productivity: '1.0' },
  'roofing': { trades: ['roofing slater', 'flat roof', 'lead worker'], productivity: '1.3' },
  'cladding': { trades: ['cladder', ' curtain wall', 'glazier'], productivity: '1.2' },
  'landscaping': { trades: ['groundworker', 'landscape', 'fencing'], productivity: '0.9' }
};

const PRODUCTIVITY_FACTORS = {
  gang_composition: { optimal: '4-6 workers', note: 'Balance of trades for efficiency' },
  weather: { hot: '1.2x', cold: '0.9x', rain: '0.8x' },
  urban_vs_rural: { urban: '1.1x', rural: '1.0x' },
  unionised: { union: '0.9x', non_union: '1.0x' }
};

const CIS_RATES = {
  'cis_250': { rate: '20%', threshold: '£30,000-£100,000', type: 'PCR 2019' },
  'cis_110': { rate: '20%', threshold: 'Under £30,000', type: 'Subcontractor with credit' },
  'cis_0': { rate: '0%', threshold: 'Over £100,000 or verified', type: 'Verified contractor' }
};

const HEADCOUNT_THRESHOLDS = {
  small: { max: 10, note: 'Scaffold notification not required' },
  medium: { max: 50, note: 'HSE notification recommended' },
  large: { max: 100, note: 'Formal notification required' },
  major: { max: Infinity, note: 'F10 notification required for 100+' }
};

function calculateProductivity(trade, weather, location, gangSize) {
  const base = parseFloat(LABOUR_CATEGORIES[trade]?.productivity || '1.0');
  const weatherFactor = PRODUCTIVITY_FACTORS.weather[weather?.toLowerCase()] || '1.0';
  const locationFactor = PRODUCTIVITY_FACTORS[location]?.[0] || '1.0';
  const adjusted = base * parseFloat(weatherFactor) * parseFloat(locationFactor);

  return {
    baseProductivity: base,
    weatherFactor,
    locationFactor,
    adjustedProductivity: adjusted,
    gangSize,
    optimal: gangSize >= 4 && gangSize <= 6
  };
}

function checkCertificationExpiry(certifications) {
  const now = new Date();
  const results = [];

  for (const cert of certifications) {
    const expiryDate = new Date(cert.expiry_date || cert.valid_until);
    const daysUntilExpiry = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));

    results.push({
      type: cert.type,
      holder: cert.holder_name || cert.name,
      expiry: cert.expiry_date,
      daysRemaining: daysUntilExpiry,
      status: daysUntilExpiry < 0 ? 'expired' : daysUntilExpiry < 30 ? 'expiring_soon' : 'valid',
      notificationRequired: daysUntilExpiry <= 30
    });
  }

  return results;
}

function allocateWorkforce(projectRequirements, availableTeam) {
  const allocation = [];

  for (const [requirement, config] of Object.entries(projectRequirements)) {
    const trade = config.trade || requirement;
    const required = config.count || 1;
    const available = availableTeam.filter(t =>
      (t.trade === trade || t.trade === 'general') && t.status === 'active'
    );

    allocation.push({
      requirement,
      trade,
      required,
      available: available.length,
      shortfall: Math.max(0, required - available.length),
      allocated: available.slice(0, required).map(t => t.name),
      status: required <= available.length ? 'fulfilled' : 'shortfall'
    });
  }

  return allocation;
}

function getIR35Status(workerType, engagementType, psc) {
  if (workerType === 'sole_trader' || workerType === 'limited_company') {
    if (engagementType === 'outside_IR35') {
      return {
        status: 'outside_IR35',
        taxTreatment: 'Self-employed taxation',
        note: psc ? 'PSC intermediary route applies' : 'Direct engagement'
      };
    }
    return {
      status: 'inside_IR35',
      taxTreatment: 'PAYE equivalent',
      note: 'Deemed payment applies — deduct tax and NI'
    };
  }

  return {
    status: 'unknown',
    taxTreatment: 'Standard employment',
    note: 'Full employment rights apply'
  };
}

function formatCISResponse(subcontractor, cisStatus) {
  return {
    company: subcontractor.name,
    cisStatus: cisStatus.status,
    verifiedRate: cisStatus.rate,
    taxableForVAT: subcontractor.vat_registered,
    relevantThreshold: CIS_RATES[cisStatus.rate]?.threshold || 'Standard',
    taxDeduction: cisStatus.rate === 'cis_0' ? 'None' : CIS_RATES[cisStatus.rate]?.rate
  };
}

module.exports = {
  CERTIFICATION_TYPES,
  LABOUR_CATEGORIES,
  PRODUCTIVITY_FACTORS,
  CIS_RATES,
  HEADCOUNT_THRESHOLDS,
  calculateProductivity,
  checkCertificationExpiry,
  allocateWorkforce,
  getIR35Status,
  formatCISResponse
};
