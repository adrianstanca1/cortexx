/**
 * Cost Estimation Agent
 * Provides cost estimation for construction projects
 */

const UNIT_COSTS = {
  concrete: {
    '4-inch slab': 4.50,
    '6-inch slab': 6.50,
    'footings': 8.00,
    'foundation walls': 12.00
  },
  framing: {
    '2x4 wall': 3.25,
    '2x6 wall': 4.50,
    'floor joists 16" oc': 4.00,
    'roof trusses': 5.50
  },
  roofing: {
    'asphalt shingles': 3.50,
    'metal roofing': 12.00,
    'single ply membrane': 8.00,
    'built-up': 6.50
  },
  electrical: {
    'rough-in': 8.00,
    'trim': 6.00,
    'service upgrade': 2500,
    'panel': 1200
  },
  plumbing: {
    'rough-in': 10.00,
    'fixture installation': 250,
    'water heater': 1500,
    'sewer line': 45
  },
  hvac: {
    'central AC': 4000,
    'furnace': 3000,
    'ductwork': 15,
    'thermostat': 200
  }
};

const LABOR_RATES = {
  general: 45,
  electrician: 75,
  plumber: 70,
  hvac: 72,
  carpenter: 55,
  mason: 60,
  roofer: 55,
  painter: 45,
  laborer: 30
};

const OVERHEAD_MARKUP = 0.15;
const PROFIT_MARKUP = 0.10;
const CONTINGENCY = 0.10;

