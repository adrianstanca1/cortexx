/**
 * Construction Domain Agent
 * Provides construction industry knowledge, standards, and best practices
 */

const CONSTRUCTION_STANDARDS = {
  general: {
    foundations: { minDepth: '12 inches', reinforcement: '#4 rebar @ 18" oc' },
    framing: { studSpacing: '16" oc', maxSpan: '20 feet for 2x10' },
    electrical: { minWireGauge: '12 AWG for 20A circuits', gfcRequiredAreas: ['bathrooms', 'kitchens', 'outdoors'] },
    plumbing: { minPipeSize: '3/4 inch main supply', ventRequired: 'Every fixture' }
  },
  residential: {
    foundations: { minDepth: '18 inches', reinforcement: '#5 rebar @ 16" oc' },
    framing: { studSpacing: '16" oc', maxSpan: '16 feet for 2x10' },
    roofing: { minPitch: '3:12', snowLoad: '20 psf ground snow load' },
    energy: { insulation: 'R-13 walls, R-38 ceiling', windows: 'Double-pane low-E' }
  },
  commercial: {
    foundations: { minDepth: '24 inches', reinforcement: '#6 rebar @ 12" oc' },
    framing: { studSpacing: '16" oc', maxSpan: '25 feet for steel' },
    fireSafety: { sprinklerRequired: '>5000 sq ft', ratedAssemblies: '2-hour fire walls' },
    accessibility: { adaCompliant: 'Required', elevatorRequired: '>3 stories' }
  },
  industrial: {
    foundations: { minDepth: '36 inches', reinforcement: '#7 rebar @ 12" oc' },
    flooring: { loadCapacity: '250 psf minimum', chemicalResistance: 'Required' },
    mechanical: { clearance: 'Minimum 7 feet', ventilation: '6 air changes/hour' },
    safety: { explosionProof: 'Required in hazardous areas', containment: 'Secondary containment for liquids' }
  },
  infrastructure: {
    bridges: { loadRating: 'HL-93 minimum', inspectionFrequency: 'Bi-annual' },
    roads: { pavementDepth: '12 inches minimum', drainage: '2% cross slope minimum' },
    utilities: { buryDepth: '36 inches minimum', corrosionProtection: 'Required for metal' },
    traffic: { designSpeed: 'Posted speed limit + 5 mph', clearZone: '30 feet from travel lane' }
  }
};

const COMMON_PRACTICES = {
  general: [
    'Regular safety inspections and toolbox talks',
    'Proper material storage and handling',
    'Daily cleanup and housekeeping',
    'Documentation of all changes and deviations',
    'Regular equipment maintenance and inspection'
  ],
  residential: [
    'Customer communication and satisfaction tracking',
    'Warranty and callback management',
    'Energy code compliance verification',
    'Building envelope moisture management'
  ],
  commercial: [
    'Coordination with multiple trades and subcontractors',
    'Strict adherence to schedules and milestones',
    'Life safety system verification',
    'Accessibility compliance checks'
  ],
  industrial: [
    'Process safety management and hazard analysis',
    'Environmental compliance and monitoring',
    'Heavy equipment coordination',
    'Industrial hygiene monitoring'
  ]
};

const SEASONAL_CONSIDERATIONS = {
  spring: {
    concerns: ['thawing ground', 'increased moisture', 'unstable soil'],
    recommendations: ['proper drainage', 'wait for stable soil', 'foundation inspections']
  },
  summer: {
    concerns: ['heat exposure', 'thunderstorms', 'dehydration'],
    recommendations: ['heat stress prevention', 'lightning safety', 'hydrated crews']
  },
  fall: {
    concerns: ['decreasing daylight', 'precipitation', 'temperature swings'],
    recommendations: ['artificial lighting', 'weather protection', 'early shutdown procedures']
  },
  winter: {
    concerns: ['freezing temperatures', 'snow accumulation', 'ice'],
    recommendations: ['heated enclosures', 'snow removal', 'cold weather concrete procedures']
  }
};

function getStandards(specialty) {
  return CONSTRUCTION_STANDARDS[specialty] || CONSTRUCTION_STANDARDS.general;
}

function getPractices(specialty) {
  return COMMON_PRACTICES[specialty] || COMMON_PRACTICES.general;
}

function assessRisks(specialty, region) {
  const risks = [
    { id: 'weather', description: 'Weather delays', probability: 'medium', impact: 'medium', mitigation: 'Weather-resistant materials and schedules' },
    { id: 'materials', description: 'Material price fluctuations', probability: 'high', impact: 'low', mitigation: 'Fixed-price contracts and early procurement' },
    { id: 'labor', description: 'Labor shortages', probability: 'medium', impact: 'high', mitigation: 'Training programs and competitive wages' },
    { id: 'supply', description: 'Supply chain disruptions', probability: 'medium', impact: 'high', mitigation: 'Multiple suppliers and buffer stock' }
  ];

  if (region.toLowerCase().includes('coastal') || region.toLowerCase().includes('hurricane')) {
    risks.push({
      id: 'flood',
      description: 'Flood and hurricane risks',
      probability: 'high',
      impact: 'high',
      mitigation: 'Elevated construction, hurricane straps, flood barriers'
    });
  }

  return { risks, overallRiskLevel: 'medium', specialty, region };
}

function checkCompliance(specialty, requirements) {
  const violations = [];
  const standards = getStandards(specialty);

  for (const req of requirements) {
    const category = req.category;
    const required = req.value;

    if (standards[category]) {
      const standard = standards[category];
      if (standard[req.property] && standard[req.property] !== required) {
        violations.push({
          category,
          property: req.property,
          expected: standard[req.property],
          received: required,
          severity: req.severity || 'medium'
        });
      }
    }
  }

  return {
    status: violations.length === 0 ? 'compliant' : 'violations_found',
    violations,
    checkedAt: new Date().toISOString()
  };
}

function getRecommendations(specialty, context) {
  const practices = getPractices(specialty);
  const seasonal = SEASONAL_CONSIDERATIONS[context.season] || {};

  return {
    practices,
    seasonal: seasonal.recommendations || [],
    specialty,
    context,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  getStandards,
  getPractices,
  assessRisks,
  checkCompliance,
  getRecommendations,
  CONSTRUCTION_STANDARDS,
  COMMON_PRACTICES,
  SEASONAL_CONSIDERATIONS
};
