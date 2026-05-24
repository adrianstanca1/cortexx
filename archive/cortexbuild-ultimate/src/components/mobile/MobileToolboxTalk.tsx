import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { offlineFetch } from '../../services/offlineFetch';

const TEAM = ['JD', 'TM', 'RK', 'AL', 'PB', 'MM', 'SW', 'EO'];

export default function MobileToolboxTalk() {
  const [topic,   setTopic]   = useState('Working at Height — MEWP Safety');
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [signing, setSigning] = useState<string | null>(null);
  const [sigs,    setSigs]    = useState<Record<string, string>>({});
  const [saving,  setSaving]  = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing   = useRef(false);

  const togglePresent = (init: string) =>
    setPresent(prev => {
      const n = new Set(prev);
      if (n.has(init)) { n.delete(init); } else { n.add(init); }
      return n;
    });

  const startSign = (init: string) => {
    setSigning(init);
    setTimeout(() => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
      ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2;
    }, 50);
  };

  const canvasDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (e.type === 'pointerdown')                           { drawing.current = true; ctx.beginPath(); ctx.moveTo(x, y); }
    else if (e.type === 'pointermove' && drawing.current)   { ctx.lineTo(x, y); ctx.stroke(); }
    else                                                     { drawing.current = false; }
  };

  const saveSig = () => {
    if (!signing || !canvasRef.current) return;
    setSigs(p => ({ ...p, [signing]: canvasRef.current!.toDataURL() }));
    setSigning(null);
  };

  const handleSubmit = async () => {
    if (present.size === 0) { toast.error('Mark at least one attendee'); return; }
    setSaving(true);
    try {
      await offlineFetch('/api/toolbox-talks', {
        method: 'POST',
        body: JSON.stringify({
          topic, date: new Date().toISOString().slice(0, 10),
          attendees: Array.from(present), signatures: sigs,
          cdm_reference: 'CDM 2015 Reg 15 / HSE INDG401',
        }),
      });
      toast.success('Toolbox talk recorded');
      setPresent(new Set()); setSigs({});
    } finally { setSaving(false); }
  };

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 className="text-lg font-bold text-slate-100">Toolbox Talk</h2>

      <div>
        <label className="text-slate-400 text-xs mb-1 block">Topic</label>
        <input value={topic} onChange={e => setTopic(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-slate-100 text-sm" />
        <div className="text-slate-600 text-xs mt-1">CDM 2015 Reg 15 / HSE INDG401</div>
      </div>

      <div>
        <div className="text-slate-400 text-xs mb-2">Attendance — {present.size}/{TEAM.length}</div>
        <div className="flex flex-wrap gap-2">
          {TEAM.map(init => (
            <button type="button" key={init} onClick={() => togglePresent(init)}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                sigs[init]        ? 'bg-blue-600 border-2 border-blue-400 text-white'
                : present.has(init) ? 'bg-blue-700 border-2 border-blue-500 text-white'
                : 'bg-slate-700 border-2 border-slate-600 text-slate-400'}`}>
              {init}
            </button>
          ))}
        </div>
        {present.size > 0 && (
          <button type="button" onClick={() => startSign(Array.from(present).find(i => !sigs[i]) ?? '')}
            className="mt-3 text-blue-400 text-sm underline">
            ✍️ Capture signatures on screen
          </button>
        )}
      </div>

      {signing && (
        <div className="fixed inset-0 bg-black/70 z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl p-4 w-full max-w-sm space-y-3">
            <div className="text-slate-100 font-semibold text-center">Sign here — {signing}</div>
            <canvas ref={canvasRef} width={320} height={160}
              className="bg-slate-900 rounded-xl w-full touch-none"
              onPointerDown={canvasDraw} onPointerMove={canvasDraw} onPointerUp={canvasDraw}
              onPointerLeave={() => { drawing.current = false; }}
              onPointerCancel={() => { drawing.current = false; }} />
            <div className="flex gap-2">
              <button type="button" onClick={saveSig} className="flex-1 bg-blue-600 rounded-xl py-2.5 text-white font-semibold">Save</button>
              <button type="button" onClick={() => setSigning(null)} className="flex-1 bg-slate-700 rounded-xl py-2.5 text-slate-300">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <button type="button" onClick={() => void handleSubmit()} disabled={saving}
        className="w-full bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 rounded-2xl py-3.5 text-white font-bold active:scale-95 transition-all">
        {saving ? 'Saving…' : 'Close & Submit Briefing'}
      </button>
    </div>
  );
}
