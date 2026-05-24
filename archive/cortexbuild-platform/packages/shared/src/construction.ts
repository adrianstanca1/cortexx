// ═══════════════════════════════════════════════════════════════════════════════
// Construction Domain Helpers & Dictionaries
// ═══════════════════════════════════════════════════════════════════════════════

export const UK_CSCS_CARD_TYPES = [
  'Green — Labourer', 'Blue — Skilled Worker', 'Gold — Supervisor/Manager',
  'Black — Manager', 'Red — Trainee/Experienced Worker', 'White — PQP/ACAD/PSS',
  'Yellow — Visitor',
] as const;

export const CONSTRUCTION_TRADES = [
  'bricklayer','carpenter','concreter','demolition','dryliner','electrician',
  'flooring','glazier','groundworker','insulation','joiner','labourer',
  'landscaper','m&e','mason','painter','pipefitter','plasterer','plumber',
  'reinforcement','roofer','scaffolder','screed','spray','steelworker',
  'stonemason','taper','tarmac','tiler','waterproofer','welder',
] as const;

export const UK_HOLIDAYS = [
  "New Year's Day", 'Good Friday', 'Easter Monday', 'Early May Bank Holiday',
  'Spring Bank Holiday', 'Summer Bank Holiday', 'Christmas Day', 'Boxing Day',
];

export function calculateWorkingDays(start: Date, end: Date, holidays: Date[] = []) {
  let count = 0;
  const cur = new Date(start);
  const holidaySet = new Set(holidays.map(h => h.toISOString().slice(0,10)));
  while (cur <= end) {
    const dow = cur.getDay();
    const ds = cur.toISOString().slice(0,10);
    if (dow !== 0 && dow !== 6 && !holidaySet.has(ds)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function isUKWorkingDay(d: Date) {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  const ds = d.toISOString().slice(0, 10);
  return !UK_HOLIDAYS.includes(ds);
}
