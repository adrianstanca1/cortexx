import { useState, useRef } from 'react';
import { Plus, CheckCircle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { offlineFetch } from '../../services/offlineFetch';

interface DefectItem {
  id: number;
  title: string;
  location: string;
  status: 'open' | 'in-progress' | 'closed';
  assignee?: string;
}

const STATUS_COLOR: Record<DefectItem['status'], string> = {
  open:          'bg-red-500',
  'in-progress': 'bg-amber-500',
  closed:        'bg-emerald-500',
};

export default function MobilePunchList() {
  const [items, setItems] = useState<DefectItem[]>([
    { id: 1, title: 'Cracked render — Grid B2', location: 'Block C L2', status: 'open' },
    { id: 2, title: 'Door alignment — Rm 204',  location: 'Block C L2', status: 'in-progress', assignee: 'TM' },
    { id: 3, title: 'Paint touch-up — Corridor A', location: 'Block C L1', status: 'closed' },
  ]);
  const [showAdd,   setShowAdd]  = useState(false);
  const [newTitle,  setNewTitle] = useState('');
  const startX = useRef<number>(0);

  const swipeClose = async (id: number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'closed' as const } : i));
    await offlineFetch(`/api/defects/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'closed' }) });
    toast.success('Marked closed');
  };

  const addDefect = async () => {
    if (!newTitle.trim()) return;
    const item: DefectItem = { id: Date.now(), // local-only id, collision risk negligible
      title: newTitle, location: 'New', status: 'open' };
    setItems(p => [item, ...p]);
    await offlineFetch('/api/defects', { method: 'POST', body: JSON.stringify({ title: newTitle, status: 'open' }) });
    setNewTitle(''); setShowAdd(false);
    toast.success('Defect added');
  };

  return (
    <div className="p-4 max-w-lg mx-auto space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-100">Punch List</h2>
        <div className="flex gap-2 text-xs text-slate-400">
          <span className="bg-red-900/40 text-red-300 px-2 py-0.5 rounded-full">
            {items.filter(i => i.status === 'open').length} open
          </span>
          <span className="bg-emerald-900/40 text-emerald-300 px-2 py-0.5 rounded-full">
            {items.filter(i => i.status === 'closed').length} closed
          </span>
        </div>
      </div>

      {items.map(item => (
        <div key={item.id} className="bg-slate-800 rounded-2xl p-3.5 flex items-start gap-3"
          onTouchStart={e => { startX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            const dx = e.changedTouches[0].clientX - startX.current;
            if (dx > 80 && item.status !== 'closed') void swipeClose(item.id);
          }}>
          <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${STATUS_COLOR[item.status]}`} />
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-medium ${item.status === 'closed' ? 'line-through text-slate-500' : 'text-slate-100'}`}>
              {item.title}
            </div>
            <div className="text-slate-500 text-xs mt-0.5">
              {item.location}{item.assignee ? ` · ${item.assignee}` : ''}
            </div>
          </div>
          {item.status !== 'closed'
            ? <button type="button" onClick={() => void swipeClose(item.id)} className="p-1">
                <CheckCircle size={18} className="text-slate-600 hover:text-emerald-400" />
              </button>
            : <RotateCcw size={16} className="text-slate-600 mt-1" />}
        </div>
      ))}

      {showAdd ? (
        <div className="space-y-2">
          <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="Defect description…"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-slate-100 text-sm" />
          <div className="flex gap-2">
            <button type="button" onClick={() => void addDefect()} className="flex-1 bg-amber-600 rounded-xl py-2.5 text-white text-sm font-semibold">Add</button>
            <button type="button" onClick={() => setShowAdd(false)} className="flex-1 bg-slate-700 rounded-xl py-2.5 text-slate-300 text-sm">Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowAdd(true)}
          className="w-full bg-amber-700/30 border border-amber-700 rounded-2xl py-3 flex items-center justify-center gap-2 text-amber-300 font-semibold active:scale-95 transition-all">
          <Plus size={16} /> Add Defect
        </button>
      )}
      <p className="text-slate-600 text-xs text-center">Swipe right on a card to close it</p>
    </div>
  );
}
