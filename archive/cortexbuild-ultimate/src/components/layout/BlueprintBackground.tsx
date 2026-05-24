import React, { useEffect, useRef } from 'react';

// Generate SVG data URIs for repeating grid patterns
const BASE_GRID_SIZE = 40;
const MICRO_GRID_SIZE = 8;
const ACCENT_GRID_SIZE = 200;

function makeGridSVG(size: number, color: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>
    <rect width='${size}' height='${size}' fill='none'/>
    <path d='M ${size} 0 L 0 0 0 ${size}' fill='none' stroke='${color}' stroke-width='1'/>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const baseGridBg = makeGridSVG(BASE_GRID_SIZE, 'rgba(59,83,120,0.08)');
const microGridBg = makeGridSVG(MICRO_GRID_SIZE, 'rgba(59,83,120,0.04)');
const accentGridBg = makeGridSVG(ACCENT_GRID_SIZE, 'rgba(245,158,11,0.04)');

interface CrosshairProps {
  size?: number;
}

function CornerCrosshair({ size = 60 }: CrosshairProps) {
  const color = 'rgba(245,158,11,0.5)';
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block' }}
    >
      <circle cx={size / 2} cy={size / 2} r={size / 2 - 4} fill="none" stroke={color} strokeWidth="1" />
      <circle cx={size / 2} cy={size / 2} r={size / 4} fill="none" stroke={color} strokeWidth="0.5" />
      <line x1="4" y1={size / 2} x2={size - 4} y2={size / 2} stroke={color} strokeWidth="1" />
      <line x1={size / 2} y1="4" x2={size / 2} y2={size - 4} stroke={color} strokeWidth="1" />
      <circle cx={size / 2} cy={size / 2} r="2" fill={color} />
    </svg>
  );
}

interface RulerMarkProps {
  x: number;
  y: number;
  label?: string;
  isMajor?: boolean;
}

function RulerMark({ x, y, label, isMajor }: RulerMarkProps) {
  const markLength = isMajor ? 12 : 6;
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y + markLength} stroke="rgba(245,158,11,0.4)" strokeWidth={isMajor ? 1 : 0.5} />
      {label && isMajor && (
        <text x={x} y={y + 22} textAnchor="middle" fill="rgba(245,158,11,0.6)" fontSize="8" fontFamily="JetBrains Mono, monospace">
          {label}
        </text>
      )}
    </g>
  );
}

function HorizontalRuler() {
  const marks = [];
  for (let i = 0; i <= 2000; i += 50) {
    marks.push(<RulerMark key={i} x={i} y={0} label={String(i)} isMajor={i % 100 === 0} />);
  }
  return (
    <svg style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 40, overflow: 'visible' }}>
      <rect x="0" y="0" width="100%" height="40" fill="rgba(12,18,32,0.6)" />
      {marks}
    </svg>
  );
}

function VerticalRuler() {
  const marks = [];
  for (let i = 0; i <= 2000; i += 50) {
    marks.push(<RulerMark key={i} x={0} y={i} label={String(i)} isMajor={i % 100 === 0} />);
  }
  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: 40, height: '100%', overflow: 'visible' }}>
      <rect x="0" y="0" width="40" height="100%" fill="rgba(12,18,32,0.6)" />
      {marks}
    </svg>
  );
}

interface AnnotationProps {
  text: string;
  position: { top?: string; bottom?: string; left?: string; right?: string };
  driftRange?: { x?: number; y?: number };
  delay?: number;
}

function FloatingAnnotation({ text, position, delay = 0 }: AnnotationProps) {
   
  const randomDuration = React.useMemo(() => 45 + Math.random() * 20, []);
  return (
    <div
      style={{
        position: 'absolute',
        ...position,
        animation: `annotationDrift-${text.replace(/[^a-zA-Z]/g, '')} ${randomDuration}s ease-in-out infinite`,
        animationDelay: `${delay}s`,
        willChange: 'transform',
      }}
    >
      <svg width="120" height="32" viewBox="0 0 120 32">
        <rect x="0" y="0" width="120" height="32" fill="rgba(12,18,32,0.7)" stroke="rgba(245,158,11,0.3)" strokeWidth="1" rx="2" />
        <text x="60" y="21" textAnchor="middle" fill="rgba(245,158,11,0.8)" fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="500">
          {text}
        </text>
      </svg>
    </div>
  );
}

