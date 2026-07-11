// Cortexx — Phase 77: Real device capture
// Replaces the mocked Voice memo and Receipt scan with actual device-backed
// implementations. Adds a global search across all data.
//
// - VoiceMemoSheetReal:   Web Speech API live transcription, MediaRecorder
//                          audio capture, optional AI summarisation.
// - ReceiptScanSheetReal: Camera (capture="environment") + vision OCR via
//                          Backend.vision to extract vendor/amount/date/VAT.
// - GlobalSearchSheet:    Searches projects, tasks, customers, quotes,
//                          invoices, documents, photos by name.

// ─────────────────────────────────────────────────────────
// VOICE MEMO — real speech recognition (browser) with audio fallback
// ─────────────────────────────────────────────────────────
function VoiceMemoSheetReal({ onClose, accent }) {
  const projects = useDB('projects');
  const [stage, setStage] = React.useState('idle');  // idle | recording | processing | done | error
  const [transcript, setTranscript] = React.useState('');
  const [partial, setPartial] = React.useState('');
  const [duration, setDuration] = React.useState(0);
  const [projectId, setProjectId] = React.useState(projects.find(p => p.status === 'active')?.id || projects[0]?.id || 1);
  const [audioBlob, setAudioBlob] = React.useState(null);
  const [audioUrl, setAudioUrl] = React.useState(null);
  const [summary, setSummary] = React.useState(null);
  const [errMsg, setErrMsg] = React.useState('');

  const recRef = React.useRef(null);
  const speechRef = React.useRef(null);
  const startedAt = React.useRef(0);

  // Check capabilities
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hasSpeech = !!SR;
  const hasMedia = !!(navigator.mediaDevices && window.MediaRecorder);

  // Duration tick
  React.useEffect(() => {
    if (stage !== 'recording') return;
    const t = setInterval(() => setDuration(Math.floor((Date.now() - startedAt.current) / 1000)), 250);
    return () => clearInterval(t);
  }, [stage]);

  const start = async () => {
    setErrMsg(''); setTranscript(''); setPartial(''); setSummary(null); setAudioBlob(null); setAudioUrl(null); setDuration(0);
    startedAt.current = Date.now();
    setStage('recording');

    // Start audio recording (parallel — best effort)
    if (hasMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const rec = new MediaRecorder(stream);
        const chunks = [];
        rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
        rec.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' });
          setAudioBlob(blob);
          setAudioUrl(URL.createObjectURL(blob));
        };
        rec.start();
        recRef.current = rec;
      } catch (e) {
        // permission denied → continue with speech-only
        recRef.current = null;
      }
    }

    // Start speech recognition
    if (hasSpeech) {
      const sr = new SR();
      sr.lang = 'en-GB';
      sr.interimResults = true;
      sr.continuous = true;
      sr.onresult = (event) => {
        let finalPiece = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) finalPiece += r[0].transcript;
          else interim += r[0].transcript;
        }
        if (finalPiece) setTranscript(t => (t + ' ' + finalPiece).trim());
        setPartial(interim);
      };
      sr.onerror = (e) => {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        setErrMsg(`Speech error: ${e.error}`);
      };
      sr.onend = () => { /* triggered after stop() */ };
      try { sr.start(); speechRef.current = sr; }
      catch (e) { setErrMsg('Speech recognition unavailable'); }
    } else if (!hasMedia) {
      setStage('error');
      setErrMsg('This device supports neither speech recognition nor audio recording.');
    }
  };

  const stop = async () => {
    if (speechRef.current) { try { speechRef.current.stop(); } catch (e) {} speechRef.current = null; }
    if (recRef.current && recRef.current.state !== 'inactive') {
      recRef.current.stop();
    }
    recRef.current = null;
    setStage('processing');

    // Wait briefly for any onresult or onstop to settle
    await new Promise(r => setTimeout(r, 350));
    const finalText = (transcript + ' ' + partial).trim();
    setPartial('');

    // If we got nothing transcribed but did record audio, that's still OK — show the audio
    setStage('done');

    // Optional: ask Claude for a quick action-item summary if we have text
    if (finalText && finalText.length > 10) {
      try {
        const prompt = `You are a UK construction site assistant. From the following dictated note, produce ONE concise sentence (≤25 words) listing the actions needed. Reply with ONLY the sentence, no preamble.\n\nNote: """${finalText}"""`;
        const text = await window.claude.complete({ messages: [{ role: 'user', content: prompt }] });
        setSummary(text.trim().replace(/^["']|["']$/g, ''));
      } catch (e) {/* ignore */ }
    }
  };

  const save = async () => {
    // Persist as activity log + (optional) audio blob in photo store (re-using IndexedDB blob storage)
    const fullText = transcript.trim() || '(audio only)';
    await Backend.db.activity.create({
      who: 'You',
      what: 'recorded a voice memo',
      where: projects.find(p => p.id == projectId)?.name || 'Mobile',
      when: new Date().toISOString().slice(0, 16),
      icon: 'mic',
      color: T.purple,
      note: fullText,
      duration,
    });
    if (audioBlob && window.cortexxPhotoStore) {
      try {
        await window.cortexxPhotoStore.save(audioBlob, {
          name: `voice_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}.webm`,
          projectId, tags: ['voice'],
        });
      } catch (e) {/* ignore */ }
    }
    toast('Memo saved', 'success');
    onClose();
  };

  React.useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (speechRef.current) try { speechRef.current.stop(); } catch (e) {}
    if (recRef.current && recRef.current.state !== 'inactive') try { recRef.current.stop(); } catch (e) {}
  }, []);  // eslint-disable-line

  const mmss = `${Math.floor(duration / 60).toString().padStart(2, '0')}:${(duration % 60).toString().padStart(2, '0')}`;

  return (
    <Sheet onClose={onClose} fullscreen>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderBottom: `0.5px solid ${T.hair}`,
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 15, cursor: 'pointer' }}>Close</button>
        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.t1 }}>Voice memo</div>
        <div style={{ width: 50 }}/>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 24px' }}>
        {/* Capability banner */}
        {!hasSpeech && !hasMedia && (
          <div style={{ background: `${T.red}1a`, border: `0.5px solid ${T.red}55`, borderRadius: 10, padding: 12, marginBottom: 14, fontFamily: SF, fontSize: 12, color: T.t1 }}>
            This browser/device supports neither Web Speech nor MediaRecorder. Voice memos won't work here.
          </div>
        )}
        {hasSpeech && !hasMedia && stage === 'idle' && (
          <div style={{ background: `${T.amber}14`, border: `0.5px solid ${T.amber}44`, borderRadius: 10, padding: 12, marginBottom: 14, fontFamily: SF, fontSize: 12, color: T.t1 }}>
            Real-time transcription only — your device can't save the raw audio.
          </div>
        )}

        {/* Mic button + timer */}
        <div style={{
          background: stage === 'recording' ? `linear-gradient(135deg, ${T.red}22, transparent)` : T.bg2,
          border: `0.5px solid ${stage === 'recording' ? T.red + '55' : T.hair}`,
          borderRadius: 14, padding: '22px 16px', textAlign: 'center',
        }}>
          {stage === 'idle' && (
            <>
              <button onClick={start} disabled={!hasSpeech && !hasMedia} style={{
                width: 110, height: 110, borderRadius: 55,
                background: `linear-gradient(135deg, ${T.red}, ${T.red}cc)`,
                border: 'none', color: '#fff', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 12px 30px ${T.red}55`,
              }}>{React.cloneElement(Ic.mic, { size: 44 })}</button>
              <div style={{ fontFamily: SF, fontSize: 13, color: T.t2, marginTop: 14 }}>Tap to start. Speak naturally.</div>
              <div style={{ fontFamily: SFMono, fontSize: 10, color: T.t3, marginTop: 6 }}>
                {hasSpeech ? 'Live transcription · ' : ''}{hasMedia ? 'audio saved' : ''}
              </div>
            </>
          )}

          {stage === 'recording' && (
            <>
              <div style={{ fontFamily: SFMono, fontSize: 40, fontWeight: 700, color: T.red, letterSpacing: -1, marginBottom: 18 }}>{mmss}</div>
              <button onClick={stop} style={{
                width: 110, height: 110, borderRadius: 14,
                background: `linear-gradient(135deg, ${T.red}, ${T.red}cc)`,
                border: 'none', color: '#fff', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 12px 30px ${T.red}55`,
                animation: 'pulse77 1.4s infinite',
              }}>
                <div style={{ width: 32, height: 32, background: '#fff', borderRadius: 4 }}/>
              </button>
              <div style={{ fontFamily: SF, fontSize: 12, color: T.red, fontWeight: 700, marginTop: 14, letterSpacing: 0.4 }}>● RECORDING — tap to stop</div>
            </>
          )}

          {stage === 'processing' && <ShimmerRows color={T.purple} rows={3}/>}

          {stage === 'done' && (
            <div style={{ fontFamily: SF, fontSize: 12, color: T.green, fontWeight: 600 }}>● Recorded {mmss}</div>
          )}
        </div>

        {/* Live partial */}
        {(stage === 'recording' || stage === 'done') && (transcript || partial) && (
          <div style={{ marginTop: 14, background: T.bg2, border: `0.5px solid ${T.hair}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontFamily: SF, fontSize: 11, color: T.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Transcript</div>
            <div style={{ fontFamily: SF, fontSize: 14, color: T.t1, lineHeight: 1.55 }}>
              {transcript}
              {partial && <span style={{ color: T.t3 }}> {partial}</span>}
            </div>
          </div>
        )}

        {/* Audio playback */}
        {audioUrl && stage === 'done' && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontFamily: SF, fontSize: 10.5, color: T.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 }}>Audio</div>
            <audio src={audioUrl} controls style={{ width: '100%' }}/>
          </div>
        )}

        {/* AI summary */}
        {summary && (
          <div style={{ marginTop: 14, background: `${T.purple}1a`, border: `0.5px solid ${T.purple}44`, borderRadius: 12, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ color: T.purple }}>{React.cloneElement(Ic.spark, { size: 13 })}</span>
              <span style={{ fontFamily: SF, fontSize: 11, color: T.purple, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Action items</span>
            </div>
            <div style={{ fontFamily: SF, fontSize: 13.5, color: T.t1, lineHeight: 1.45 }}>{summary}</div>
          </div>
        )}

        {errMsg && <div style={{ marginTop: 12, padding: 10, background: `${T.red}1a`, border: `0.5px solid ${T.red}55`, borderRadius: 10, fontFamily: SF, fontSize: 12, color: T.red }}>{errMsg}</div>}

        {/* Project + Save */}
        {stage === 'done' && (
          <>
            <div style={{ marginTop: 18, fontFamily: SF, fontSize: 10.5, color: T.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 }}>Project</div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              {projects.map(p => (
                <button key={p.id} onClick={() => setProjectId(p.id)} style={{
                  padding: '7px 12px', borderRadius: 14, flexShrink: 0,
                  border: `0.5px solid ${projectId === p.id ? accent : T.hair}`,
                  background: projectId === p.id ? `${accent}22` : T.bg2,
                  color: projectId === p.id ? accent : T.t2,
                  fontFamily: SF, fontSize: 12, fontWeight: 600,
                  whiteSpace: 'nowrap', cursor: 'pointer',
                }}>{p.name}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={save} style={{
                flex: 1, padding: '12px',
                background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                color: '#fff', border: 'none', borderRadius: 12,
                fontFamily: SF, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                boxShadow: `0 6px 18px ${accent}44`,
              }}>Save memo</button>
              <button onClick={() => { setStage('idle'); setTranscript(''); setAudioBlob(null); if (audioUrl) URL.revokeObjectURL(audioUrl); setAudioUrl(null); setSummary(null); setDuration(0); }} style={{
                background: 'transparent', color: T.t2, border: `0.5px solid ${T.hairMid}`,
                borderRadius: 12, padding: '12px 18px', fontFamily: SF, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Re-record</button>
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes pulse77 { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.04) } }`}</style>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────
// RECEIPT SCAN — real camera + vision OCR
// ─────────────────────────────────────────────────────────
function ReceiptScanSheetReal({ onClose, accent }) {
  const projects = useDB('projects');
  const [stage, setStage] = React.useState('pick');  // pick | scanning | result
  const [blob, setBlob] = React.useState(null);
  const [previewUrl, setPreviewUrl] = React.useState(null);
  const [data, setData] = React.useState(null);
  const [projectId, setProjectId] = React.useState(projects.find(p => p.status === 'active')?.id || projects[0]?.id || 1);
  const [err, setErr] = React.useState('');

  const fileRef = React.useRef(null);
  const pick = () => fileRef.current?.click();

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBlob(f);
    setPreviewUrl(URL.createObjectURL(f));
    setStage('scanning');
    setErr('');

    try {
      // Use Backend.vision via a custom prompt
      const prompt = `You are reading a UK trade receipt photographed on a building site. Return ONLY JSON: {"vendor":"name as printed","amount":NUMBER (total inc VAT),"vatAmount":NUMBER or null,"date":"YYYY-MM-DD or null","items":[{"d":"short","qty":NUMBER,"price":NUMBER}],"category":"Materials|Labour|Plant|Tools|Fuel|Other","confidence":0-1,"notes":"anything unclear"}. Use UK currency conventions, no £ sign in numbers. If unreadable, set confidence:0 and notes:"explanation".`;
      // Direct vision call (Backend.vision.describePhoto would discard the structure)
      const scaled = await downscale77(f);
      const img = await toImage77(scaled);
      const raw = await window.claude.complete({
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } },
          ],
        }],
      });
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('AI returned no JSON');
      const parsed = JSON.parse(m[0]);
      if (parsed.confidence === 0 || !parsed.vendor || !parsed.amount) {
        throw new Error(parsed.notes || 'Could not read this receipt clearly.');
      }
      // Auto-suggest project from the existing classifier if we have one
      const aiCat = await Backend.ai.categorizeReceipt({ vendor: parsed.vendor, amount: parsed.amount });
      setData({ ...parsed, category: parsed.category || aiCat.category, suggestedProjectId: aiCat.projectId });
      if (aiCat.projectId) setProjectId(aiCat.projectId);
      setStage('result');
    } catch (e) {
      setErr(e.message || String(e));
      setStage('pick');
    }
  };

  const save = async () => {
    await Backend.db.receipts.create({
      vendor: data.vendor,
      amount: parseFloat(data.amount),
      date: data.date || new Date().toISOString().slice(0, 10),
      vatAmount: data.vatAmount || null,
      category: data.category,
      projectId: parseInt(projectId),
      assigned: true,
      notes: data.notes || '',
      items: data.items || [],
    });
    // Also save the photo for evidence
    if (blob && window.cortexxPhotoStore) {
      try {
        await window.cortexxPhotoStore.save(blob, {
          name: `receipt_${data.vendor.replace(/\W/g, '')}_${data.amount}.jpg`,
          projectId,
          tags: ['receipt', data.category?.toLowerCase()].filter(Boolean),
        });
      } catch (e) {/* ignore */ }
    }
    toast(`Receipt saved · £${parseFloat(data.amount).toFixed(2)}`, 'success');
    onClose();
  };

  React.useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  return (
    <Sheet onClose={onClose} fullscreen>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: 'none' }}/>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderBottom: `0.5px solid ${T.hair}`,
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 15, cursor: 'pointer' }}>Close</button>
        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.t1 }}>Scan receipt</div>
        <div style={{ width: 50 }}/>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 24px' }}>
        {stage === 'pick' && (
          <>
            <button onClick={pick} style={{
              width: '100%', aspectRatio: '3 / 4', maxHeight: 400,
              background: T.bg2, border: `1.5px dashed ${T.hairStrong}`,
              borderRadius: 14, color: T.t1, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: 18,
                background: `${accent}22`, color: accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{React.cloneElement(Ic.camera, { size: 36 })}</div>
              <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 700 }}>Take or pick receipt</div>
              <div style={{ fontFamily: SF, fontSize: 11, color: T.t3, padding: '0 30px', textAlign: 'center', lineHeight: 1.5 }}>
                Hold steady, fill the frame, good light. Cortex extracts vendor, total, VAT and auto-files it.
              </div>
            </button>
            {err && <div style={{ marginTop: 12, padding: 10, background: `${T.red}1a`, border: `0.5px solid ${T.red}55`, borderRadius: 10, fontFamily: SF, fontSize: 12, color: T.red }}>{err}</div>}
          </>
        )}

        {stage === 'scanning' && previewUrl && (
          <>
            <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', marginBottom: 16, maxHeight: 280, background: '#000' }}>
              <img src={previewUrl} style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block', opacity: 0.6 }}/>
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 12,
                  background: `linear-gradient(135deg, ${T.purple}, ${accent})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'pulse77 1.4s infinite',
                }}>{React.cloneElement(Ic.spark, { size: 26 })}</div>
                <div style={{ fontFamily: SF, fontSize: 13, color: '#fff', fontWeight: 600 }}>Reading receipt…</div>
                <div style={{ fontFamily: SF, fontSize: 11, color: '#ffffffaa' }}>OCR + Cortex AI categorising</div>
              </div>
            </div>
            <ShimmerRows color={T.purple} rows={3}/>
          </>
        )}

        {stage === 'result' && data && (
          <>
            {previewUrl && (
              <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 14, maxHeight: 180, background: '#000' }}>
                <img src={previewUrl} style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }}/>
              </div>
            )}

            {/* Vendor / total */}
            <div style={{ background: T.bg2, border: `0.5px solid ${T.hair}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: SF, fontSize: 10, color: T.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Vendor</div>
                  <div style={{ fontFamily: SF, fontSize: 17, fontWeight: 600, color: T.t1, marginTop: 2 }}>{data.vendor}</div>
                  {data.date && <div style={{ fontFamily: SFMono, fontSize: 11, color: T.t3, marginTop: 4 }}>{data.date}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: SFMono, fontSize: 22, color: T.t1, fontWeight: 700, letterSpacing: -0.5 }}>£{parseFloat(data.amount).toFixed(2)}</div>
                  {data.vatAmount != null && <div style={{ fontFamily: SFMono, fontSize: 10, color: T.t3, marginTop: 2 }}>inc £{parseFloat(data.vatAmount).toFixed(2)} VAT</div>}
                </div>
              </div>
            </div>

            {/* Line items */}
            {data.items?.length > 0 && (
              <div style={{ background: T.bg2, border: `0.5px solid ${T.hair}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                <div style={{ fontFamily: SF, fontSize: 10.5, color: T.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 }}>{data.items.length} line items</div>
                {data.items.slice(0, 6).map((it, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SF, fontSize: 12, color: T.t1, padding: '4px 0' }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.d}</span>
                    <span style={{ fontFamily: SFMono, color: T.t3, marginLeft: 8 }}>{it.qty} × £{it.price?.toFixed?.(2) ?? it.price}</span>
                  </div>
                ))}
              </div>
            )}

            {/* AI suggestion */}
            <div style={{ background: `linear-gradient(135deg, ${T.purple}1a, transparent)`, border: `0.5px solid ${T.purple}44`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontFamily: SF, fontSize: 11, color: T.purple, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cortex suggests</div>
                <span style={{ fontFamily: SFMono, fontSize: 10, color: T.t2 }}>{Math.round((data.confidence ?? 0.85) * 100)}% sure</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: SF, fontSize: 12, color: T.t2, width: 60 }}>Category</span>
                <Pill c={accent}>{data.category || 'Materials'}</Pill>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: SF, fontSize: 12, color: T.t2, width: 60 }}>Project</span>
                <div style={{ display: 'flex', gap: 5, overflowX: 'auto' }}>
                  {projects.filter(p => p.status !== 'completed').map(p => (
                    <button key={p.id} onClick={() => setProjectId(p.id)} style={{
                      padding: '4px 10px', borderRadius: 12, flexShrink: 0,
                      border: `0.5px solid ${projectId === p.id ? T.cyan : T.hair}`,
                      background: projectId === p.id ? `${T.cyan}22` : T.bg2,
                      color: projectId === p.id ? T.cyan : T.t2,
                      fontFamily: SF, fontSize: 11, fontWeight: 600,
                      whiteSpace: 'nowrap', cursor: 'pointer',
                    }}>{p.name}</button>
                  ))}
                </div>
              </div>
            </div>

            {data.notes && (
              <div style={{ fontFamily: SF, fontSize: 11.5, color: T.t3, marginBottom: 12, fontStyle: 'italic' }}>{data.notes}</div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={save} style={{
                flex: 1, padding: '12px',
                background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                color: '#fff', border: 'none', borderRadius: 12,
                fontFamily: SF, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                boxShadow: `0 6px 18px ${accent}44`,
              }}>Save & file</button>
              <button onClick={pick} style={{
                background: 'transparent', color: T.t2, border: `0.5px solid ${T.hairMid}`,
                borderRadius: 12, padding: '12px 18px', fontFamily: SF, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Re-scan</button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

// helpers — duplicated lightly so 77 doesn't depend on 75's internals
async function downscale77(blob, maxDim = 1600) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      try {
        const ratio = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * ratio);
        const h = Math.round(img.naturalHeight * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob((out) => { URL.revokeObjectURL(url); resolve(out || blob); }, 'image/jpeg', 0.85);
      } catch (e) { URL.revokeObjectURL(url); resolve(blob); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
    img.src = url;
  });
}
function toImage77(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => resolve({ media_type: blob.type || 'image/jpeg', data: String(fr.result).split(',')[1] || '' });
    fr.readAsDataURL(blob);
  });
}

// ─────────────────────────────────────────────────────────
// GLOBAL SEARCH — over all DB tables
// ─────────────────────────────────────────────────────────
function GlobalSearchSheet({ onClose, accent }) {
  const [q, setQ] = React.useState('');
  const ref = React.useRef(null);
  React.useEffect(() => { setTimeout(() => ref.current?.focus(), 100); }, []);

  const snap = Backend.db.snapshot();
  const norm = q.trim().toLowerCase();
  const results = React.useMemo(() => {
    if (!norm) return [];
    const out = [];
    const push = (group, label, sub, action, icon, color) => out.push({ group, label, sub, action, icon, color });

    (snap.projects || []).forEach(p => {
      const hit = [p.name, p.client, p.address].join(' ').toLowerCase().includes(norm);
      if (hit) push('Projects', p.name, `${p.client || ''} · ${p.status || ''}`, () => window.cortexxNav('tab', 'projects'), Ic.briefcase, T.cyan);
    });
    (snap.tasks || []).forEach(t => {
      if ((t.title || '').toLowerCase().includes(norm)) push('Tasks', t.title, t.done ? 'completed' : 'open', () => window.cortexxNav('tab', 'tasks'), Ic.check, T.amber);
    });
    (snap.customers || []).forEach(c => {
      if ((c.name + ' ' + (c.email || '') + ' ' + (c.address || '')).toLowerCase().includes(norm)) {
        push('Customers', c.name, c.email || c.phone, () => window.cortexxNav('customers'), Ic.me, T.blue);
      }
    });
    (snap.quotes || []).forEach(qt => {
      if ((qt.title + ' ' + qt.client + ' ' + qt.id).toLowerCase().includes(norm)) push('Quotes', qt.title, `${qt.id} · £${(qt.total || 0).toLocaleString()}`, () => window.cortexxNav('quotes'), Ic.doc, T.purple);
    });
    (snap.invoices || []).forEach(inv => {
      if ((inv.number + ' ' + inv.client).toLowerCase().includes(norm)) push('Invoices', inv.client, `${inv.number} · £${(inv.amount || 0).toLocaleString()} · ${inv.status}`, () => window.cortexxNav('invoices'), Ic.money, T.green);
    });
    (snap.documents || []).forEach(d => {
      if ((d.name || '').toLowerCase().includes(norm)) push('Documents', d.name, `${(d.size/1000).toFixed(1)} MB · ${d.folder || ''}`, () => window.cortexxNav('docs'), Ic.doc, T.cyan);
    });
    (snap.team || []).forEach(m => {
      if ((m.n + ' ' + m.r).toLowerCase().includes(norm)) push('Team', m.n, m.r, () => window.cortexxNav('tab', 'team'), Ic.team, T.purple);
    });
    (snap.services || []).forEach(s => {
      if ((s.name || '').toLowerCase().includes(norm)) push('Services', s.name, `${s.margin}% margin · ${s.cycleDays}d cycle`, () => window.cortexxNav('services'), Ic.layers, T.amber);
    });
    (snap.improvements || []).forEach(i => {
      if ((i.title || '').toLowerCase().includes(norm)) push('Improvements', i.title, `${i.lane} · ${i.owner}`, () => window.cortexxNav('improvement', i), Ic.spark, T.purple);
    });
    return out.slice(0, 40);
  }, [norm]);

  const grouped = React.useMemo(() => {
    const g = {};
    results.forEach(r => { (g[r.group] = g[r.group] || []).push(r); });
    return g;
  }, [results]);

  return (
    <Sheet onClose={onClose} fullscreen>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', borderBottom: `0.5px solid ${T.hair}`,
      }}>
        <span style={{ color: T.t3 }}>{React.cloneElement(Ic.search, { size: 18 })}</span>
        <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search everything: projects, tasks, customers…"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: T.t1, fontFamily: SF, fontSize: 16,
          }}/>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {!norm && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: T.t3, fontFamily: SF, fontSize: 13, lineHeight: 1.5 }}>
            Start typing to search across all your data:<br/>
            projects, tasks, customers, quotes, invoices, documents, team, services, improvements.
          </div>
        )}
        {norm && results.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: T.t3, fontFamily: SF, fontSize: 13 }}>
            Nothing matches "<span style={{ color: T.t1 }}>{q}</span>".
          </div>
        )}
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group} style={{ marginBottom: 6 }}>
            <div style={{ padding: '10px 16px 4px', fontFamily: SF, fontSize: 10.5, color: T.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7 }}>{group} · {items.length}</div>
            {items.map((r, i) => (
              <div key={i} onClick={() => { r.action(); onClose(); }} style={{
                padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 11,
                cursor: 'pointer', borderBottom: `0.5px solid ${T.hair}`,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: `${r.color}22`, color: r.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>{React.cloneElement(r.icon, { size: 15 })}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: SF, fontSize: 14, color: T.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
                  <div style={{ fontFamily: SF, fontSize: 11.5, color: T.t3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sub}</div>
                </div>
                <span style={{ color: T.t3 }}>{React.cloneElement(Ic.chevR, { size: 14 })}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Sheet>
  );
}

Object.assign(window, { VoiceMemoSheetReal, ReceiptScanSheetReal, GlobalSearchSheet });
