/**
 * Defects Agent
 * Handles defect/snag identification, punch list management, defect resolution workflows
 */

const DEFECT_CATEGORIES = {
  structural: {
    priority: 'critical',
    examples: ['cracks in load-bearing walls', 'foundation settlement', 'reinforcement exposure'],
    resolutionDays: 7
  },
  waterproofing: {
    priority: 'high',
    examples: ['roof leaks', 'basement seepage', 'external door seals', 'window weatherproofing'],
    resolutionDays: 14
  },
  safety: {
    priority: 'critical',
    examples: ['missing handrails', 'unprotected edges', 'electrical hazards', 'fire exit blocked'],
    resolutionDays: 1
  },
  finishes: {
    priority: 'medium',
    examples: ['paint defects', 'tile cracking', 'scuff marks', 'uneven plaster', 'damaged fixtures'],
    resolutionDays: 30
  },
  mechanical: {
    priority: 'high',
    examples: ['HVAC performance', 'plumbing leaks', 'electrical faults', 'ventilation issues'],
    resolutionDays: 14
  },
  snagging: {
    priority: 'low',
    examples: ['minor scratches', 'missing sealant', 'loose fixtures', 'cosmetic damage'],
    resolutionDays: 60
  }
};

const PRIORITY_SCORING = {
  critical: { score: 10, responseHours: 4, escalationRequired: true },
  high: { score: 7, responseHours: 24, escalationRequired: false },
  medium: { score: 4, responseHours: 72, escalationRequired: false },
  low: { score: 1, responseHours: 168, escalationRequired: false }
};

const DEFECT_STATUSES = ['open', 'in_progress', 'pending_inspection', 'resolved', 'closed', 'overdue'];

function categorizeDefect(description) {
  const lower = (description || '').toLowerCase();
  for (const [category, config] of Object.entries(DEFECT_CATEGORIES)) {
    const match = config.examples.some(e => lower.includes(e));
    if (match) return category;
  }
  return 'snagging';
}

function scorePriority(category, daysOpen, hasPhoto) {
  const base = PRIORITY_SCORING[DEFECT_CATEGORIES[category]?.priority || 'low'].score;
  const ageBonus = Math.min(daysOpen * 0.5, 10);
  const photoBonus = hasPhoto ? 2 : 0;
  return Math.min(base + ageBonus + photoBonus, 15);
}

function allocateResponsibility(category, location, subcontractors) {
  const tradeMap = {
    structural: 'groundworks',
    waterproofing: 'roofing',
    safety: 'general',
    finishes: 'finishing',
    mechanical: 'M&E',
    snagging: 'general'
  };
  const trade = tradeMap[category] || 'general';
  const available = subcontractors.filter(s => s.trade === trade && s.status === 'active');
  return {
    recommendedTrade: trade,
    availableSubcontractors: available.map(s => s.name),
    responsibleParty: available[0]?.name || 'Unassigned'
  };
}

function formatSnagList(defects) {
  return defects.map((d, i) => {
    const cat = categorizeDefect(d.description || d.title || '');
    return {
      number: i + 1,
      reference: d.reference || d.id,
      location: d.location || 'TBC',
      description: d.description || d.title,
      category: cat,
      priority: DEFECT_CATEGORIES[cat].priority,
      status: d.status,
      assignedTo: d.assigned_to || 'Unassigned',
      dueDate: d.due_date || null
    };
  });
}

module.exports = {
  DEFECT_CATEGORIES,
  PRIORITY_SCORING,
  DEFECT_STATUSES,
  categorizeDefect,
  scorePriority,
  allocateResponsibility,
  formatSnagList
};
