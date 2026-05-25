'use client'

/**
 * First-run guidance for a brand-new workspace.
 *
 * Renders when the dashboard data fetch comes back with zero projects,
 * zero tasks, AND zero team members — i.e. the owner just finished
 * onboarding and hasn't touched anything yet. The 16 dashboard variants
 * each render their own (possibly empty) panels behind this banner;
 * without something here, a fresh account looks broken / dead.
 *
 * Three click-targets cover the canonical first-day actions: create a
 * project, invite a teammate, explore the apps grid.
 */
import Link from 'next/link'
import { IcPlus, IcTeam, IcLayers } from '@/components/ui/Icons'
import type { DashboardData } from '@/lib/types'

interface Props {
  data: DashboardData | null
}

function isEmpty(data: DashboardData | null): boolean {
  if (!data) return false  // null = still loading; let the variants handle that
  const projects = data.projects?.length ?? 0
  const tasks = data.tasks?.length ?? 0
  const team = data.team?.length ?? 0
  return projects === 0 && tasks === 0 && team === 0
}

export default function FirstRunBanner({ data }: Props) {
  if (!isEmpty(data)) return null

  return (
    <div style={{ padding: '20px 60px 0' }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))',
        border: '0.5px solid rgba(245,158,11,0.3)',
        borderRadius: 16,
        padding: 24,
        marginBottom: 16,
        fontFamily: 'var(--font-system)',
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#eef3fa', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Welcome to Cortexx
        </h2>
        <p style={{ fontSize: 13, color: '#8ea8c5', margin: '0 0 16px' }}>
          Your workspace is empty. Three things to get going:
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link
            href="/projects"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              background: '#f59e0b',
              color: '#06101e',
              borderRadius: 10,
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <IcPlus size={14} color="#06101e" />
            Create your first project
          </Link>
          <Link
            href="/team"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              background: 'transparent',
              color: '#eef3fa',
              border: '0.5px solid rgba(255,255,255,0.15)',
              borderRadius: 10,
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <IcTeam size={14} color="#8ea8c5" />
            Invite teammates
          </Link>
          <Link
            href="/apps"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              background: 'transparent',
              color: '#eef3fa',
              border: '0.5px solid rgba(255,255,255,0.15)',
              borderRadius: 10,
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <IcLayers size={14} color="#8ea8c5" />
            Explore all apps
          </Link>
        </div>

        <p style={{ fontSize: 11, color: '#52749a', margin: '14px 0 0' }}>
          Stuck? <Link href="/help/getting-started" style={{ color: '#8ea8c5', textDecoration: 'underline' }}>Read the getting-started guide</Link>.
        </p>
      </div>
    </div>
  )
}
