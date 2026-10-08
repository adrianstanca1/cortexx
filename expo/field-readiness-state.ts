/** Site-readiness clearance may only be shown after ALL required live feeds succeed. */
export type ReadinessState = 'unverified' | 'blocked' | 'clear';
export function readinessState(input: { projectId: string | null; feedsComplete: boolean; blockerCount: number }): ReadinessState {
  if (!input.projectId || !input.feedsComplete) return 'unverified';
  return input.blockerCount > 0 ? 'blocked' : 'clear';
}
