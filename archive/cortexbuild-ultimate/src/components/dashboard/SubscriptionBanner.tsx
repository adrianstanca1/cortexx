import React from 'react';

/**
 * Optional ribbon: product is free — no upgrade path.
 * If `show` is false, renders nothing. Legacy `tier` / `onUpgrade` ignored.
 */
interface SubscriptionBannerProps {
  /** @deprecated kept for call-site compatibility */
  tier?: string;
  /** @deprecated no-op */
  onUpgrade?: () => void;
  show?: boolean;
}

export function SubscriptionBanner({ show = true }: SubscriptionBannerProps) {
  if (!show) return null;

  return (
    <div className="bg-gradient-to-r from-emerald-700/90 to-teal-700/90 text-white px-4 py-3 rounded-lg shadow-sm border border-emerald-500/30">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Full product — no subscription</p>
            <p className="text-xs opacity-90 truncate">
              CortexBuild Ultimate includes AI assistant, insights, and all modules. Focus on delivery, not billing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
