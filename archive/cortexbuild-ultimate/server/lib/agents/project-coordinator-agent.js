/**
 * Project Coordinator Agent
 * Provides project coordination, scheduling, and resource management insights
 */

const PROJECT_PHASES = {
  'pre-construction': {
    activities: ['site survey', 'permits', 'design', 'procurement'],
    typicalDuration: { min: 30, max: 90, unit: 'days' },
    criticalPath: true
  },
  'foundation': {
    activities: ['excavation', 'footings', 'foundation walls', 'backfill'],
    typicalDuration: { min: 7, max: 21, unit: 'days' },
    criticalPath: true
  },
  'structural': {
    activities: ['framing', 'roofing', 'sheathing'],
    typicalDuration: { min: 14, max: 45, unit: 'days' },
    criticalPath: true
  },
  'mechanical': {
    activities: ['plumbing rough-in', 'electrical rough-in', 'hvac rough-in'],
    typicalDuration: { min: 14, max: 30, unit: 'days' },
    criticalPath: false
  },
  'interior': {
    activities: ['insulation', 'drywall', 'paint', 'flooring', 'trim'],
    typicalDuration: { min: 21, max: 60, unit: 'days' },
    criticalPath: false
  },
  'final': {
    activities: ['fixtures', 'landscaping', 'final inspection', 'punch list'],
    typicalDuration: { min: 7, max: 21, unit: 'days' },
    criticalPath: true
  }
};

const RESOURCE_ALLOCATION = {
  typicalCrewSizes: {
    'general labor': { min: 2, max: 6 },
    'carpenters': { min: 2, max: 4 },
    'electricians': { min: 1, max: 3 },
    'plumbers': { min: 1, max: 3 },
    'hvac': { min: 1, max: 2 },
    'masons': { min: 2, max: 4 }
  },
  equipmentPer1000SqFt: {
    'scaffolding': 1,
    'forklift': 0.5,
    ' Excavator': 0.3,
    'concrete mixer': 0.2
  }
};

function analyzeProjectHealth(projectData) {
  const health = {
    schedule: analyzeScheduleHealth(projectData),
    budget: analyzeBudgetHealth(projectData),
    resources: analyzeResourceHealth(projectData),
    safety: analyzeSafetyHealth(projectData),
    overall: 'healthy'
  };

  const issues = [];

  if (health.schedule.status === 'behind') issues.push({ severity: health.schedule.delay > 7 ? 'critical' : 'warning', message: `Schedule ${health.schedule.delay} days behind` });
  if (health.budget.status === 'over') issues.push({ severity: health.budget.overrun > 5 ? 'critical' : 'warning', message: `Budget ${health.budget.overrun}% over` });
  if (health.resources.status === 'constrained') issues.push({ severity: 'warning', message: 'Resource constraints detected' });
  if (health.safety.status === 'concerning') issues.push({ severity: 'critical', message: 'Safety incidents above threshold' });

  if (issues.some(i => i.severity === 'critical')) health.overall = 'critical';
  else if (issues.length > 0) health.overall = 'issues';

  return { health, issues };
}

function analyzeScheduleHealth(project) {
  const planned = project.plannedEndDate;
  const current = new Date();
  const elapsed = project.startDate;
  const totalDuration = planned - elapsed;
  const elapsedDuration = current - elapsed;
  const progressPercent = Math.min(100, Math.max(0, (elapsedDuration / totalDuration) * 100));

  const plannedProgress = project.plannedProgress || progressPercent;
  const delay = Math.max(0, Math.round(plannedProgress - progressPercent));

  return {
    status: delay > 14 ? 'behind' : delay > 0 ? 'slightly_behind' : 'on_track',
    delay,
    progressPercent: Math.round(progressPercent),
    plannedProgress: Math.round(plannedProgress),
    criticalPathItems: project.criticalPath || []
  };
}

