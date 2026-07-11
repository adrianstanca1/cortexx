// Cortexx — Phase 19: Signature capture (canvas-based) + multi-approver workflows

// ═══════════════════════════════════════════════════════════════════
// SIGNATURE CANVAS
// ═══════════════════════════════════════════════════════════════════
function SignatureSheet({ subject, signerName, onSigned, onClose, accent }) {
  const canvasRef = React.useRef(null);
  const [hasSignature, setHasSignature] = React.useState(false);
  const drawing = React.useRef(false);
  const lastPoint = React.useRef(null);

  React.useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#eef3fa';
  }, []);

  const getPos = (e) => {
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    const t = e.touches?.[0];
    const x = (t ? t.clientX : e.clientX) - rect.left;
    const y = (t ? t.clientY : e.clientY) - rect.top;
    return { x, y };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    lastPoint.current = getPos(e);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPoint.current = p;
    if (!hasSignature) setHasSignature(true);
  };

  const end = () => {
    drawing.current = false;
    lastPoint.current = null;
  };

  const clear = () => {
    const c = canvasRef.current;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    setHasSignature(false);
  };

  const sign = async () => {
    if (!hasSignature) { toast('Please sign first', 'error'); return; }
    const dataUrl = canvasRef.current.toDataURL('image/png');
    await Backend.db.activity.create({
      who: signerName || 'You',
      what: `signed: ${subject}`,
      where: subject,
      when: new Date().toISOString().slice(0,16),
      icon: 'check', color: '#10b981',
    });
    toast(`Signed`, 'success');
    onSigned && onSigned(dataUrl);
    onClose();
  };

  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 16px 10px' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 16, cursor: 'pointer' }}>Cancel</button>
        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.t1 }}>Signature</div>
        <button onClick={sign} style={{ background: 'none', border: 'none', color: hasSignature ? accent : T.t3, fontFamily: SF, fontSize: 16, fontWeight: 600, cursor: hasSignature ? 'pointer' : 'default' }}>Sign</button>
      </div>
      <div style={{ flex: 1, padding: '0 16px 24px' }}>
        <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, marginBottom: 6 }}>You're signing:</div>
        <div style={{ fontFamily: SF, fontSize: 16, fontWeight: 600, color: T.t1, marginBottom: 14 }}>{subject}</div>

        <div style={{
          background: T.bg2, border: `0.5px solid ${T.hairMid}`, borderRadius: 14,
          aspectRatio: '5/3', position: 'relative', overflow: 'hidden',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        }}>
          <canvas
            ref={canvasRef}
            onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
            onTouchStart={start} onTouchMove={move} onTouchEnd={end}
            style={{ width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' }}/>
          {!hasSignature && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
              color: T.t3, fontFamily: SF, fontSize: 13, gap: 6,
            }}>
              <div style={{ fontSize: 28 }}>✍️</div>
              <div>Sign here</div>
            </div>
          )}
          {/* baseline */}
          <div style={{
            position: 'absolute', bottom: '18%', left: 24, right: 24,
            height: 1, background: T.hairMid, pointerEvents: 'none',
          }}/>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={clear} style={{
            flex: 1, background: 'transparent', color: T.t2, border: `0.5px solid ${T.hairMid}`,
            borderRadius: 12, padding: '12px', fontFamily: SF, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Clear</button>
          <button onClick={sign} disabled={!hasSignature} style={{
            flex: 2, background: hasSignature ? T.green : T.bg3, color: '#fff', border: 'none',
            borderRadius: 12, padding: '12px', fontFamily: SF, fontSize: 14, fontWeight: 700,
            cursor: hasSignature ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>{React.cloneElement(Ic.check, { size: 15, sw: 3 })} Confirm signature</button>
        </div>

        <div style={{ marginTop: 16, fontFamily: SF, fontSize: 11, color: T.t3, textAlign: 'center', lineHeight: 1.5 }}>
          By signing you confirm the details are accurate.<br/>Signed digitally · {new Date().toLocaleString('en-GB')}
        </div>
      </div>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════════
// APPROVAL WORKFLOW — multi-approver chain
// ═══════════════════════════════════════════════════════════════════
function ApprovalSheet({ item, onClose, onApproved, accent }) {
  const approvers = item?.approvers || [
    { name: 'Adrian Stanca', role: 'Director', status: 'pending' },
    { name: 'Eve Lin',       role: 'Architect', status: 'pending' },
    { name: 'J. Patterson',  role: 'Client',  status: 'pending' },
  ];
  const [list, setList] = React.useState(approvers);
  const approve = (i) => {
    const next = list.map((a, j) => j === i ? { ...a, status: 'approved', when: new Date().toISOString().slice(0,16) } : a);
    setList(next);
    toast(`${next[i].name} approved`, 'success');
  };
  const reject = (i) => {
    const next = list.map((a, j) => j === i ? { ...a, status: 'rejected', when: new Date().toISOString().slice(0,16) } : a);
    setList(next);
    toast(`${next[i].name} rejected`, 'error');
  };
  const allDone = list.every(a => a.status !== 'pending');
  const allApproved = list.every(a => a.status === 'approved');

  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 16px 10px' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 16, cursor: 'pointer' }}>Close</button>
        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.t1 }}>Approval chain</div>
        <button onClick={() => { onApproved && onApproved(allApproved); onClose(); }} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 16, cursor: 'pointer' }}>Done</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px' }}>
        <div style={{
          background: allApproved ? `linear-gradient(135deg, ${T.green}22, ${T.green}11)` : T.bg2,
          border: `0.5px solid ${allApproved ? T.green + '44' : T.hair}`,
          borderRadius: 14, padding: 14, marginBottom: 14,
        }}>
          <div style={{ fontFamily: SF, fontSize: 12, color: T.t2 }}>Item</div>
          <div style={{ fontFamily: SF, fontSize: 16, fontWeight: 600, color: T.t1, marginTop: 4 }}>{item?.title || 'Pending approval'}</div>
          {allDone && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${T.hair}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              {allApproved ? (
                <>
                  <div style={{ width: 24, height: 24, borderRadius: 12, background: T.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {React.cloneElement(Ic.check, { size: 14, sw: 3 })}
                  </div>
                  <span style={{ fontFamily: SF, fontSize: 13, color: T.green, fontWeight: 700 }}>All approvals received</span>
                </>
              ) : (
                <>
                  <div style={{ width: 24, height: 24, borderRadius: 12, background: T.red, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {React.cloneElement(Ic.alert, { size: 14 })}
                  </div>
                  <span style={{ fontFamily: SF, fontSize: 13, color: T.red, fontWeight: 700 }}>Rejected — review needed</span>
                </>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((a, i) => {
            const c = a.status === 'approved' ? T.green : a.status === 'rejected' ? T.red : T.amber;
            const blocked = i > 0 && list[i - 1].status !== 'approved';
            return (
              <div key={i} style={{
                background: T.bg2, border: `0.5px solid ${T.hair}`, borderRadius: 12, padding: 12,
                opacity: blocked && a.status === 'pending' ? 0.5 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 14,
                    background: a.status === 'pending' ? T.bg3 : c, color: '#fff',
                    border: `2px solid ${a.status === 'pending' ? T.hairMid : c}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: SF, fontSize: 12, fontWeight: 700,
                  }}>
                    {a.status === 'approved' ? React.cloneElement(Ic.check, { size: 14, sw: 3 }) :
                     a.status === 'rejected' ? '✗' : (i + 1)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: SF, fontSize: 13, color: T.t1, fontWeight: 600 }}>{a.name}</div>
                    <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 1 }}>{a.role}</div>
                    {a.when && <div style={{ fontFamily: SFMono, fontSize: 9, color: c, marginTop: 3 }}>{a.status.toUpperCase()} · {new Date(a.when).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
                  </div>
                  {a.status === 'pending' && !blocked && (
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button onClick={() => approve(i)} style={{
                        background: T.green, color: '#fff', border: 'none', borderRadius: 8,
                        padding: '6px 10px', cursor: 'pointer', fontFamily: SF, fontSize: 11, fontWeight: 700,
                      }}>✓</button>
                      <button onClick={() => reject(i)} style={{
                        background: 'transparent', color: T.red, border: `0.5px solid ${T.red}66`,
                        borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontFamily: SF, fontSize: 11, fontWeight: 700,
                      }}>✗</button>
                    </div>
                  )}
                  {blocked && a.status === 'pending' && <Pill c={T.t3} size="xs">BLOCKED</Pill>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}

Object.assign(window, { SignatureSheet, ApprovalSheet });
