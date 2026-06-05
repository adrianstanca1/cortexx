// Cortexx — Phase 34: Real charts in Reports (SVG, no deps)

function LineChart({ data, width = 320, height = 140, color = '#10b981', accent = '#2563eb' }) {
  const padding = { top: 10, right: 10, bottom: 24, left: 36 };
  const w = width - padding.left - padding.right;
  const h = height - padding.top - padding.bottom;
  const max = Math.max(...data.map(d => d.v));
  const min = Math.min(...data.map(d => d.v), 0);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);
  const yFor = v => padding.top + h - ((v - min) / range) * h;
  const xFor = i => padding.left + i * stepX;
  const points = data.map((d, i) => `${xFor(i)},${yFor(d.v)}`).join(' ');
  const area = `${xFor(0)},${padding.top + h} ${points} ${xFor(data.length - 1)},${padding.top + h}`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(p => min + range * p);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="areaG" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {ticks.reverse().map((t, i) => (
        <g key={i}>
          <line x1={padding.left} x2={padding.left + w} y1={yFor(t)} y2={yFor(t)} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5"/>
          <text x={padding.left - 6} y={yFor(t)+3} fontSize="9" fontFamily="SF Mono, monospace" fill="rgba(142,168,197,0.6)" textAnchor="end">£{(t/1000).toFixed(0)}k</text>
        </g>
      ))}
      <polyline points={area} fill="url(#areaG)" stroke="none"/>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {data.map((d, i) => (
        <g key={i}>
          {i % Math.ceil(data.length / 6) === 0 && (
            <text x={xFor(i)} y={height - 6} fontSize="9" fontFamily="SF Mono, monospace" fill="rgba(82,116,154,0.8)" textAnchor="middle">{d.l}</text>
          )}
          {i === data.length - 1 && (
            <>
              <circle cx={xFor(i)} cy={yFor(d.v)} r="10" fill={color} opacity="0.2"/>
              <circle cx={xFor(i)} cy={yFor(d.v)} r="4" fill={color}/>
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

function BarChart({ data, width = 320, height = 160 }) {
  const padding = { top: 10, right: 10, bottom: 30, left: 10 };
  const w = width - padding.left - padding.right;
  const h = height - padding.top - padding.bottom;
  const max = Math.max(...data.map(d => d.v));
  const barW = (w / data.length) * 0.6;
  const gap = (w / data.length) * 0.4;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {data.map((d, i) => {
        const bh = (d.v / max) * h;
        const x = padding.left + i * (barW + gap) + gap / 2;
        const y = padding.top + h - bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} rx={4} fill={d.c || '#2563eb'} opacity="0.85"/>
            <text x={x + barW/2} y={y - 4} fontSize="9" fontFamily="SF Mono, monospace" fill="rgba(238,243,250,0.9)" textAnchor="middle" fontWeight="700">£{(d.v/1000).toFixed(0)}k</text>
            <text x={x + barW/2} y={height - 12} fontSize="9" fontFamily="-apple-system" fill="rgba(142,168,197,0.7)" textAnchor="middle">{d.l}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Replace the Reports KPI strip with real charts after the original strip
function ReportsCharts({ accent }) {
  const projects = useDB('projects');
  // Mock 12-week cashflow trend (would derive from real data in production)
  const cashTrend = [
    { l: 'Wk6', v: 12000 }, { l: 'Wk7', v: 18000 }, { l: 'Wk8', v: 16000 }, { l: 'Wk9', v: 22000 },
    { l: 'Wk10', v: 28000 }, { l: 'Wk11', v: 26000 }, { l: 'Wk12', v: 31000 }, { l: 'Wk13', v: 35000 },
    { l: 'Wk14', v: 33000 }, { l: 'Wk15', v: 38000 }, { l: 'Wk16', v: 36000 }, { l: 'Wk17', v: 42100 },
  ];
  const projBars = projects.filter(p => p.value > 0).map(p => ({
    l: p.name.split(' ')[0], v: p.value, c: STATUS_C[p.status] || accent,
  }));
  return (
    <>
      <Section title="Cashflow · last 12 weeks">
        <div style={{ background: T.bg2, borderRadius: 14, padding: 12, border: `0.5px solid ${T.hair}` }}>
          <LineChart data={cashTrend} width={320} height={140} color={T.green}/>
        </div>
      </Section>
      <Section title="Project values">
        <div style={{ background: T.bg2, borderRadius: 14, padding: 12, border: `0.5px solid ${T.hair}` }}>
          <BarChart data={projBars} width={320} height={160}/>
        </div>
      </Section>
    </>
  );
}

Object.assign(window, { LineChart, BarChart, ReportsCharts });
