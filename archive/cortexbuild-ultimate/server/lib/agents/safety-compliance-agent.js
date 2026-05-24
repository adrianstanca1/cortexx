/**
 * Safety Compliance Agent
 * Provides safety compliance checking and hazard analysis
 */

const OSHA_STANDARDS = {
  fallProtection: {
    height: '4 feet general industry, 6 feet construction',
    required: ['guardrails', 'safety nets', 'personal fall arrest systems'],
    training: 'Required for all workers exposed to fall hazards'
  },
  scaffolding: {
    height: '10 feet requires fall protection',
    requirements: ['foundation', 'plumb', 'braced', 'capacity 4x load'],
    inspection: 'Daily by competent person'
  },
  trenching: {
    depth: '5 feet requires protective systems',
    systems: ['sloping', 'shielding', 'shoring'],
    inspection: 'Daily and after rain'
  },
  respiratory: {
    hazards: ['silica', 'asbestos', 'lead', ' fumes'],
    requirements: ['assessment', 'protection', 'training'],
    types: ['N95', 'P100', 'air-purifying', 'supplied-air']
  },
  electrical: {
    approachDistances: {
      '0-50kV': '10 feet',
      '50kV-200kV': '15 feet',
      '200kV-350kV': '20 feet',
      '350kV-500kV': '25 feet'
    },
    lockout: 'Required before servicing'
  },
  hazmat: {
    labels: ['GHS', 'SDS required'],
    training: 'Annual refresh',
    storage: 'Segregated, ventilated, bounded'
  }
};

const SAFETY_EQUIPMENT = {
  required: [
    'Hard hats',
    'Safety glasses',
    'High-visibility vests',
    'Steel-toed boots',
    'Hearing protection (where required)'
  ],
  taskSpecific: {
    welding: ['face shield', 'welding helmet', 'leather gloves', 'flame-resistant clothing'],
    grinding: ['face shield', 'hearing protection', 'dust collection'],
    chemical: ['chemical gloves', 'goggles', 'face shield', 'respirator'],
    heights: ['fall arrest harness', 'lanyard', 'anchor point'],
    trenching: ['hard hat', 'safety boots', 'high-vis visibility']
  }
};

const INCIDENT_RESPONSE = {
  steps: [
    'Stop work immediately',
    'Secure the scene',
    'Call for help (911 if emergency)',
    'Do not move injured unless in immediate danger',
    'Document the scene with photos',
    'Report to supervisor',
    'Complete incident report within 24 hours'
  ],
  documentation: [
    'Date, time, location',
    'Weather conditions',
    'Workers involved',
    'What was happening',
    'How the incident occurred',
    'Immediate actions taken',
    'Witness information'
  ]
};

function checkFallHazards(siteData) {
  const hazards = [];
  const recommendations = [];

  if (siteData.workingHeight > 4) {
    hazards.push({
      type: 'fall',
      level: 'high',
      description: `Working at height of ${siteData.workingHeight} feet without fall protection`,
      regulation: 'OSHA 1926.500'
    });
    recommendations.push('Install guardrails or safety nets');
    recommendations.push('Require personal fall arrest systems');
    recommendations.push('Train workers on fall hazards');
  }

  if (siteData.openEdges && siteData.openEdges.length > 0) {
    hazards.push({
      type: 'fall',
      level: 'high',
      description: `${siteData.openEdges.length} open edges without protection`,
      regulation: 'OSHA 1926.500'
    });
    recommendations.push('Cover or guard all floor openings');
  }

  if (siteData.scaffolding && !siteData.scaffolding.insured) {
    hazards.push({
      type: 'scaffolding',
      level: 'medium',
      description: 'Scaffolding not inspected by competent person',
      regulation: 'OSHA 1926.451'
    });
    recommendations.push('Daily scaffolding inspection required');
  }

  return {
    hazards,
    recommendations,
    compliant: hazards.length === 0,
    checkedAt: new Date().toISOString()
  };
}

