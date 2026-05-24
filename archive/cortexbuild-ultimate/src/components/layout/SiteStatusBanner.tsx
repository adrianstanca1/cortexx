/**
 * CortexBuild Ultimate — Live Site Status Banner
 * Thin top-of-dashboard strip showing live site intelligence
 */
import { useState, useEffect } from 'react';
import { Eye, AlertTriangle, Users,
  ShieldCheck, Zap,
} from 'lucide-react';

function LiveDot({ color }: { color: string }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: '8px', height: '8px', marginRight: '5px' }}>
      <span style={{
        position: 'absolute', inset: '0',
        borderRadius: '50%',
        background: color,
        animation: 'livePulse 2s ease-in-out infinite',
      }} />
      <span style={{
        position: 'absolute', inset: '0',
        borderRadius: '50%',
        background: color,
        animation: 'livePulse2 2s ease-in-out infinite',
      }} />
    </span>
  );
}

// ⚡ Bolt Performance Optimization:
// Extracted high-frequency state update (setInterval clock) into a dedicated leaf component.
// This prevents the entire <SiteStatusBanner> from needlessly re-rendering every second.
function LiveClock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  return <>{time}</>;
}

export function SiteStatusBanner({ compact = false }: { compact?: boolean }) {
  const [date] = useState(() => new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const items = [
    { icon: Users,         label: 'On Site',  value: '47',         accent: '#10b981', dot: '#10b981' },
    { icon: AlertTriangle, label: 'Incidents', value: '0 active',   accent: '#10b981', dot: '#10b981' },
    { icon: ShieldCheck,   label: 'H&S',       value: '98.2%',      accent: '#10b981', dot: '#10b981' },
    { icon: Eye,           label: 'CCTV',      value: 'All online', accent: '#10b981', dot: '#10b981' },
    { icon: Zap,           label: 'Power',     value: 'Grid',      accent: '#f59e0b', dot: '#f59e0b' },
  ];

  return (
    <div style={{
      background: 'linear-gradient(90deg, rgba(13,17,23,0.95), rgba(13,17,23,0.9))',
      borderBottom: '1px solid rgba(245,158,11,0.15)',
      borderTop: '1px solid rgba(245,158,11,0.08)',
      padding: compact ? '5px 16px' : '6px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '0',
      overflowX: 'auto',
      animation: mounted ? 'slideDown 0.4s ease forwards' : 'none',
      position: 'relative',
    }}>
      <style>{`
        @keyframes livePulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.6); opacity: 0.4; }
        }
        @keyframes livePulse2 {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes slideDown {
          from { transform: translateY(-8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Clock */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        paddingRight: '16px',
        marginRight: '16px',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '13px',
          fontWeight: 600,
          color: '#f59e0b',
          letterSpacing: '0.05em',
        }}>
          <LiveClock />
        </span>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '9px',
          color: '#475569',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          {date}
        </span>
      </div>

      {/* Status items */}
      <div className="status-items" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        flexWrap: 'wrap',
      }}>
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                animation: mounted ? `fadeIn 0.4s ease ${i * 60}ms forwards` : 'none',
                opacity: mounted ? 1 : 0,
              }}
            >
              <LiveDot color={item.dot} />
              <Icon style={{ width: '11px', height: '11px', color: item.accent }} />
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '10px',
                color: '#94a3b8',
                letterSpacing: '0.03em',
              }}>
                {item.label}
              </span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '10px',
                fontWeight: 600,
                color: item.accent,
                letterSpacing: '0.02em',
              }}>
                {item.value}
              </span>
            </div>
          );
        })}
      </div>

      {/* Project ticker — hidden on mobile */}
      <div className="status-ticker" style={{
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        paddingLeft: '16px',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '9px',
          color: '#475569',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          LIVE
        </span>
        <div style={{
          display: 'flex',
          gap: '4px',
        }}>
          {['#PROJ-001', '#PROJ-002', '#PROJ-003'].map((tag, i) => (
            <span
              key={i}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '9px',
                color: '#f59e0b',
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: '4px',
                padding: '1px 5px',
                letterSpacing: '0.03em',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
