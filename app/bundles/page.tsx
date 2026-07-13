'use client'

import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import { BUNDLES } from '@/lib/bundles'
import {
  IcChevL,
  IcWrench,
  IcLayers,
  IcAlert,
  IcReceipt,
  IcHardhat,
  IcCheck,
  IcPin,
  IcCamera,
  IcDoc,
  IcClock,
  IcTeam,
  IcPound,
} from '@/components/ui/Icons'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  doc: IcDoc,
  wrench: IcWrench,
  check: IcCheck,
  hardhat: IcHardhat,
  pin: IcPin,
  camera: IcCamera,
  alert: IcAlert,
  layers: IcLayers,
  team: IcTeam,
  clock: IcClock,
  receipt: IcReceipt,
  pound: IcPound,
}

const SF = 'var(--font-system)'

export default function BundlesPage() {
  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: SF, fontSize: 13, color: '#52749a' }}>Apps</span>
        </Link>
        <div style={{ marginBottom: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Role packs</h1>
          <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>Curated tools + a dedicated AI agent for every role</p>
        </div>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {BUNDLES.map(b => {
          const pages = b.pages.slice(0, 5)
          return (
            <Link
              key={b.slug}
              href={`/bundles/${b.slug}`}
              style={{
                display: 'block',
                background: '#152641',
                borderRadius: 14,
                padding: '16px 14px',
                border: '0.5px solid rgba(255,255,255,0.07)',
                textDecoration: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${b.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IcLayers size={22} color={b.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SF, fontSize: 16, fontWeight: 700, color: '#eef3fa' }}>{b.title}</div>
                  <div style={{ fontFamily: SF, fontSize: 12, color: '#52749a', marginTop: 2 }}>{b.subtitle}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {pages.map(p => {
                  const Icon = ICON_MAP[p.icon] || IcDoc
                  return (
                    <span
                      key={p.href}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 8px',
                        borderRadius: 6,
                        background: 'rgba(255,255,255,0.05)',
                        color: '#8ea8c5',
                        fontFamily: SF,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      <Icon size={12} color={p.color} /> {p.label}
                    </span>
                  )
                })}
                {b.pages.length > 5 && (
                  <span style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: '#52749a', fontFamily: SF, fontSize: 11 }}>+{b.pages.length - 5} more</span>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      <TabBar />
    </div>
  )
}
