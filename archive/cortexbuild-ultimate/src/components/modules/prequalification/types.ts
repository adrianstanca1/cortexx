export interface Subcontractor {
  id: string;
  company: string;
  trade: string;
  submissionDate: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  score: number;
  overallScore?: number;
  approvalDate?: string;
  expiryDate?: string;
  contact?: string;
  tier?: 'gold' | 'silver' | 'bronze';
  location?: string;
  insurance?: string;
}

export interface ScoringCriteria {
  name: string;
  weight: number;
}

export type TabId = 'applications' | 'assessment' | 'approved' | 'expiring' | 'reports';

export interface AppFormData {
  company: string;
  trade: string;
  contact: string;
  location: string;
  insurance: string;
}

export interface TradeCount {
  name: string;
  value: number;
}

export interface StatusCounts {
  pending: number;
  under_review: number;
  approved: number;
  rejected: number;
}

export interface Stats {
  approved: number;
  avgScore: number;
  byTrade: TradeCount[];
  statusCounts: StatusCounts;
}

export const SCORING_CRITERIA: ScoringCriteria[] = [
  { name: 'Financial Stability', weight: 20 },
  { name: 'Insurance & Compliance', weight: 15 },
  { name: 'Health & Safety Record', weight: 25 },
  { name: 'References', weight: 15 },
  { name: 'Technical Capability', weight: 15 },
  { name: 'Quality Management', weight: 10 },
];

export const TRADES = [
  'Groundworks',
  'Structural Steel',
  'Concrete Works',
  'Mechanical Installation',
  'Electrical Installation',
  'Plumbing',
  'Carpentry',
  'Roofing',
  'Scaffolding',
  'Interior Finishing',
  'Safety & PPE Supply',
];
