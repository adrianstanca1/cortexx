/**
 * CortexBuild Ultimate — Keyboard Shortcuts Help Modal
 * Construction-themed: blueprint grid, amber accents, steel undertones
 */
import { useEffect, useRef } from 'react';
import { X, Keyboard, Compass, Wrench, FolderOpen, Calculator, Zap } from 'lucide-react';
import { DEFAULT_SHORTCUTS } from '../../hooks/useKeyboardShortcuts';

interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

// Extended shortcut groups with icons
const SHORTCUT_GROUPS = [
  {
    id: 'navigation',
    title: 'Navigation',
    icon: Compass,
    color: '#f59e0b',
    shortcuts: [
      DEFAULT_SHORTCUTS.goToDashboard,
      DEFAULT_SHORTCUTS.goToProjects,
      DEFAULT_SHORTCUTS.goToInvoicing,
      DEFAULT_SHORTCUTS.goToSafety,
      DEFAULT_SHORTCUTS.goToSettings,
    ],
  },
  {
    id: 'actions',
    title: 'Actions',
    icon: Wrench,
    color: '#f59e0b',
    shortcuts: [
      DEFAULT_SHORTCUTS.newProject,
      DEFAULT_SHORTCUTS.newInvoice,
      DEFAULT_SHORTCUTS.commandPalette,
      DEFAULT_SHORTCUTS.search,
      DEFAULT_SHORTCUTS.toggleSidebar,
    ],
  },
  {
    id: 'projects',
    title: 'Project Management',
    icon: FolderOpen,
    color: '#f59e0b',
    shortcuts: [
      { key: 'e', ctrl: true, description: 'Edit Project' },
      { key: 'd', ctrl: true, description: 'Duplicate Project' },
      { key: 'Del', ctrl: true, description: 'Delete Selected' },
      { key: 'Enter', ctrl: false, description: 'Open Selected' },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    icon: Calculator,
    color: '#f59e0b',
    shortcuts: [
      { key: 'p', ctrl: true, description: 'Mark as Paid' },
      { key: 'c', ctrl: true, description: 'Clone Invoice' },
      { key: 'r', ctrl: true, description: 'Export Report' },
    ],
  },
  {
    id: 'help',
    title: 'Help',
    icon: Zap,
    color: '#f59e0b',
    shortcuts: [
      DEFAULT_SHORTCUTS.showHelp,
      { key: 'Esc', ctrl: false, description: 'Close Panel / Cancel' },
    ],
  },
];

const MODAL_WIDTH = 680;
const MODAL_MAX_HEIGHT = 720;

export function ShortcutsHelp({ isOpen, onClose }: ShortcutsHelpProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Trap focus inside modal when open
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formattedKey = (shortcut: { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean }) => {
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
    if (key === 'Escape') key = 'Esc';
    if (key === 'Delete') key = 'Del';
    if (key === 'Backspace') key = '⌫';
    if (key === 'Enter') key = '↵';
    parts.push(key.toUpperCase());

    return parts.join('');
  };

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        animation: 'shortcutsOverlayFadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        style={{
          width: '100%',
          maxWidth: MODAL_WIDTH,
          maxHeight: MODAL_MAX_HEIGHT,
          background: '#0d1117',
          borderRadius: '16px',
          border: '1px solid #2a3441',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,158,11,0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'shortcutsModalIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          outline: 'none',
          position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Blueprint grid background layer */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(245,158,11,0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(245,158,11,0.04) 1px, transparent 1px),
              linear-gradient(rgba(245,158,11,0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(245,158,11,0.02) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px, 40px 40px, 8px 8px, 8px 8px',
            pointerEvents: 'none',
            borderRadius: '16px',
          }}
        />

        {/* Header */}
        <div
          style={{
            padding: '24px 28px 20px',
            borderBottom: '1px solid #1e2530',
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Icon badge */}
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(245,158,11,0.08) 100%)',
                border: '1px solid rgba(245,158,11,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(245,158,11,0.1)',
              }}
            >
              <Keyboard size={22} color="#f59e0b" />
            </div>
            <div>
              <h2
                style={{
                  fontFamily: "'Syne', sans-serif",
                  fontWeight: 700,
                  fontSize: '20px',
                  color: '#e8eaf0',
                  letterSpacing: '-0.01em',
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                Keyboard Shortcuts
              </h2>
              <p
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px',
                  color: '#5a6577',
                  margin: '3px 0 0',
                  letterSpacing: '0.02em',
                }}
              >
                Work faster — press keys to navigate
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close shortcuts"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: '1px solid #2a3441',
              background: '#131a24',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#5a6577',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#1e2530';
              e.currentTarget.style.color = '#e8eaf0';
              e.currentTarget.style.borderColor = '#3a4555';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#131a24';
              e.currentTarget.style.color = '#5a6577';
              e.currentTarget.style.borderColor = '#2a3441';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Shortcuts body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 28px 24px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700&family=JetBrains+Mono:wght@400;500&display=swap');
            @keyframes shortcutsOverlayFadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes shortcutsModalIn {
              from { opacity: 0; transform: scale(0.92) translateY(8px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
            @keyframes amberPulse {
              0%, 100% { box-shadow: 0 0 6px rgba(245,158,11,0.3); }
              50% { box-shadow: 0 0 14px rgba(245,158,11,0.5); }
            }
            .shortcuts-modal-scroll::-webkit-scrollbar {
              width: 6px;
            }
            .shortcuts-modal-scroll::-webkit-scrollbar-track {
              background: #0d1117;
            }
            .shortcuts-modal-scroll::-webkit-scrollbar-thumb {
              background: #2a3441;
              border-radius: 3px;
            }
            .shortcuts-modal-scroll::-webkit-scrollbar-thumb:hover {
              background: #3a4555;
            }
            .shortcut-row:hover .key-cap {
              border-color: rgba(245,158,11,0.5) !important;
              box-shadow: 0 0 8px rgba(245,158,11,0.2), inset 0 1px 0 rgba(255,255,255,0.08) !important;
            }
            .shortcut-row:hover {
              background: rgba(245,158,11,0.04) !important;
            }
            .group-divider {
              height: 1px;
              background: linear-gradient(90deg, transparent, rgba(245,158,11,0.2) 20%, rgba(245,158,11,0.2) 80%, transparent);
              margin: 4px 0;
            }
          `}</style>

          <div
            className="shortcuts-modal-scroll"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0 32px',
              maxHeight: '520px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            {SHORTCUT_GROUPS.map((group, groupIdx) => {
              const Icon = group.icon;
              return (
                <div key={group.id} style={{ marginBottom: groupIdx < SHORTCUT_GROUPS.length - 1 ? '20px' : 0 }}>
                  {/* Group header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '10px',
                    }}
                  >
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        background: 'rgba(245,158,11,0.12)',
                        border: '1px solid rgba(245,158,11,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={13} color="#f59e0b" />
                    </div>
                    <span
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        fontWeight: 700,
                        fontSize: '11px',
                        color: '#f59e0b',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {group.title}
                    </span>
                  </div>

                  {/* Amber divider */}
                  <div className="group-divider" style={{ marginBottom: '10px' }} />

                  {/* Shortcut rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {group.shortcuts.map((shortcut, idx) => (
                      <div
                        key={idx}
                        className="shortcut-row"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: '1px solid transparent',
                          transition: 'all 0.12s ease',
                          cursor: 'default',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '12px',
                            color: '#8b95a5',
                            lineHeight: 1,
                          }}
                        >
                          {shortcut.description}
                        </span>
                        <span
                          className="key-cap"
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 500,
                            fontSize: '11px',
                            color: '#c8d0dc',
                            background: 'linear-gradient(180deg, #1a2332 0%, #141c28 100%)',
                            border: '1px solid #2e3a4a',
                            borderBottomWidth: '2px',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            minWidth: '52px',
                            textAlign: 'center',
                            letterSpacing: '0.02em',
                            transition: 'all 0.12s ease',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 3px rgba(0,0,0,0.3)',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          {formattedKey(shortcut)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 28px',
            borderTop: '1px solid #1e2530',
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              color: '#3e4a5a',
              letterSpacing: '0.01em',
            }}
          >
            Press
          </span>
          <span
            className="key-cap"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 500,
              fontSize: '10px',
              color: '#c8d0dc',
              background: 'linear-gradient(180deg, #1a2332 0%, #141c28 100%)',
              border: '1px solid #2e3a4a',
              borderBottomWidth: '2px',
              borderRadius: '5px',
              padding: '2px 7px',
              letterSpacing: '0.02em',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 3px rgba(0,0,0,0.3)',
            }}
          >
            ?
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              color: '#3e4a5a',
              letterSpacing: '0.01em',
            }}
          >
            anytime to show this help ·&nbsp;
          </span>
          <span
            className="key-cap"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 500,
              fontSize: '10px',
              color: '#c8d0dc',
              background: 'linear-gradient(180deg, #1a2332 0%, #141c28 100%)',
              border: '1px solid #2e3a4a',
              borderBottomWidth: '2px',
              borderRadius: '5px',
              padding: '2px 7px',
              letterSpacing: '0.02em',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 3px rgba(0,0,0,0.3)',
            }}
          >
            Esc
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              color: '#3e4a5a',
              letterSpacing: '0.01em',
            }}
          >
            to close
          </span>
        </div>
      </div>
    </div>
  );
}
