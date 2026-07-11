// Cortexx — Phase 99: Offline site map (v1.5)
// A real slippy map (OpenStreetMap raster tiles — free, no key) with:
//  • pan / zoom
//  • OFFLINE tile caching via the Cache API (download a site's tiles, then the
//    map works with no signal)
//  • a markup layer (pins / freehand / text) persisted to the `siteMaps`
//    collection — which syncs through the backend like every other collection.
//
// Honest note: tiles come from tile.openstreetmap.org. For production swap the
// TILE_URL for your own provider/key per OSMF usage policy.

(function () {
  if (!window.Backend) return;
  const B = window.Backend;
  const TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const CACHE = 'cortexx-tiles-v1';

  // Web-Mercator helpers
  const lon2x = (lon, z) => ((lon + 180) / 360) * Math.pow(2, z);
  const lat2y = (lat, z) => {
    const r = lat * Math.PI / 180;
    return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z);
  };
  const x2lon = (x, z) => x / Math.pow(2, z) * 360 - 180;
  const y2lat = (y, z) => { const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z); return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); };
  const tileUrl = (z, x, y) => TILE.replace('{z}', z).replace('{x}', x).replace('{y}', y);

  B.map = {
    lon2x, lat2y, x2lon, y2lat, tileUrl,

    // Sites with coordinates (reuse geofence registry; fall back to London).
    sites() {
      const g = window.cortexxGeofence;
      const fromGeo = g && g.sites ? g.sites.map(s => ({ name: s.name, lat: s.lat, lng: s.lng })) : [];
      return fromGeo.length ? fromGeo : [{ name: 'London', lat: 51.5074, lng: -0.1278 }];
    },

    // Estimate tile count for a bbox over a zoom range (for the download UI).
    estimateTiles(lat, lng, zMin, zMax, spanTiles = 2) {
      let count = 0;
      for (let z = zMin; z <= zMax; z++) count += (spanTiles * 2 + 1) ** 2;
      return count;
    },

    // Download + cache the tiles around a point for offline use.
    async downloadPack(lat, lng, zMin, zMax, spanTiles, onProgress) {
      if (!('caches' in window)) return { ok: false, reason: 'no_cache_api' };
      const cache = await caches.open(CACHE);
      const urls = [];
      for (let z = zMin; z <= zMax; z++) {
        const cx = Math.floor(lon2x(lng, z)), cy = Math.floor(lat2y(lat, z));
        for (let dx = -spanTiles; dx <= spanTiles; dx++)
          for (let dy = -spanTiles; dy <= spanTiles; dy++)
            urls.push(tileUrl(z, cx + dx, cy + dy));
      }
      let done = 0, failed = 0;
      for (const url of urls) {
        try {
          const hit = await cache.match(url);
          if (!hit) { const r = await fetch(url, { mode: 'cors' }); if (r.ok) await cache.put(url, r.clone()); else failed++; }
        } catch (e) { failed++; }
        done++; onProgress && onProgress(done, urls.length, failed);
      }
      return { ok: true, total: urls.length, failed };
    },

    async cachedCount() {
      if (!('caches' in window)) return 0;
      try { const c = await caches.open(CACHE); return (await c.keys()).length; } catch (e) { return 0; }
    },
    async clearCache() { if ('caches' in window) await caches.delete(CACHE); },
  };

  // siteMaps collection is registered in backend-extras (EXTRAS.siteMaps).
})();

