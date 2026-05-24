export type PermitType = 'hot_work' | 'confined_space' | 'excavation' | 'working_at_height' | 'electrical' | 'general';

export function buildPermitPayload(input: {
  companyId: number;
  projectId: number;
  title: string;
  type: PermitType;
  location?: string;
  issuedBy: string;
  issuedTo?: string;
  validHours: number;
  conditions?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}) {
  const validFrom = new Date();
  const validTo = new Date(validFrom.getTime() + input.validHours * 60 * 60 * 1000);
  return {
    companyId: input.companyId,
    projectId: input.projectId,
    title: input.title.trim(),
    type: input.type,
    location: input.location?.trim() || undefined,
    issuedBy: input.issuedBy,
    issuedTo: input.issuedTo?.trim() || undefined,
    validFrom: validFrom.toISOString(),
    validTo: validTo.toISOString(),
    conditions: input.conditions?.trim() || undefined,
    riskLevel: input.riskLevel ?? (input.type === 'hot_work' || input.type === 'confined_space' ? 'high' as const : 'medium' as const),
  };
}