function analyzeBudgetHealth(project) {
  const spent = project.spent || 0;
  const budget = project.budget || 1;
  const spentPercent = (spent / budget) * 100;
  const progressPercent = project.progress || 0;

  const expectedSpend = (budget * progressPercent) / 100;
  const variance = spent - expectedSpend;
  const variancePercent = variance > 0 ? (variance / budget) * 100 : 0;
  const overrun = spentPercent - progressPercent;

  return {
    status: overrun > 10 ? 'over' : overrun > 5 ? 'watch' : 'on_budget',
    spentPercent: Math.round(spentPercent * 100) / 100,
    variance: Math.round(variance),
    variancePercent: Math.round(variancePercent * 100) / 100,
    overrun: Math.round(overrun * 100) / 100,
    forecast: Math.round(budget * (1 + (overrun / 100)))
  };
}

function analyzeResourceHealth(project) {
  const issues = [];
  const utilization = project.resourceUtilization || {};

  for (const [resource, usage] of Object.entries(utilization)) {
    if (usage > 100) {
      issues.push({ resource, usage, severity: 'overallocated' });
    } else if (usage > 85) {
      issues.push({ resource, usage, severity: 'high' });
    }
  }

  return {
    status: issues.some(i => i.severity === 'overallocated') ? 'constrained' : issues.length > 0 ? 'watch' : 'adequate',
    issues,
    laborEfficiency: project.laborEfficiency || 100
  };
}

function analyzeSafetyHealth(project) {
  const incidents = project.incidents || 0;
  const nearMisses = project.nearMisses || 0;
  const daysSinceIncident = project.daysSinceIncident || 365;
  constTRIR = project.TRIS || 0;

  let status = 'good';
  if (TRIR > 5 || incidents > 3) status = 'concerning';
  if (TRIR > 10 || incidents > 5) status = 'poor';

  return {
    status,
    incidents,
    nearMisses,
    daysSinceIncident,
    recordableRate: TRIR,
    recommendations: generateSafetyRecommendations(status)
  };
}

function generateSafetyRecommendations(status) {
  if (status === 'poor') {
    return [
      'STOP WORK - Conduct comprehensive safety review',
      'Retrain all workers on site-specific hazards',
      'Implement daily safety huddles',
      'Increase supervision on all tasks'
    ];
  }
  if (status === 'concerning') {
    return [
      'Review recent incidents and near-misses',
      'Conduct additional safety training',
      'Increase safety inspections',
      'Review and update hazard assessments'
    ];
  }
  return [
    'Continue regular safety meetings',
    'Maintain daily equipment inspections',
    'Promote near-miss reporting culture'
  ];
}

function generateProjectSchedule(projectData) {
  const phases = projectData.phases || Object.keys(PROJECT_PHASES);
  const schedule = [];

  let currentDate = new Date(projectData.startDate);

  for (const phase of phases) {
    const phaseData = PROJECT_PHASES[phase];
    if (!phaseData) continue;

    const duration = phaseData.typicalDuration;
    const phaseDuration = Math.round(duration.min + (duration.max - duration.min) * (projectData.complexity || 0.5));

    schedule.push({
      phase,
      activities: phaseData.activities,
      startDate: new Date(currentDate),
      endDate: new Date(currentDate.getTime() + phaseDuration * 24 * 60 * 60 * 1000),
      duration: phaseDuration,
      durationUnit: duration.unit,
      criticalPath: phaseData.criticalPath,
      dependencies: getPhaseDependencies(phase)
    });

    currentDate = new Date(currentDate.getTime() + phaseDuration * 24 * 60 * 60 * 1000);
  }

  return {
    schedule,
    totalDuration: schedule.reduce((sum, p) => sum + p.duration, 0),
    estimatedCompletion: currentDate,
    criticalPath: schedule.filter(p => p.criticalPath).map(p => p.phase),
    generatedAt: new Date().toISOString()
  };
}

function getPhaseDependencies(phase) {
  const dependencies = {
    'foundation': ['pre-construction'],
    'structural': ['foundation'],
    'mechanical': ['structural'],
    'interior': ['mechanical'],
    'final': ['interior']
  };
  return dependencies[phase] || [];
}

