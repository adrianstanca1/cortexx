import { useState, useEffect } from 'react';
import { MapPin, Camera, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { offlineFetch } from '../../services/offlineFetch';
import { getCurrentPosition } from '../../lib/native/geolocation';

type Severity = 'near-miss' | 'injury' | 'critical';

const SEVERITIES = [
  { id: 'near-miss' as Severity, label: 'Near Miss', emoji: '💛', bg: 'bg-amber-900/40', border: 'border-amber-600', text: 'text-amber-300' },
  { id: 'injury'    as Severity, label: 'Injury',    emoji: '🔴', bg: 'bg-red-900/60',   border: 'border-red-500',   text: 'text-red-300'   },
  { id: 'critical'  as Severity, label: 'Critical',  emoji: '⬛', bg: 'bg-slate-900',    border: 'border-slate-600', text: 'text-slate-400' },
];

export default function MobileSafetyIncident() {
  const [step,    setStep]   = useState(0);
  const [severity, setSev]   = useState<Severity | null>(null);
  const [location, setLoc]   = useState('');
  const [photo,    setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving,   setSaving] = useState(false);

  // Fix 5: Create blob URL in effect to avoid leaking a new URL on every render
  useEffect(() => {
    if (!photo) { setPhotoUrl(null); return; }
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const getGPS = async () => {
    // Snapshot current location so we don't clobber a manually-typed value
    // when the async GPS lookup resolves later (race: user starts typing, GPS fails).
    const before = location;
    try {
      const pos = await getCurrentPosition();
      // Only overwrite if user hasn't typed something else in the meantime.
      setLoc((current) =>
        current === before || current === '' || current.startsWith('GPS ')
          ? `GPS ${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)}`
          : current,
      );
    } catch {
      // GPS unavailable — only show the helper hint if the field is still empty.
      // Don't overwrite anything the user typed manually.
      setLoc((current) => (current === '' ? 'Location unavailable — enter manually' : current));
    }
  };

  const handleSubmit = async () => {
    if (!severity) return;
    setSaving(true);
    try {
      const result = await offlineFetch('/api/safety/incidents', {
        method: 'POST',
        body: JSON.stringify({ severity, location, reported_at: new Date().toISOString(), has_photo: !!photo }),
      });
      toast.success((result as { queued?: boolean }).queued
        ? 'Incident saved — supervisor notified on reconnect'
        : 'Incident reported — supervisor notified');
      setStep(0); setSev(null); setLoc(''); setPhoto(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={20} className="text-red-400" />
        <h2 className="text-lg font-bold text-slate-100">Safety Incident</h2>
        <span className="ml-auto text-slate-500 text-xs">Step {step + 1}/3</span>
      </div>

      {step === 0 && (
        <div className="space-y-3">
          <p className="text-slate-400 text-sm">What type of incident?</p>
          {SEVERITIES.map(s => (
            <button type="button" key={s.id} onClick={() => { setSev(s.id); setStep(1); getGPS(); }}
              className={`w-full ${s.bg} border-2 ${s.border} rounded-2xl p-4 flex items-center gap-4 active:scale-95 transition-all`}>
              <span className="text-2xl">{s.emoji}</span>
              <span className={`text-lg font-bold ${s.text}`}>{s.label}</span>
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <p className="text-slate-400 text-sm">Where did it happen?</p>
          <div className="flex gap-2">
            <input value={location} onChange={e => setLoc(e.target.value)} placeholder="Grid ref or description"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-slate-100 text-sm" />
            <button type="button" onClick={getGPS} className="bg-blue-700 rounded-xl px-3 flex items-center" title="Use GPS">
              <MapPin size={18} className="text-white" />
            </button>
          </div>
          <button type="button" onClick={() => setStep(2)} className="w-full bg-slate-700 rounded-xl py-3 text-slate-200 font-medium">
            Next →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-slate-400 text-sm">Add photo evidence (optional)</p>
          <label className="block bg-slate-800 border-2 border-dashed border-slate-600 rounded-2xl p-6 text-center cursor-pointer">
            {photoUrl
              ? <img src={photoUrl} alt="" className="mx-auto max-h-32 rounded-lg object-cover" />
              : <><Camera size={28} className="mx-auto text-slate-500 mb-2" /><span className="text-slate-400 text-sm">Tap to add photo</span></>}
            <input type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => e.target.files?.[0] && setPhoto(e.target.files[0])} />
          </label>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-2xl py-4 text-white text-base font-bold active:scale-95 transition-all">
            {saving ? 'Reporting…' : '🚨 Report Now'}
          </button>
          <p className="text-slate-500 text-xs text-center">Supervisor notified instantly</p>
        </div>
      )}
    </div>
  );
}
