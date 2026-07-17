// Cortexx — Phase 98: Site label printer (v1.5)
// Print site labels — delivery tags, asset/equipment tags, RAMS/hazard posters,
// and scannable QR check-in labels — via the browser's native print (works on
// any printer / AirPrint / save-as-PDF). Optional Web Bluetooth path for direct
// thermal printing on Android Chrome.

function LabelPrinterScreen({ accent }) {
  const projects = useDB('projects');
  const [type, setType] = React.useState('delivery');
  const [pid, setPid] = React.useState(projects[0]?.id);
  const proj = projects.find(p => p.id == pid) || projects[0];
  const [fields, setFields] = React.useState({ ref: '', note: '', hazard: 'Hard hat & hi-vis required' });
  const previewRef = React.useRef(null);
  const btSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;

  const TYPES = [
    { k: 'delivery', l: 'Delivery label', d: 'For incoming materials' },
    { k: 'asset', l: 'Asset / tool tag', d: 'Equipment register' },
    { k: 'qr', l: 'QR check-in', d: 'Scan to clock in' },
    { k: 'rams', l: 'RAMS / hazard', d: 'A5 site poster' },
  ];
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const checkinUrl = proj ? Backend.nfc.tagUrl(proj.id) : '';

  React.useEffect(() => {
    if (type !== 'qr' || !previewRef.current || !window.CortexQR) return;
    previewRef.current.innerHTML = '';
    const cv = window.CortexQR.toCanvas(checkinUrl, { scale: 5, quiet: 2 });
    if (cv) { cv.style.width = '150px'; cv.style.height = '150px'; cv.style.imageRendering = 'pixelated'; previewRef.current.appendChild(cv); }
  }, [type, pid, checkinUrl]);

  const labelHTML = () => {
    // Escape all user-controlled values — this HTML is written into a popup via
    // document.write(), so unescaped project/field data would be an XSS vector.
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const wrap = (inner, w, h) => `<div style="width:${w};height:${h};box-sizing:border-box;padding:6mm;border:1.5px solid #111;border-radius:3mm;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111;display:flex;flex-direction:column;page-break-after:always">${inner}</div>`;
    if (type === 'delivery') {
      return wrap(`
        <div style="font:700 11px sans-serif;letter-spacing:2px;text-transform:uppercase;color:#666">Delivery to</div>
        <div style="font:800 26px sans-serif;margin:2mm 0 1mm">${esc(proj?.name || 'Site')}</div>
        <div style="font:500 14px sans-serif;color:#333">${esc(proj?.addr || '')}</div>
        <div style="flex:1"></div>
        <div style="display:flex;justify-content:space-between;border-top:1px solid #ccc;padding-top:3mm;font:600 13px sans-serif">
          <span>Ref: ${esc(fields.ref || '—')}</span><span>${today}</span></div>
        ${fields.note ? `<div style="font:500 13px sans-serif;margin-top:2mm;color:#444">${esc(fields.note)}</div>` : ''}
        <div style="font:700 10px sans-serif;color:#999;margin-top:2mm">CortexBuild · ${esc(proj?.client || '')}</div>
      `, '100mm', '62mm');
    }
    if (type === 'asset') {
      return wrap(`
        <div style="font:700 11px sans-serif;letter-spacing:2px;text-transform:uppercase;color:#666">Asset tag</div>
        <div style="font:800 22px sans-serif;margin:2mm 0">${esc(fields.ref || 'TOOL-001')}</div>
        <div style="font:500 14px sans-serif;color:#333">${esc(fields.note || 'Equipment')}</div>
        <div style="flex:1"></div>
        <div style="font:600 12px sans-serif;color:#444">Assigned: ${esc(proj?.name || 'Yard')}</div>
        <div style="font:700 10px sans-serif;color:#999;margin-top:1mm">Property of CortexBuild Ltd · ${today}</div>
      `, '70mm', '40mm');
    }
    if (type === 'qr') {
      const cv = window.CortexQR && window.CortexQR.toCanvas(checkinUrl, { scale: 8, quiet: 2 });
      const data = cv ? cv.toDataURL('image/png') : '';
      return wrap(`
        <div style="font:700 11px sans-serif;letter-spacing:2px;text-transform:uppercase;color:#0a7">Scan to check in</div>
        <div style="font:800 20px sans-serif;margin:1mm 0 3mm">${esc(proj?.name || 'Site')}</div>
        <div style="display:flex;justify-content:center"><img src="${data}" style="width:55mm;height:55mm;image-rendering:pixelated"/></div>
        <div style="flex:1"></div>
        <div style="font:500 12px sans-serif;text-align:center;color:#444">Point your phone camera at the code to clock in / out</div>
        <div style="font:700 10px sans-serif;color:#999;text-align:center;margin-top:1mm">Powered by CortexBuild Pro</div>
      `, '80mm', '100mm');
    }
    return wrap(`
      <div style="background:#d4901f;color:#111;font:800 13px sans-serif;letter-spacing:2px;text-transform:uppercase;padding:3mm;text-align:center;margin:-6mm -6mm 4mm;border-radius:3mm 3mm 0 0">⚠ Site safety notice</div>
      <div style="font:800 24px sans-serif;margin-bottom:2mm">${esc(proj?.name || 'Site')}</div>
      <div style="font:700 18px sans-serif;color:#b00;margin:2mm 0">${esc(fields.hazard)}</div>
      <div style="font:500 14px sans-serif;color:#333;line-height:1.5">${esc(fields.note || 'All persons on site must sign in, hold valid CSCS, and follow the site induction. Report hazards to the site manager immediately.')}</div>
      <div style="flex:1"></div>
      <div style="border-top:1px solid #ccc;padding-top:3mm;font:600 12px sans-serif;color:#444">Issued ${today} · CortexBuild Ltd · ${esc(proj?.client || '')}</div>
    `, '148mm', '210mm');
  };

  const print = () => {
    const w = window.open('', '_blank', 'width=420,height=600');
    if (!w) { window.cortexxToast && window.cortexxToast('Allow pop-ups to print', 'error'); return; }
    w.document.write(`<!doctype html><html><head><title>CortexBuild Pro label</title><style>@page{margin:8mm}body{margin:0;display:flex;justify-content:center;padding:8mm;background:#fff}</style></head><body>${labelHTML()}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 350);
    if (window.CortexAudit) window.CortexAudit.log('You', `printed a ${type} label for ${proj?.name}`, 'Documents');
  };

  const connectBluetooth = async () => {
    if (!btSupported) return;
    try {
      const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] });
      window.cortexxToast && window.cortexxToast(`Paired: ${device.name || 'printer'} — use Print to send`, 'success');
    } catch (e) {
      window.cortexxToast && window.cortexxToast('No printer selected', 'info');
    }
  };

  const Field = (props) => (
    <input {...props} style={{ width: '100%', boxSizing: 'border-box', background: T.bg2, border: `0.5px solid ${T.hairMid}`, borderRadius: 11, padding: '12px 14px', color: T.t1, fontFamily: SF, fontSize: 14, outline: 'none', ...(props.style || {}) }}/>
  );

  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader title="Label printer" subtitle="Site labels, asset tags & QR check-in"/>
        <div style={{ padding: '0 16px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {TYPES.map(t => (
              <button key={t.k} onClick={() => setType(t.k)} style={{
                background: type === t.k ? `${accent}1a` : T.bg2, border: `0.5px solid ${type === t.k ? accent : T.hair}`, borderRadius: 12, padding: 13, cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1 }}>{t.l}</div>
                <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 2 }}>{t.d}</div>
              </button>
            ))}
          </div>

          <div style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', letterSpacing: 0.6, margin: '6px 2px 8px' }}>Project</div>
          <select value={pid} onChange={e => setPid(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', background: T.bg2, border: `0.5px solid ${T.hairMid}`, borderRadius: 11, padding: '12px 14px', color: T.t1, fontFamily: SF, fontSize: 14, outline: 'none', marginBottom: 12 }}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          {type !== 'qr' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {type === 'rams' ? (
                <Field value={fields.hazard} onChange={e => setFields(f => ({ ...f, hazard: e.target.value }))} placeholder="Primary hazard / instruction"/>
              ) : (
                <Field value={fields.ref} onChange={e => setFields(f => ({ ...f, ref: e.target.value }))} placeholder={type === 'asset' ? 'Asset ID (e.g. TOOL-014)' : 'PO / delivery ref'}/>
              )}
              <Field value={fields.note} onChange={e => setFields(f => ({ ...f, note: e.target.value }))} placeholder={type === 'asset' ? 'Description' : type === 'rams' ? 'Notes (optional)' : 'Note (optional)'}/>
            </div>
          )}

          <div style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', letterSpacing: 0.6, margin: '8px 2px 8px' }}>Preview</div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 18, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 150 }}>
            {type === 'qr' ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, color: '#0a7', textTransform: 'uppercase', letterSpacing: 1 }}>Scan to check in</div>
                <div style={{ fontFamily: SF, fontSize: 16, fontWeight: 800, color: '#111', margin: '2px 0 8px' }}>{proj?.name}</div>
                <div ref={previewRef} style={{ display: 'flex', justifyContent: 'center' }}/>
              </div>
            ) : (
              <div style={{ fontFamily: SF, color: '#111', textAlign: 'left', width: '100%', maxWidth: 280 }}>
                {type === 'rams' && <div style={{ background: '#d4901f', color: '#111', fontWeight: 800, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', padding: 6, textAlign: 'center', borderRadius: 6, marginBottom: 8 }}>⚠ Site safety notice</div>}
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#666' }}>{type === 'delivery' ? 'Delivery to' : type === 'asset' ? 'Asset tag' : ''}</div>
                <div style={{ fontSize: type === 'rams' ? 20 : 22, fontWeight: 800, margin: '3px 0' }}>{type === 'asset' ? (fields.ref || 'TOOL-001') : proj?.name}</div>
                {type === 'rams' && <div style={{ fontSize: 15, fontWeight: 700, color: '#b00' }}>{fields.hazard}</div>}
                <div style={{ fontSize: 13, color: '#333', marginTop: 4 }}>{type === 'delivery' ? (proj?.addr || '') : type === 'asset' ? (fields.note || 'Equipment') : (fields.note || 'Site induction & CSCS required.')}</div>
              </div>
            )}
          </div>

          <button onClick={print} style={{ width: '100%', marginTop: 16, background: accent, color: '#fff', border: 'none', borderRadius: 13, padding: '15px', fontFamily: SF, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {React.cloneElement(Ic.print || Ic.download, { size: 16 })} Print label
          </button>
          {btSupported && (
            <button onClick={connectBluetooth} style={{ width: '100%', marginTop: 8, background: T.bg2, color: T.t1, border: `0.5px solid ${T.hairMid}`, borderRadius: 13, padding: '13px', fontFamily: SF, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Pair Bluetooth thermal printer
            </button>
          )}
          <div style={{ marginTop: 12, padding: 12, background: T.bg2, borderRadius: 10, fontFamily: SF, fontSize: 11, color: T.t2, lineHeight: 1.5, display: 'flex', gap: 8 }}>
            {React.cloneElement(Ic.shield, { size: 14, color: T.green })}
            <span>Print uses your device's normal print dialog — any AirPrint/Wi-Fi printer, or Save as PDF. The QR check-in label works with any phone camera (no app), complementing the NFC tags.</span>
          </div>
        </div>
      </div>
    </ScreenBg>
  );
}

Object.assign(window, { LabelPrinterScreen });