function generateResourcePlan(projectData) {
  const sqft = projectData.squareFootage || 1000;
  const crewSize = projectData.crewSize || 4;
  const duration = projectData.duration || 90;

  const plan = {
    labor: {
      totalManHours: crewSize * 8 * duration,
      byTrade: calculateLaborByTrade(sqft, duration),
      cost: calculateLaborCost(crewSize, duration)
    },
    equipment: {
      items: calculateEquipment(sqft),
      cost: 0
    },
    materials: {
      items: calculateMaterials(sqft),
      cost: 0
    }
  };

  plan.equipment.cost = plan.equipment.items.reduce((sum, item) => sum + (item.rentalCost * duration), 0);
  plan.materials.cost = plan.materials.items.reduce((sum, item) => sum + item.cost, 0);

  return {
    ...plan,
    totalCost: plan.labor.cost + plan.equipment.cost + plan.materials.cost,
    generatedAt: new Date().toISOString()
  };
}

function calculateLaborByTrade(sqft, duration) {
  const baseManHours = sqft * 0.5;
  return {
    carpenters: { hours: baseManHours * 0.3, rate: 55 },
    laborers: { hours: baseManHours * 0.25, rate: 30 },
    electricians: { hours: baseManHours * 0.15, rate: 75 },
    plumbers: { hours: baseManHours * 0.15, rate: 70 },
    hvac: { hours: baseManHours * 0.10, rate: 72 },
    other: { hours: baseManHours * 0.05, rate: 45 }
  };
}

function calculateLaborCost(crewSize, duration) {
  const avgRate = 50;
  return crewSize * 8 * duration * avgRate;
}

function calculateEquipment(sqft) {
  const items = [];
  if (sqft > 500) items.push({ name: 'Scaffolding', dailyRate: 150, quantity: Math.ceil(sqft / 1000) });
  if (sqft > 1000) items.push({ name: 'Forklift', dailyRate: 200, quantity: 1 });
  if (sqft > 2000) items.push({ name: 'Excavator', dailyRate: 350, quantity: 1 });
  items.push({ name: 'Concrete Mixer', dailyRate: 75, quantity: 1 });
  return items.map(item => ({ ...item, rentalCost: item.dailyRate * item.quantity }));
}

function calculateMaterials(sqft) {
  return [
    { name: 'Concrete', cost: sqft * 4 },
    { name: 'Framing Lumber', cost: sqft * 8 },
    { name: 'Roofing', cost: sqft * 3.5 },
    { name: 'Drywall', cost: sqft * 2 },
    { name: 'Electrical', cost: sqft * 4 },
    { name: 'Plumbing', cost: sqft * 5 }
  ];
}

function identifyBottlenecks(projectData) {
  const bottlenecks = [];

  if (projectData.subcontractorDelays > 0) {
    bottlenecks.push({
      type: 'subcontractor',
      severity: 'high',
      description: `${projectData.subcontractorDelays} delayed subcontractor dependencies`,
      mitigation: 'Early coordination meetings, backup subcontractors identified'
    });
  }

  if (projectData.materialShortages && projectData.materialShortages.length > 0) {
    bottlenecks.push({
      type: 'materials',
      severity: 'medium',
      description: `Shortages: ${projectData.materialShortages.join(', ')}`,
      mitigation: 'Early procurement, alternative suppliers'
    });
  }

  if (projectData.weatherDays && projectData.weatherDays > 5) {
    bottlenecks.push({
      type: 'weather',
      severity: 'medium',
      description: `${projectData.weatherDays} weather delay days`,
      mitigation: 'Weather-resistant scheduling, indoor work prioritization'
    });
  }

  if (projectData.permitDelays) {
    bottlenecks.push({
      type: 'permits',
      severity: 'high',
      description: 'Permit approval delays',
      mitigation: 'Pre-application meetings, expedited review requests'
    });
  }

  return {
    bottlenecks,
    riskLevel: bottlenecks.filter(b => b.severity === 'high').length > 0 ? 'high' : 'medium',
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  PROJECT_PHASES,
  RESOURCE_ALLOCATION,
  analyzeProjectHealth,
  analyzeScheduleHealth,
  analyzeBudgetHealth,
  analyzeResourceHealth,
  analyzeSafetyHealth,
  generateProjectSchedule,
  generateResourcePlan,
  identifyBottlenecks
};