function estimateProject(projectData) {
  const lineItems = [];
  let subtotal = 0;

  for (const item of projectData.items) {
    const unitCost = getUnitCost(item.category, item.type);
    const quantity = item.quantity;
    const materialCost = unitCost * quantity;
    const laborRate = LABOR_RATES[item.laborType] || LABOR_RATES.general;
    const laborHours = estimateLaborHours(item.category, item.type, quantity);
    const laborCost = laborRate * laborHours;

    const itemTotal = materialCost + laborCost;

    lineItems.push({
      description: `${item.type} - ${item.quantity} ${item.unit}`,
      category: item.category,
      materialCost: Math.round(materialCost * 100) / 100,
      laborCost: Math.round(laborCost * 100) / 100,
      laborHours: Math.round(laborHours * 10) / 10,
      total: Math.round(itemTotal * 100) / 100
    });

    subtotal += itemTotal;
  }

  const overhead = subtotal * OVERHEAD_MARKUP;
  const contingency = (subtotal + overhead) * CONTINGENCY;
  const subtotalWithOverhead = subtotal + overhead;
  const profit = subtotalWithOverhead * PROFIT_MARKUP;
  const grandTotal = subtotalWithOverhead + profit + contingency;

  return {
    lineItems,
    summary: {
      subtotal: Math.round(subtotal * 100) / 100,
      overhead: `${OVERHEAD_MARKUP * 100}%`,
      overheadAmount: Math.round(overhead * 100) / 100,
      contingency: `${CONTINGENCY * 100}%`,
      contingencyAmount: Math.round(contingency * 100) / 100,
      profit: `${PROFIT_MARKUP * 100}%`,
      profitAmount: Math.round(profit * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100
    },
    projectType: projectData.type,
    location: projectData.location,
    generatedAt: new Date().toISOString()
  };
}

function getUnitCost(category, type) {
  if (UNIT_COSTS[category] && UNIT_COSTS[category][type]) {
    return UNIT_COSTS[category][type];
  }
  return 0;
}

function estimateLaborHours(category, type, quantity) {
  const baseHours = {
    concrete: { per: 'sqft', multiplier: 0.05 },
    framing: { per: 'sqft', multiplier: 0.08 },
    roofing: { per: 'sqft', multiplier: 0.06 },
    electrical: { per: 'sqft', multiplier: 0.04 },
    plumbing: { per: 'sqft', multiplier: 0.05 },
    hvac: { per: 'sqft', multiplier: 0.04 }
  };

  const base = baseHours[category];
  if (base) {
    return quantity * base.multiplier;
  }

  return quantity * 0.1;
}

function generateCostBreakdown(projectType, squareFootage) {
  const costPerSqFt = getCostPerSqFt(projectType);
  const baseCost = squareFootage * costPerSqFt;

  const breakdown = {
    siteWork: { amount: 0, percent: 0, items: [] },
    structure: { amount: 0, percent: 0, items: [] },
    exterior: { amount: 0, percent: 0, items: [] },
    interiors: { amount: 0, percent: 0, items: [] },
    mechanical: { amount: 0, percent: 0, items: [] },
    electrical: { amount: 0, percent: 0, items: [] },
    general: { amount: 0, percent: 0, items: [] }
  };

  breakdown.siteWork = {
    amount: baseCost * 0.08,
    percent: 8,
    items: ['Grading', 'Excavation', 'Utilities', 'Driveway']
  };
  breakdown.structure = {
    amount: baseCost * 0.25,
    percent: 25,
    items: ['Foundation', 'Framing', 'Roof Structure']
  };
  breakdown.exterior = {
    amount: baseCost * 0.15,
    percent: 15,
    items: ['Roofing', 'Siding', 'Windows', 'Doors']
  };
  breakdown.interiors = {
    amount: baseCost * 0.20,
    percent: 20,
    items: ['Drywall', 'Insulation', 'Flooring', 'Paint']
  };
  breakdown.mechanical = {
    amount: baseCost * 0.12,
    percent: 12,
    items: ['HVAC', 'Plumbing Fixtures', 'Water Heater']
  };
  breakdown.electrical = {
    amount: baseCost * 0.08,
    percent: 8,
    items: ['Service', 'Wiring', 'Lighting', 'Panel']
  };
  breakdown.general = {
    amount: baseCost * 0.12,
    percent: 12,
    items: ['General Labor', 'Equipment', 'Permits', 'Cleanup']
  };

  const total = Object.values(breakdown).reduce((sum, cat) => sum + cat.amount, 0);
  const overhead = total * OVERHEAD_MARKUP;
  const profit = (total + overhead) * PROFIT_MARKUP;
  const contingency = (total + overhead + profit) * CONTINGENCY;
  const grandTotal = total + overhead + profit + contingency;

  return {
    breakdown,
    summary: {
      baseCostPerSqFt: costPerSqFt,
      squareFootage,
      baseCost: Math.round(baseCost),
      overhead: Math.round(overhead),
      profit: Math.round(profit),
      contingency: Math.round(contingency),
      grandTotal: Math.round(grandTotal)
    },
    generatedAt: new Date().toISOString()
  };
}

function getCostPerSqFt(projectType) {
  const costs = {
    'residential basic': 150,
    'residential standard': 200,
    'residential premium': 300,
    'commercial basic': 175,
    'commercial standard': 250,
    'commercial premium': 400,
    'industrial': 200,
    'infrastructure': 150
  };
  return costs[projectType.toLowerCase()] || 175;
}

function compareAlternatives(alternatives) {
  const comparisons = alternatives.map(alt => {
    const estimate = estimateProject({
      type: alt.type,
      location: alt.location,
      items: alt.items
    });

    return {
      name: alt.name,
      description: alt.description,
      cost: estimate.summary.grandTotal,
      costPerSqFt: alt.squareFootage ? Math.round(estimate.summary.grandTotal / alt.squareFootage) : null,
      advantages: alt.advantages || [],
      disadvantages: alt.disadvantages || [],
      recommendation: null
    };
  });

  const sorted = [...comparisons].sort((a, b) => a.cost - b.cost);

  if (sorted.length > 0) {
    sorted[0].recommendation = 'lowest_cost';
    if (sorted[0].cost < sorted[sorted.length - 1].cost * 0.8) {
      sorted[0].recommendation = 'best_value';
    }
  }

  return {
    alternatives: sorted,
    recommendation: sorted.length > 0 ? sorted[0].name : null,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  UNIT_COSTS,
  LABOR_RATES,
  OVERHEAD_MARKUP,
  PROFIT_MARKUP,
  CONTINGENCY,
  estimateProject,
  getUnitCost,
  estimateLaborHours,
  generateCostBreakdown,
  getCostPerSqFt,
  compareAlternatives
};
