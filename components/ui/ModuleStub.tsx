'use client'

import Link from 'next/link'
import { IcArrowRight } from './Icons'

interface ModuleStubProps {
  title: string
  description: string
  Icon: React.ComponentType<{ size?: number; color?: string }>
  color: string
  features: string[]
}

/**
 * Generic "coming soon" treatment for modules that exist in nav but
 * aren't fully implemented yet. Shows the planned feature list so
 * users see what's coming.
 */
export default function ModuleStub({ title, description, Icon, color, features }: ModuleStubProps) {
  const SF = 'var(--font-system)'
  return (
    <div style={{ padding: '20px 0 100px', background: '#06101e', minHeight: '100dvh' }}>
      <div style={{ padding: '4px 20px 16px' }}>
        <Link href="/apps" style={{ fontFamily: SF, fontSize: 13, color: '#8ea8c5', textDecoration: 'none' }}>
          ← Apps
        </Link>
      </div>

      <div style={{ padding: '0 24px' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
        }}>
          <Icon size={32} color={color} />
        </div>
        <h1 style={{ fontFamily: SF, fontSize: 30, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em' }}>{title}</h1>
        <p style={{ fontFamily: SF, fontSize: 14, color: '#8ea8c5', marginTop: 6, lineHeight: 1.5 }}>{description}</p>

        <div style={{
          marginTop: 24, padding: '14px 16px',
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 12,
        }}>
          <div style={{ fontFamily: SF, fontSize: 10, fontWeight: 700, color: '#f59e0b', letterSpacing: '0.1em' }}>COMING SOON</div>
          <p style={{ fontFamily: SF, fontSize: 13, color: '#eef3fa', marginTop: 4, lineHeight: 1.4 }}>
            This module is in the roadmap. The data model and UI are being built incrementally.
          </p>
        </div>

        <div style={{ marginTop: 28 }}>
          <div style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, color: '#52749a', letterSpacing: '0.1em', marginBottom: 12 }}>
            PLANNED CAPABILITIES
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {features.map((f, i) => (
              <div
                key={f}
                style={{
                  padding: '14px 0',
                  borderBottom: i === features.length - 1 ? 'none' : '0.5px solid rgba(255,255,255,0.07)',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
              >
                <span style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 11, color,
                  fontWeight: 600, width: 18,
                }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontFamily: SF, fontSize: 14, color: '#eef3fa', flex: 1 }}>{f}</span>
                <IcArrowRight size={14} color="#52749a" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
