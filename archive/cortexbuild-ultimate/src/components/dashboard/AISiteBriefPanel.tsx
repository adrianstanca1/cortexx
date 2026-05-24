import { useEffect, useMemo, useState } from 'react';
import { Sparkles, ArrowRight, ShieldAlert, ClipboardList, Wand2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { buildAISiteBrief, type BriefSeverity } from '../../lib/aiSiteBrief';
import type { Module } from '../../types';
import { useModuleNavigation } from '../../context/ModuleNavigationContext';
import { enrichSiteBrief } from '../../services/ai';

function severityStyles(s: BriefSeverity): { border: string; accent: string; bg: string } {
  switch (s) {
    case 'critical':
      return {
        border: 'rgba(239,68,68,0.35)',
        accent: '#f87171',
        bg: 'rgba(127,29,29,0.12)',
      };
    case 'attention':
      return {
        border: 'rgba(245,158,11,0.35)',
        accent: '#fbbf24',
        bg: 'rgba(120,53,15,0.15)',
      };
    default:
      return {
        border: 'rgba(59,130,246,0.25)',
        accent: '#60a5fa',
        bg: 'rgba(30,58,138,0.12)',
      };
  }
}

export interface AISiteBriefPanelProps {
  openRfis: number;
  overdueRfis: number;
  blockedTasks: number;
  redBudgetProjects: number;
  amberProgrammeProjects: number;
  openSafetyItems: number;
  activeProjects: number;
}

export function AISiteBriefPanel({
  openRfis,
  overdueRfis,
  blockedTasks,
  redBudgetProjects,
  amberProgrammeProjects,
  openSafetyItems,
  activeProjects,
}: AISiteBriefPanelProps) {
  const navigate = useModuleNavigation();
  const [polished, setPolished] = useState<{ headline: string; subline: string } | null>(null);
  const [enriching, setEnriching] = useState(false);

  const brief = useMemo(
    () =>
      buildAISiteBrief({
        openRfis,
        overdueRfis,
        blockedTasks,
        redBudgetProjects,
        amberProgrammeProjects,
        openSafetyItems,
        activeProjects,
      }),
    [
      openRfis,
      overdueRfis,
      blockedTasks,
      redBudgetProjects,
      amberProgrammeProjects,
      openSafetyItems,
      activeProjects,
    ],
  );

  useEffect(() => {
    setPolished(null);
  }, [
    openRfis,
    overdueRfis,
    blockedTasks,
    redBudgetProjects,
    amberProgrammeProjects,
    openSafetyItems,
    activeProjects,
  ]);

  const headline = polished?.headline ?? brief.headline;
  const subline = polished?.subline ?? brief.subline;

  async function handlePolishWithAi() {
    setEnriching(true);
    try {
      const stats = {
        openRfis,
        overdueRfis,
        blockedTasks,
        redBudgetProjects,
        amberProgrammeProjects,
        openSafetyItems,
        activeProjects,
      };
      const out = await enrichSiteBrief({
        headline: brief.headline,
        subline: brief.subline,
        signals: brief.signals,
        playbooks: brief.playbooks,
        stats,
      });
      setPolished({ headline: out.headline, subline: out.subline });
      if (out.source === 'ai' && !out.fallback) {
        toast.success('Brief polished with AI');
      } else {
        toast.message('Brief unchanged', { description: 'AI returned heuristic copy — check API keys or try again.' });
      }
    } catch (e) {
      toast.error((e as Error).message || 'Could not polish brief');
    } finally {
      setEnriching(false);
    }
  }

  return (
    <section
      className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[rgba(15,23,42,0.92)] via-[rgba(13,17,23,0.88)] to-[rgba(15,23,42,0.75)] p-5 shadow-[0_16px_48px_rgba(0,0,0,0.45)] backdrop-blur-md"
      aria-labelledby="ai-site-brief-heading"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-400/90">
              AI site brief
            </span>
          </div>
          <h2
            id="ai-site-brief-heading"
            className="font-display text-xl font-bold tracking-tight text-slate-100 md:text-2xl"
          >
            {headline}
          </h2>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-400">{subline}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
          <button
            type="button"
            className="btn btn-secondary inline-flex items-center gap-2 text-xs"
            disabled={enriching}
            onClick={() => void handlePolishWithAi()}
            title="Sharpen headline and subline with your configured AI providers"
          >
            {enriching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Wand2 className="h-3.5 w-3.5" aria-hidden />
            )}
            Polish with AI
          </button>
          <button
            type="button"
            className="btn btn-secondary inline-flex items-center gap-2 text-xs"
            onClick={() => navigate('ai-assistant')}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Open AI assistant
          </button>
          <button
            type="button"
            className="btn btn-secondary inline-flex items-center gap-2 text-xs"
            onClick={() => navigate('insights')}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Insights engine
          </button>
        </div>
      </div>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {brief.signals.map((sig) => {
          const st = severityStyles(sig.severity);
          return (
            <li
              key={sig.id}
              className="rounded-xl border p-4 transition hover:brightness-110"
              style={{ borderColor: st.border, background: st.bg }}
            >
              <div className="mb-1 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" style={{ color: st.accent }} aria-hidden />
                <span className="text-sm font-semibold text-slate-100">{sig.title}</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">{sig.detail}</p>
              {sig.navigateTo && (
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-amber-400/90 hover:text-amber-300"
                  onClick={() => navigate(sig.navigateTo as Module)}
                >
                  Go to module
                  <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-5 rounded-xl border border-white/[0.06] bg-black/20 p-4">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">
          Shift playbooks
        </p>
        <ol className="list-decimal space-y-1.5 pl-4 text-sm text-slate-300">
          {brief.playbooks.map((line) => (
            <li key={line} className="leading-snug">
              {line}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