function checkTrenchingHazards(trenchData) {
  const hazards = [];

  if (trenchData.depth > 5) {
    if (!trenchData.protectiveSystem) {
      hazards.push({
        type: 'trenching',
        level: 'critical',
        description: `Trench ${trenchData.depth} feet deep without protective system`,
        regulation: 'OSHA 1926.652',
        action: 'STOP WORK - Install protective system immediately'
      });
    }

    if (!trenchData.inspected) {
      hazards.push({
        type: 'trenching',
        level: 'high',
        description: 'Trench not inspected today',
        regulation: 'OSHA 1926.651'
      });
    }
  }

  if (trenchData.waterAccumulation) {
    hazards.push({
      type: 'trenching',
      level: 'high',
      description: 'Water accumulation in trench - electrical and drowning hazard',
      regulation: 'OSHA 1926.651'
    });
  }

  return {
    hazards,
    status: hazards.length === 0 ? 'safe' : 'hazardous',
    requirements: trenchData.depth > 5 ? OSHA_STANDARDS.trenching : null,
    checkedAt: new Date().toISOString()
  };
}

function checkElectricalHazards(electricalData) {
  const hazards = [];

  if (electricalData.exposedParts) {
    hazards.push({
      type: 'electrical',
      level: 'critical',
      description: 'Exposed electrical parts - shock and arc flash hazard',
      regulation: 'OSHA 1910.333',
      action: 'De-energize and lockout before work'
    });
  }

  if (electricalData.workingNearLines) {
    const distance = electricalData.lineVoltage;
    let required = '10 feet';
    if (distance > 50000) required = '25 feet';
    else if (distance > 200000) required = '35 feet';

    hazards.push({
      type: 'electrical',
      level: 'critical',
      description: `Working within ${required} of energized lines`,
      regulation: 'OSHA 1926.950',
      action: 'Contact utility - de-energize or insulate lines'
    });
  }

  if (!electricalData.gfcis) {
    hazards.push({
      type: 'electrical',
      level: 'medium',
      description: 'GFCIs not in use for temporary power',
      regulation: 'OSHA 1926.405'
    });
  }

  return {
    hazards,
    safe: hazards.length === 0,
    equipment: SAFETY_EQUIPMENT.taskSpecific.heights,
    checkedAt: new Date().toISOString()
  };
}

function generateSafetyChecklist(projectType, activities) {
  const checklist = {
    general: [...SAFETY_EQUIPMENT.required],
    specific: []
  };

  for (const activity of activities) {
    if (SAFETY_EQUIPMENT.taskSpecific[activity]) {
      checklist.specific.push(...SAFETY_EQUIPMENT.taskSpecific[activity]);
    }
  }

  if (projectType === 'construction') {
    checklist.general.push('Site-specific safety plan');
    checklist.general.push('Emergency contact numbers posted');
    checklist.general.push('First aid kit accessible');
    checklist.general.push('Fire extinguisher within 100 feet');
  }

  return {
    checklist: [...new Set([...checklist.general, ...checklist.specific])],
    projectType,
    activities,
    generatedAt: new Date().toISOString()
  };
}

function analyzeIncident(incidentData) {
  const rootCauses = [];
  const contributingFactors = [];

  if (incidentData.noProcedure) {
    rootCauses.push('No written procedure for task');
  }

  if (incidentData.noTraining) {
    rootCauses.push('Worker not trained for task');
  }

  if (incidentData.noPPE) {
    rootCauses.push('Required PPE not provided or used');
  }

  if (incidentData.timePressure) {
    contributingFactors.push('Time pressure may have caused shortcuts');
  }

  if (incidentData.poorCommunication) {
    contributingFactors.push('Communication breakdown');
  }

  return {
    summary: {
      date: incidentData.date,
      type: incidentData.type,
      severity: incidentData.severity
    },
    rootCauses,
    contributingFactors,
    correctiveActions: [
      'Review and update procedure',
      'Retrain involved workers',
      'Verify PPE compliance',
      'Monitor for similar incidents'
    ],
    incidentResponse: INCIDENT_RESPONSE,
    analyzedAt: new Date().toISOString()
  };
}

module.exports = {
  OSHA_STANDARDS,
  SAFETY_EQUIPMENT,
  INCIDENT_RESPONSE,
  checkFallHazards,
  checkTrenchingHazards,
  checkElectricalHazards,
  generateSafetyChecklist,
  analyzeIncident
};
