import { CheckCircle, HardHat, ShieldCheck, TrendingUp, Users, Zap, type LucideIcon } from 'lucide-react';
import { BlueprintStructure } from './BlueprintStructure';

const TICKER_MODULES = [
  'PROJECTS', 'CIS RETURNS', 'RAMS', 'INVOICING', 'TIMESHEETS', 'SAFETY',
  'DRAWINGS', 'PROCUREMENT', 'TENDERS', 'PLANT & EQUIPMENT', 'SITE DIARY', 'RISK REGISTER',
];

const FEATURES: Array<{ icon: LucideIcon; text: string; delay: string }> = [
  { icon: ShieldCheck, text: 'CIS Compliance', delay: '0.45s' },
  { icon: Zap, text: 'Live Site Dashboard', delay: '0.55s' },
  { icon: Users, text: 'Team & Subcontractors', delay: '0.65s' },
  { icon: TrendingUp, text: 'Financial Reporting', delay: '0.75s' },
  { icon: CheckCircle, text: 'RAMS & Inspections', delay: '0.85s' },
];

function FeaturePill({ icon: Icon, text, delay }: { icon: LucideIcon; text: string; delay: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '7px 14px',
        background: 'rgba(245,158,11,0.07)',
        border: '1px solid rgba(245,158,11,0.15)',
        borderRadius: '100px',
        animation: `slideUp 0.6s ease ${delay} both`,
      }}
    >
      <Icon size={13} style={{ color: '#f59e0b' }} />
      <span
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '12px',
          fontWeight: 500,
          color: 'rgba(226,232,240,0.85)',
          letterSpacing: '0.01em',
        }}
      >
        {text}
      </span>
    </div>
  );
}

/**
 * Marketing-side panel rendered to the left of the auth form on desktop.
 * Hidden under 900px viewport via the .hero-panel media query in LoginStyles.
 */
export function LoginHero() {
  return (
    <div
      className="hero-panel"
      style={{
        display: 'none',
        flex: '0 0 58%',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(160deg, #090e1a 0%, #0d1117 50%, #080b12 100%)',
      }}
    >
      {/* Blueprint micro-grid */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          backgroundImage: `
            linear-gradient(rgba(59,83,120,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,83,120,0.06) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Large grid overlay */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          backgroundImage: `
            linear-gradient(rgba(59,83,120,0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,83,120,0.12) 1px, transparent 1px)
          `,
          backgroundSize: '160px 160px',
        }}
      />

      {/* Scan line */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', left: 0, right: 0, height: '2px', top: 0,
          background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.3), transparent)',
          animation: 'scanLine 7s ease-in-out 2s infinite',
          pointerEvents: 'none', zIndex: 1,
        }}
      />

      {/* Amber glow */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', top: '30%', left: '35%',
          width: '500px', height: '400px',
          background: 'radial-gradient(ellipse at center, rgba(245,158,11,0.06) 0%, transparent 65%)',
          transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 0,
        }}
      />

      {/* Blueprint SVG */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: '-30px', top: '50%',
          width: '460px', height: '520px',
          transform: 'translateY(-50%)',
          opacity: 0.6, zIndex: 1, pointerEvents: 'none',
        }}
      >
        <BlueprintStructure />
      </div>

      {/* Hero content */}
      <div
        style={{
          position: 'relative', zIndex: 2,
          padding: '0 56px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          maxWidth: '520px',
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            marginBottom: '52px',
            animation: 'slideUp 0.6s ease 0.1s both',
          }}
        >
          <div
            style={{
              width: '40px', height: '40px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
            }}
          >
            <HardHat size={20} style={{ color: '#080b12' }} />
          </div>
          <div>
            <div
              style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 800,
                fontSize: '18px',
                color: '#f1f5f9',
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              CortexBuild
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '9px',
                fontWeight: 500,
                color: '#f59e0b',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                marginTop: '3px',
              }}
            >
              ULTIMATE // v2.0
            </div>
          </div>
        </div>

        {/* Headline */}
        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 800,
              fontSize: 'clamp(2.4rem, 4vw, 3.4rem)',
              lineHeight: 1.0,
              letterSpacing: '-0.04em',
              color: '#f1f5f9',
              animation: 'slideUp 0.7s ease 0.2s both',
            }}
          >
            COMMAND<br />
            <span style={{ WebkitTextStroke: '1px rgba(245,158,11,0.6)', color: 'transparent' }}>
              YOUR SITE.
            </span>
            <br />
            DELIVER<br />
            ON TIME.
          </div>
        </div>

        {/* Subhead */}
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 400,
            fontSize: '14px',
            lineHeight: 1.7,
            color: 'rgba(138,155,181,0.9)',
            maxWidth: '380px',
            marginBottom: '32px',
            animation: 'slideUp 0.7s ease 0.35s both',
          }}
        >
          The full-stack construction management platform built for UK contractors —
          from groundworks to sign-off. Projects, CIS, RAMS, invoicing and site
          intelligence, unified.
        </p>

        {/* Feature pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '44px' }}>
          {FEATURES.map((f) => (
            <FeaturePill key={f.text} icon={f.icon} text={f.text} delay={f.delay} />
          ))}
        </div>
      </div>

      {/* Bottom ticker */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          borderTop: '1px solid rgba(30,41,59,0.6)',
          background: 'rgba(8,11,18,0.85)',
          padding: '10px 0',
          overflow: 'hidden',
          zIndex: 3,
        }}
      >
        <div className="ticker-track">
          {[0, 1].map((j) => (
            <span
              key={j}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '10px',
                color: 'rgba(90,106,130,0.6)',
                letterSpacing: '0.08em',
              }}
            >
              {TICKER_MODULES.map((m) => (
                <span key={`${j}-${m}`} style={{ marginRight: '48px' }}>
                  <span style={{ color: 'rgba(245,158,11,0.4)', marginRight: '8px' }}>◆</span>
                  {m}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default LoginHero;