// ═══════════════════════════════════════════════════════════
// OFFLINE MAP SCREEN
// ═══════════════════════════════════════════════════════════
function OfflineMapScreen({ accent }) {
  const projects = useDB('projects');
  const sites = Backend.map.sites();
  const [pid, setPid] = React.useState(projects[0]?.id);
  const proj = projects.find(p => p.id == pid) || projects[0];
  // Match project to a site coordinate by name overlap, else first site.
  const site = React.useMemo(() => {
    if (!proj) return sites[0];
    const hit = sites.find(s => proj.name.toLowerCase().includes(s.name.split(' ')[0].toLowerCase()) || (proj.addr || '').toLowerCase().includes(s.name.split(' ')[0].toLowerCase()));
    return hit || sites[0];
  }, [pid]);

  const [zoom, setZoom] = React.useState(17);
  const [center, setCenter] = React.useState({ lat: site.lat, lng: site.lng });
  const [tool, setTool] = React.useState('pan'); // pan | pin | draw | text
  const [marks, setMarks] = React.useState([]);
  const [dl, setDl] = React.useState(null); // download progress
  const [cached, setCached] = React.useState(0);
  const [offline, setOffline] = React.useState(!navigator.onLine);
  const W = 320, H = 380, TS = 256;
  const canvasRef = React.useRef(null);
  const drawing = React.useRef(null);

  // Recenter when site changes.
  React.useEffect(() => { setCenter({ lat: site.lat, lng: site.lng }); }, [site.lat, site.lng]);

  // Load saved annotations for this project.
  React.useEffect(() => {
    const all = (Backend.db.siteMaps && Backend.db.siteMaps.listSync) ? Backend.db.siteMaps.listSync() : [];
    const rec = all.find(m => m.projectId == pid);
    setMarks(rec ? (rec.marks || []) : []);
  }, [pid]);

  React.useEffect(() => { Backend.map.cachedCount().then(setCached); }, [dl]);
  React.useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const saveMarks = async (next) => {
    setMarks(next);
    const all = (Backend.db.siteMaps && Backend.db.siteMaps.listSync) ? Backend.db.siteMaps.listSync() : [];
    const rec = all.find(m => m.projectId == pid);
    if (rec) await Backend.db.siteMaps.update(rec.id, { marks: next });
    else await Backend.db.siteMaps.create({ projectId: pid, marks: next });
  };

  // Pixel ↔ latlng for current view.
  const centerPx = { x: Backend.map.lon2x(center.lng, zoom) * TS, y: Backend.map.lat2y(center.lat, zoom) * TS };
  const toScreen = (lat, lng) => ({ x: Backend.map.lon2x(lng, zoom) * TS - centerPx.x + W / 2, y: Backend.map.lat2y(lat, zoom) * TS - centerPx.y + H / 2 });
  const toLatLng = (sx, sy) => ({ lat: Backend.map.y2lat((centerPx.y + sy - H / 2) / TS, zoom), lng: Backend.map.x2lon((centerPx.x + sx - W / 2) / TS, zoom) });

  // Visible tiles.
  const tiles = [];
  const ctx = Backend.map.lon2x(center.lng, zoom), cty = Backend.map.lat2y(center.lat, zoom);
  const span = 2;
  for (let dx = -span; dx <= span; dx++) for (let dy = -span; dy <= span; dy++) {
    const tx = Math.floor(ctx) + dx, ty = Math.floor(cty) + dy;
    if (tx < 0 || ty < 0 || tx >= 2 ** zoom || ty >= 2 ** zoom) continue;
    const px = (tx - ctx) * TS + W / 2, py = (ty - cty) * TS + H / 2;
    tiles.push({ tx, ty, px, py, url: Backend.map.tileUrl(zoom, tx, ty) });
  }

  // Pointer interaction.
  const dragStart = React.useRef(null);
  const onDown = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const sx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const sy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    if (tool === 'pan') dragStart.current = { sx, sy, lat: center.lat, lng: center.lng };
    else if (tool === 'pin') { const ll = toLatLng(sx, sy); saveMarks([...marks, { type: 'pin', ...ll, label: '', id: Date.now() }]); }
    else if (tool === 'text') { const ll = toLatLng(sx, sy); const txt = prompt('Annotation text:'); if (txt) saveMarks([...marks, { type: 'text', ...ll, label: txt, id: Date.now() }]); }
    else if (tool === 'draw') { drawing.current = { type: 'draw', pts: [toLatLng(sx, sy)], id: Date.now() }; }
  };
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const sx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const sy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    if (tool === 'pan' && dragStart.current) {
      const dxp = sx - dragStart.current.sx, dyp = sy - dragStart.current.sy;
      const nx = Backend.map.lon2x(dragStart.current.lng, zoom) * TS - dxp;
      const ny = Backend.map.lat2y(dragStart.current.lat, zoom) * TS - dyp;
      setCenter({ lng: Backend.map.x2lon(nx / TS, zoom), lat: Backend.map.y2lat(ny / TS, zoom) });
    } else if (tool === 'draw' && drawing.current) {
      drawing.current.pts.push(toLatLng(sx, sy));
      setMarks(m => [...m.filter(x => x.id !== drawing.current.id), drawing.current]);
    }
  };
  const onUp = () => {
    if (tool === 'draw' && drawing.current) { saveMarks([...marks.filter(x => x.id !== drawing.current.id), drawing.current]); drawing.current = null; }
    dragStart.current = null;
  };

  const download = async () => {
    setDl({ done: 0, total: 1 });
    const r = await Backend.map.downloadPack(center.lat, center.lng, 15, 18, 2, (done, total, failed) => setDl({ done, total, failed }));
    setDl(null);
    if (window.cortexxToast) window.cortexxToast(r.ok ? `Offline pack ready · ${r.total - (r.failed || 0)} tiles cached` : 'Tile cache not available here', r.ok ? 'success' : 'error');
    if (window.CortexAudit) window.CortexAudit.log('You', `downloaded offline map for ${proj?.name}`, 'Documents');
  };

  const TOOLS = [
    { k: 'pan', l: 'Pan', i: Ic.move || Ic.hand },
    { k: 'pin', l: 'Pin', i: Ic.pin },
    { k: 'draw', l: 'Draw', i: Ic.edit || Ic.pencil },
    { k: 'text', l: 'Text', i: Ic.doc || Ic.type },
  ];

  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader title="Site map" subtitle={offline ? 'Offline · cached tiles' : 'Mark up & save offline'}/>
        <div style={{ padding: '0 16px' }}>

          <select value={pid} onChange={e => setPid(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', background: T.bg2, border: `0.5px solid ${T.hairMid}`, borderRadius: 11, padding: '12px 14px', color: T.t1, fontFamily: SF, fontSize: 14, outline: 'none', marginBottom: 12 }}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          {/* Map viewport */}
          <div style={{ position: 'relative', width: '100%', height: H, borderRadius: 14, overflow: 'hidden', border: `0.5px solid ${T.hairMid}`, background: '#aadaff', touchAction: 'none', cursor: tool === 'pan' ? 'grab' : 'crosshair' }}
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
            onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}>
            {/* Tiles */}
            {tiles.map(t => (
              <img key={t.tx + '/' + t.ty} src={t.url} alt="" draggable={false} crossOrigin="anonymous"
                style={{ position: 'absolute', left: t.px, top: t.py, width: TS, height: TS, userSelect: 'none', pointerEvents: 'none' }}
                onError={(e) => { e.target.style.opacity = 0.15; }}/>
            ))}
            {/* Marks */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              {marks.map(m => {
                if (m.type === 'draw') {
                  const pts = m.pts.map(p => { const s = toScreen(p.lat, p.lng); return `${s.x},${s.y}`; }).join(' ');
                  return <polyline key={m.id} points={pts} fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>;
                }
                const s = toScreen(m.lat, m.lng);
                if (m.type === 'pin') return <g key={m.id}><circle cx={s.x} cy={s.y} r="7" fill={accent} stroke="#fff" strokeWidth="2"/></g>;
                if (m.type === 'text') return <g key={m.id}><rect x={s.x} y={s.y - 16} width={Math.max(30, m.label.length * 7 + 10)} height="20" rx="4" fill="rgba(0,0,0,.7)"/><text x={s.x + 5} y={s.y - 2} fill="#fff" fontSize="12" fontFamily="sans-serif">{m.label}</text></g>;
                return null;
              })}
            </svg>
            {/* Zoom controls */}
            <div style={{ position: 'absolute', right: 10, bottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={() => setZoom(z => Math.min(19, z + 1))} style={zoomBtn}>+</button>
              <button onClick={() => setZoom(z => Math.max(12, z - 1))} style={zoomBtn}>−</button>
            </div>
            {offline && <div style={{ position: 'absolute', left: 10, top: 10, background: T.amber, color: '#111', fontFamily: SF, fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6 }}>OFFLINE</div>}
          </div>

          {/* Tools */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {TOOLS.map(t => (
              <button key={t.k} onClick={() => setTool(t.k)} style={{ flex: 1, background: tool === t.k ? accent : T.bg2, color: tool === t.k ? '#fff' : T.t2, border: `0.5px solid ${tool === t.k ? accent : T.hairMid}`, borderRadius: 11, padding: '11px 6px', fontFamily: SF, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                {t.i ? React.cloneElement(t.i, { size: 16 }) : null}{t.l}
              </button>
            ))}
            {marks.length > 0 && <button onClick={() => saveMarks([])} style={{ background: T.bg2, color: T.red, border: `0.5px solid ${T.hairMid}`, borderRadius: 11, padding: '11px', fontFamily: SF, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Clear</button>}
          </div>

          {/* Offline pack */}
          <div style={{ marginTop: 16, background: T.bg2, border: `0.5px solid ${T.hair}`, borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1 }}>Offline tiles</div>
                <div style={{ fontFamily: SF, fontSize: 11, color: T.t2 }}>{cached} tiles cached on this device</div>
              </div>
              {cached > 0 && <button onClick={async () => { await Backend.map.clearCache(); setCached(0); }} style={{ background: 'none', border: 'none', color: T.red, fontFamily: SF, fontSize: 12, cursor: 'pointer' }}>Clear</button>}
            </div>
            {dl ? (
              <div>
                <div style={{ height: 8, borderRadius: 4, background: T.bg3, overflow: 'hidden' }}><div style={{ width: `${Math.round(dl.done / dl.total * 100)}%`, height: '100%', background: accent, transition: 'width .2s' }}/></div>
                <div style={{ fontFamily: SFMono, fontSize: 11, color: T.t2, marginTop: 6 }}>{dl.done}/{dl.total} tiles…</div>
              </div>
            ) : (
              <button onClick={download} style={{ width: '100%', background: accent, color: '#fff', border: 'none', borderRadius: 11, padding: '13px', fontFamily: SF, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {React.cloneElement(Ic.download, { size: 15 })} Download this area for offline
              </button>
            )}
            <div style={{ fontFamily: SF, fontSize: 11, color: T.t3, marginTop: 10, lineHeight: 1.5 }}>Caches zoom 15–18 around the current view (~{Backend.map.estimateTiles(0, 0, 15, 18, 2)} tiles). Markup saves to this project and syncs when you're online.</div>
          </div>
        </div>
      </div>
    </ScreenBg>
  );
}
const zoomBtn = { width: 34, height: 34, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,.92)', color: '#111', fontSize: 20, fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,.3)' };

Object.assign(window, { OfflineMapScreen });