// ── I-beam cross-section decorative element ──────────────────────────
function BeamCrossSection({ style }: { style?: React.CSSProperties }) {
  return (
    <svg width="60" height="80" viewBox="0 0 60 80" fill="none" style={style}>
      {/* I-beam shape */}
      <path
        d="M 5 0 L 10 0 L 10 20 L 25 20 L 25 25 L 10 25 L 10 55 L 25 55 L 25 60 L 10 60 L 10 80 L 5 80 L 5 60 L 0 60 L 0 55 L 5 55 L 5 25 L 0 25 L 0 20 L 5 20 Z"
        fill="none"
        stroke="rgba(245,158,11,0.15)"
        strokeWidth="0.75"
        style={{ animation: 'beamReveal 2s ease-out forwards', strokeDasharray: 200 }}
      />
      {/* Dimension lines */}
      <line x1="-8" y1="0" x2="-8" y2="80" stroke="rgba(245,158,11,0.1)" strokeWidth="0.5" strokeDasharray="3 3" />
      <line x1="-12" y1="0" x2="-4" y2="0" stroke="rgba(245,158,11,0.2)" strokeWidth="0.5" />
      <line x1="-12" y1="80" x2="-4" y2="80" stroke="rgba(245,158,11,0.2)" strokeWidth="0.5" />
      <text x="-10" y="42" textAnchor="middle" fill="rgba(245,158,11,0.3)" fontSize="6" fontFamily="JetBrains Mono, monospace" transform="rotate(-90, -10, 42)">UB 305×127×48</text>
    </svg>
  );
}

