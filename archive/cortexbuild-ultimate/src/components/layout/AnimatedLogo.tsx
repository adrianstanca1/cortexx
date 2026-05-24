/**
 * CortexBuild Ultimate — Animated Self-Drawing Logo
 * SVG logo that draws itself on mount using stroke animations
 */
import { useEffect, useRef } from 'react';

interface AnimatedLogoProps {
  size?: number;
  showText?: boolean;
}

export function AnimatedLogo({ size = 34, showText = true }: AnimatedLogoProps) {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const paths = pathRef.current?.querySelectorAll('path, line, circle, rect');
    if (!paths) return;
    paths.forEach((p, i) => {
      const el = p as SVGPathElement & { style?: React.CSSProperties };
      const len = (el.getTotalLength ? el.getTotalLength() : 100);
      el.style.strokeDasharray = String(len);
      el.style.strokeDashoffset = String(len);
      el.style.animation = `logoDraw 0.8s ease ${i * 0.08}s forwards`;
    });
  }, []);

  const s = size;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {/* Animated SVG mark */}
      <div
        style={{
          width: `${s}px`,
          height: `${s}px`,
          borderRadius: '9px',
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 12px rgba(245,158,11,0.4), 0 0 0 1px rgba(245,158,11,0.2)',
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {/* Glow pulse behind */}
        <div style={{
          position: 'absolute',
          inset: '-3px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.5), transparent)',
          filter: 'blur(8px)',
          animation: 'logoGlow 2s ease-in-out infinite',
        }} />

        {/* Blueprint grid micro-bg */}
        <svg
          width={s}
          height={s}
          viewBox={`0 0 ${s} ${s}`}
          style={{ position: 'absolute', inset: 0, opacity: 0.08 }}
        >
          <defs>
            <pattern id={`grid-${s}`} width="4" height="4" patternUnits="userSpaceOnUse">
              <path d={`M ${s} 0 L 0 0 0 ${s}`} fill="none" stroke="#080b12" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width={s} height={s} fill={`url(#grid-${s})`} />
        </svg>

        {/* Animated logo SVG */}
        <svg
          
          width={s - 8}
          height={s - 8}
          viewBox={`0 0 ${s - 8} ${s - 8}`}
          fill="none"
          style={{ position: 'relative', zIndex: 1 }}
        >
          <style>{`
            @keyframes logoDraw {
              to { stroke-dashoffset: 0; }
            }
            @keyframes logoGlow {
              0%, 100% { opacity: 0.6; transform: scale(1); }
              50% { opacity: 1; transform: scale(1.05); }
            }
          `}</style>

          {/* Hard hat dome */}
          <path
            d={`M ${(s-8)*0.2} ${(s-8)*0.58} Q ${(s-8)*0.2} ${(s-8)*0.3} ${(s-8)*0.5} ${(s-8)*0.3} Q ${(s-8)*0.8} ${(s-8)*0.3} ${(s-8)*0.8} ${(s-8)*0.58}`}
            stroke="#1e1b16"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="rgba(30,27,22,0.3)"
          />
          {/* Hard hat brim */}
          <path
            d={`M ${(s-8)*0.12} ${(s-8)*0.6} L ${(s-8)*0.88} ${(s-8)*0.6}`}
            stroke="#1e1b16"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          {/* Hard hat ridge */}
          <path
            d={`M ${(s-8)*0.35} ${(s-8)*0.3} L ${(s-8)*0.35} ${(s-8)*0.58}`}
            stroke="#1e1b16"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d={`M ${(s-8)*0.65} ${(s-8)*0.3} L ${(s-8)*0.65} ${(s-8)*0.58}`}
            stroke="#1e1b16"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Building crane arm */}
          <path
            d={`M ${(s-8)*0.5} ${(s-8)*0.18} L ${(s-8)*0.82} ${(s-8)*0.18}`}
            stroke="#1e1b16"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Crane vertical */}
          <path
            d={`M ${(s-8)*0.5} ${(s-8)*0.18} L ${(s-8)*0.5} ${(s-8)*0.5}`}
            stroke="#1e1b16"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Crane hook line */}
          <path
            d={`M ${(s-8)*0.5} ${(s-8)*0.18} L ${(s-8)*0.5} ${(s-8)*0.08}`}
            stroke="#1e1b16"
            strokeWidth="1"
            strokeLinecap="round"
          />
          {/* Hook */}
          <circle
            cx={(s-8)*0.5}
            cy={(s-8)*0.07}
            r="1.2"
            stroke="#1e1b16"
            strokeWidth="1"
            fill="none"
          />
          {/* Corner brackets — top left */}
          <path d={`M 2 ${(s-8)*0.22} L 2 2 L ${(s-8)*0.22} 2`} stroke="#1e1b16" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.6" />
          {/* Corner brackets — bottom right */}
          <path d={`M ${(s-8)*0.78} ${s-10} L ${s-10} ${s-10} L ${s-10} ${(s-8)*0.78}`} stroke="#1e1b16" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.6" />
        </svg>
      </div>

      {/* Wordmark */}
      {showText && (
        <div>
          <div
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: '15px',
              fontWeight: 800,
              color: '#f1f5f9',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            CortexBuild
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '8px',
              color: '#f59e0b',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginTop: '3px',
            }}
          >
            ULTIMATE
          </div>
        </div>
      )}
    </div>
  );
}
