/**
 * Animated blueprint SVG used as the centerpiece of the LoginHero panel.
 * Pure visual chrome; no props, no state.
 */
export function BlueprintStructure() {
  return (
    <svg
      viewBox="0 0 440 520"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
    >
      <defs>
        <style>{`
          @keyframes drawLine { from { stroke-dashoffset: 1200; } to { stroke-dashoffset: 0; } }
          @keyframes drawShort { from { stroke-dashoffset: 600; } to { stroke-dashoffset: 0; } }
          @keyframes blueprintFade { from { opacity: 0; } to { opacity: 1; } }
          @keyframes blueprintPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
          .bp-line-1 { animation: drawLine 2.8s ease forwards; stroke-dasharray: 1200; stroke-dashoffset: 1200; }
          .bp-line-2 { animation: drawLine 2.4s ease 0.3s forwards; stroke-dasharray: 1200; stroke-dashoffset: 1200; }
          .bp-line-3 { animation: drawShort 1.8s ease 0.8s forwards; stroke-dasharray: 600; stroke-dashoffset: 600; }
          .bp-line-4 { animation: drawShort 1.6s ease 1.0s forwards; stroke-dasharray: 600; stroke-dashoffset: 600; }
          .bp-line-5 { animation: drawShort 1.4s ease 1.2s forwards; stroke-dasharray: 600; stroke-dashoffset: 600; }
          .bp-dot { animation: blueprintFade 0.4s ease forwards; opacity: 0; }
          .bp-dot-1 { animation-delay: 2.0s; }
          .bp-dot-2 { animation-delay: 2.2s; }
          .bp-dot-3 { animation-delay: 2.4s; }
          .bp-dot-4 { animation-delay: 2.6s; }
          .bp-label { animation: blueprintFade 0.6s ease forwards; opacity: 0; }
          .bp-label-1 { animation-delay: 1.8s; }
          .bp-label-2 { animation-delay: 2.1s; }
          .bp-label-3 { animation-delay: 2.5s; }
          .bp-crosshair { animation: blueprintPulse 3s ease infinite; }
        `}</style>
      </defs>

      {/* Main columns */}
      <line className="bp-line-1" x1="80" y1="60" x2="80" y2="460" stroke="rgba(245,158,11,0.35)" strokeWidth="1.5" />
      <line className="bp-line-1" x1="360" y1="60" x2="360" y2="460" stroke="rgba(245,158,11,0.35)" strokeWidth="1.5" />
      {/* Foundation + roof */}
      <line className="bp-line-2" x1="60" y1="460" x2="380" y2="460" stroke="rgba(245,158,11,0.5)" strokeWidth="2" />
      <line className="bp-line-2" x1="60" y1="60" x2="380" y2="60" stroke="rgba(245,158,11,0.5)" strokeWidth="2" />

      {/* Floor plates */}
      {[145, 230, 315].map((y) => (
        <line
          key={y}
          className="bp-line-3"
          x1="80"
          y1={y}
          x2="360"
          y2={y}
          stroke="rgba(245,158,11,0.2)"
          strokeWidth="1"
          strokeDasharray="6 4"
        />
      ))}

      {/* Cross bracing */}
      <line className="bp-line-4" x1="80" y1="60" x2="220" y2="460" stroke="rgba(245,158,11,0.12)" strokeWidth="1" />
      <line className="bp-line-4" x1="220" y1="60" x2="80" y2="460" stroke="rgba(245,158,11,0.12)" strokeWidth="1" />
      <line className="bp-line-5" x1="220" y1="60" x2="360" y2="460" stroke="rgba(245,158,11,0.12)" strokeWidth="1" />
      <line className="bp-line-5" x1="360" y1="60" x2="220" y2="460" stroke="rgba(245,158,11,0.12)" strokeWidth="1" />

      {/* Centre column */}
      <line className="bp-line-3" x1="220" y1="60" x2="220" y2="460" stroke="rgba(245,158,11,0.2)" strokeWidth="1" />

      {/* Connection nodes */}
      {[[80,60],[360,60],[80,460],[360,460],[220,60],[220,460],[80,145],[360,145],[80,230],[360,230],[80,315],[360,315]].map(([cx,cy], i) => (
        <circle
          key={`ring-${cx}-${cy}`}
          className={`bp-dot bp-dot-${(i % 4) + 1}`}
          cx={cx}
          cy={cy}
          r="4"
          fill="none"
          stroke="rgba(245,158,11,0.7)"
          strokeWidth="1.5"
        />
      ))}
      {[[80,60],[360,60],[80,460],[360,460]].map(([cx,cy], i) => (
        <circle
          key={`dot-${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r="1.5"
          fill="rgba(245,158,11,0.9)"
          className={`bp-dot bp-dot-${i + 1}`}
        />
      ))}

      {/* Dimension lines */}
      <g className="bp-label bp-label-1">
        <line x1="30" y1="60" x2="30" y2="460" stroke="rgba(245,158,11,0.25)" strokeWidth="0.75" />
        <line x1="26" y1="60" x2="34" y2="60" stroke="rgba(245,158,11,0.25)" strokeWidth="0.75" />
        <line x1="26" y1="460" x2="34" y2="460" stroke="rgba(245,158,11,0.25)" strokeWidth="0.75" />
        <text
          x="18"
          y="265"
          fill="rgba(245,158,11,0.4)"
          fontSize="8"
          fontFamily="monospace"
          textAnchor="middle"
          transform="rotate(-90,18,265)"
        >
          24,500mm
        </text>
      </g>
      <g className="bp-label bp-label-2">
        <line x1="80" y1="500" x2="360" y2="500" stroke="rgba(245,158,11,0.25)" strokeWidth="0.75" />
        <line x1="80" y1="496" x2="80" y2="504" stroke="rgba(245,158,11,0.25)" strokeWidth="0.75" />
        <line x1="360" y1="496" x2="360" y2="504" stroke="rgba(245,158,11,0.25)" strokeWidth="0.75" />
        <text x="220" y="515" fill="rgba(245,158,11,0.4)" fontSize="8" fontFamily="monospace" textAnchor="middle">
          14,000mm
        </text>
      </g>

      {/* Floor callouts */}
      {[
        { y: 145, label: 'FL 01 +3,600' },
        { y: 230, label: 'FL 02 +7,200' },
        { y: 315, label: 'FL 03 +10,800' },
      ].map(({ y, label }) => (
        <g key={label} className="bp-label bp-label-3">
          <line x1="360" y1={y} x2="400" y2={y - 20} stroke="rgba(245,158,11,0.3)" strokeWidth="0.75" />
          <text x="403" y={y - 21} fill="rgba(245,158,11,0.5)" fontSize="7.5" fontFamily="monospace">
            {label}
          </text>
        </g>
      ))}

      {/* Roof crosshair */}
      <g className="bp-crosshair">
        <line x1="210" y1="60" x2="230" y2="60" stroke="rgba(245,158,11,0.6)" strokeWidth="1" />
        <line x1="220" y1="50" x2="220" y2="70" stroke="rgba(245,158,11,0.6)" strokeWidth="1" />
      </g>
    </svg>
  );
}

export default BlueprintStructure;
