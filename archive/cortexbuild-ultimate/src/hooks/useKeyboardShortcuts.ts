/**
 * CortexBuild Ultimate — Keyboard Shortcuts Hook
 * Global keyboard shortcuts for power users
 */
import { useEffect, useCallback } from 'react';

type ShortcutHandler = () => void;

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: ShortcutHandler;
  description: string;
  scope?: string;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    // Ignore plain typing in inputs — but still allow modifier chords (⌘/Ctrl+K, etc.)
    // inside command palette / global search so users can toggle overlays without blur.
    const inChromeOverlay = Boolean(target.closest?.('[data-allow-chrome-shortcuts]'));
    const isTypingSurface =
      target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    // Only lift the input guard for OS-style chords (⌘/Ctrl). Alt+letter stays ignored in fields
    // to avoid breaking locale/compose typing; Shift-only chords likewise stay ignored.
    const hasOsChord = e.ctrlKey || e.metaKey;
    if (isTypingSurface && !(inChromeOverlay && hasOsChord)) {
      return;
    }

    for (const shortcut of shortcuts) {
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase() ||
                       e.code.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey;
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = shortcut.alt ? e.altKey : !e.altKey;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        e.preventDefault();
        shortcut.handler();
        break;
      }
    }
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Default shortcuts for the app
export const DEFAULT_SHORTCUTS = {
  // Navigation
  goToDashboard: { key: '1', ctrl: true, description: 'Go to Dashboard' },
  goToProjects: { key: '2', ctrl: true, description: 'Go to Projects' },
  goToInvoicing: { key: '3', ctrl: true, description: 'Go to Invoicing' },
  goToSafety: { key: '4', ctrl: true, description: 'Go to Safety' },
  goToSettings: { key: ',', ctrl: true, description: 'Go to Settings' },
  goToAnalytics: { key: '5', ctrl: true, description: 'Go to Analytics' },
  goToCalendar: { key: '6', ctrl: true, description: 'Go to Calendar' },

  // Actions
  newProject: { key: 'n', ctrl: true, shift: true, description: 'New Project' },
  newInvoice: { key: 'i', ctrl: true, description: 'New Invoice' },
  /** Command palette — plain ⌘/Ctrl+K (matches common desktop apps) */
  commandPalette: { key: 'k', ctrl: true, description: 'Command palette' },
  /** Full-screen global search — ⌘/Ctrl+Shift+K to avoid colliding with command palette */
  search: { key: 'k', ctrl: true, shift: true, description: 'Global search' },

  // Quick navigation
  toggleSidebar: { key: 'b', ctrl: true, description: 'Toggle Sidebar' },

  // New Features (v3.0.0)
  openNotifications: { key: 'n', alt: true, description: 'Open Notifications' },
  openTeamChat: { key: 't', ctrl: true, description: 'Open Team Chat' },
  openActivityFeed: { key: 'a', ctrl: true, shift: true, description: 'Open Activity Feed' },

  // Help
  showHelp: { key: '?', shift: true, description: 'Show Shortcuts' },
};

export function formatShortcut(shortcut: { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean }): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push('⌘');
  if (shortcut.alt) parts.push('⌥');
  if (shortcut.shift) parts.push('⇧');
  
  let key = shortcut.key;
  if (key === ' ') key = 'Space';
  if (key === 'ArrowUp') key = '↑';
  if (key === 'ArrowDown') key = '↓';
  if (key === 'ArrowLeft') key = '←';
  if (key === 'ArrowRight') key = '→';
  
  parts.push(key.length === 1 ? key.toUpperCase() : key);
  return parts.join('');
}