// ── Corner construction mark ─────────────────────────────────────────
function CornerConstructionMark({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const rotations = { tl: 0, tr: 90, bl: -90, br: 180 };
  return (
    <div
      style={{
        position: 'absolute',
        ...(position === 'tl' ? { top: 48, left: 48 } : {}),
        ...(position === 'tr' ? { top: 48, right: 48 } : {}),
        ...(position === 'bl' ? { bottom: 68, left: 48 } : {}),
        ...(position === 'br' ? { bottom: 68, right: 48 } : {}),
        transform: `rotate(${rotations[position]}deg)`,
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <line x1="0" y1="8" x2="0" y2="0" stroke="rgba(245,158,11,0.5)" strokeWidth="1.5" />
        <line x1="0" y1="0" x2="8" y2="0" stroke="rgba(245,158,11,0.5)" strokeWidth="1.5" />
        <circle cx="0" cy="0" r="1.5" fill="rgba(245,158,11,0.6)" />
      </svg>
    </div>
  );
}

const BlueprintBackgroundComponent = ({ children }: { children?: React.ReactNode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const parallaxRef = useRef<HTMLDivElement>(null);

  // Mouse parallax effect
  useEffect(() => {
    let rafId: number;
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !parallaxRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;

      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (parallaxRef.current) {
          parallaxRef.current.style.transform = `translate(${x * 6}px, ${y * 6}px)`;
        }
      });
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        backgroundColor: '#0c1220',
        contain: 'layout paint',
      }}
    >
      {/* ── Animated grid layers with panning ──────────────────────────── */}
      {/* Micro grid - fastest pan */}
      <div
        className="blueprint-grid-micro-animated"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: microGridBg,
          backgroundSize: `${MICRO_GRID_SIZE}px ${MICRO_GRID_SIZE}px`,
          opacity: 1,
        }}
      />

      {/* Base grid - medium pan */}
      <div
        className="blueprint-grid-animated"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: baseGridBg,
          backgroundSize: `${BASE_GRID_SIZE}px ${BASE_GRID_SIZE}px`,
          opacity: 1,
        }}
      />

      {/* Accent grid - slowest pan */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: accentGridBg,
          backgroundSize: `${ACCENT_GRID_SIZE}px ${ACCENT_GRID_SIZE}px`,
          opacity: 1,
          animation: 'gridPan 60s ease-in-out infinite',
        }}
      />

      {/* Parallax layer - mouse driven */}
      <div
        ref={parallaxRef}
        style={{
          position: 'absolute',
          inset: '-20px',
          background: `radial-gradient(ellipse at 50% 50%, rgba(245,158,11,0.02) 0%, transparent 60%)`,
          transition: 'transform 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'transform',
        }}
      />

      {/* Vignette overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(12,18,32,0.7) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Measurement rulers ─────────────────────────────────────────── */}
      <VerticalRuler />
      <HorizontalRuler />

      {/* ── Corner crosshairs ───────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 20, left: 20, animation: 'gentlePulse 4s ease-in-out infinite' }} className="corner-crosshair-md">
        <CornerCrosshair />
      </div>
      <div style={{ position: 'absolute', top: 20, right: 20, animation: 'gentlePulse 4s ease-in-out infinite', animationDelay: '1s' }} className="corner-crosshair-md">
        <CornerCrosshair />
      </div>
      <div style={{ position: 'absolute', bottom: 60, left: 20, animation: 'gentlePulse 4s ease-in-out infinite', animationDelay: '2s' }} className="corner-crosshair-md">
        <CornerCrosshair />
      </div>
      <div style={{ position: 'absolute', bottom: 60, right: 20, animation: 'gentlePulse 4s ease-in-out infinite', animationDelay: '3s' }} className="corner-crosshair-md">
        <CornerCrosshair />
      </div>

      {/* ── Corner construction marks (I-beam style) ────────────────────── */}
      {(['tl', 'tr', 'bl', 'br'] as const).map(pos => (
        <CornerConstructionMark key={pos} position={pos} />
      ))}

      {/* ── Beam cross-section decorations ─────────────────────────────── */}
      <BeamCrossSection style={{ position: 'absolute', top: '20%', right: '5%', opacity: 0.6, animation: 'gentlePulse 6s ease-in-out infinite' }} />
      <BeamCrossSection style={{ position: 'absolute', bottom: '25%', left: '3%', opacity: 0.4, animation: 'gentlePulse 6s ease-in-out infinite', animationDelay: '2s' }} />

      {/* ── Animated scan line ──────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(245,158,11,0.1) 10%, rgba(245,158,11,0.8) 50%, rgba(245,158,11,0.1) 90%, transparent 100%)',
          boxShadow: '0 0 20px 5px rgba(245,158,11,0.3), 0 0 40px 10px rgba(245,158,11,0.1)',
          animation: 'scanLine 8s linear infinite',
          willChange: 'transform',
        }}
      />

      {/* ── Grid coordinate labels ─────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 48,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '8px',
          color: 'rgba(245,158,11,0.2)',
          letterSpacing: '0.1em',
        }}
      >
        GRID LINES @ 4000mm O.C.
      </div>

      {/* ── Floating annotations ─────────────────────────────────────────── */}
      <FloatingAnnotation text="FL 01 +3,600" position={{ top: '12%', right: '8%' }} delay={0} />
      <FloatingAnnotation text="GRID A-A" position={{ bottom: '18%', left: '6%' }} delay={5} />
      <FloatingAnnotation text="BM: 24.500" position={{ top: '8%', left: '8%' }} delay={10} />
      <FloatingAnnotation text="ELEV. 00.00" position={{ top: '45%', right: '3%' }} delay={15} />

      {/* ── CSS Keyframes ───────────────────────────────────────────────── */}
      <style>{`
        @keyframes scanLine {
          0% { transform: translateY(0); opacity: 0; }
          2% { opacity: 1; }
          98% { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        @keyframes gentlePulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes beamReveal {
          from { stroke-dashoffset: 200; opacity: 0; }
          to { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes annotationDriftFL013600 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(15px, -10px) rotate(0.5deg); }
          50% { transform: translate(5px, -20px) rotate(-0.3deg); }
          75% { transform: translate(-10px, -8px) rotate(0.2deg); }
        }
        @keyframes annotationDriftGRIDA {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(-12px, 8px) rotate(-0.4deg); }
          50% { transform: translate(-5px, 18px) rotate(0.3deg); }
          75% { transform: translate(10px, 5px) rotate(-0.2deg); }
        }
        @keyframes annotationDriftBM24500 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(-8px, 12px) rotate(0.3deg); }
          50% { transform: translate(8px, 5px) rotate(-0.2deg); }
          75% { transform: translate(3px, -10px) rotate(0.4deg); }
        }
        @keyframes annotationDriftELEV0000 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(10px, 15px) rotate(-0.3deg); }
          50% { transform: translate(-5px, 8px) rotate(0.2deg); }
          75% { transform: translate(8px, -12px) rotate(-0.4deg); }
        }
      `}</style>

      {/* Children wrapper */}
      {children && (
        <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
      )}
    </div>
  );
};

export const BlueprintBackground = React.memo(BlueprintBackgroundComponent);
