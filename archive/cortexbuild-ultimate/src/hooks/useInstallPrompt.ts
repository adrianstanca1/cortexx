import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner]   = useState(false);

  useEffect(() => {
    const visits = Number(localStorage.getItem('cortexbuild_visits') ?? 0) + 1;
    localStorage.setItem('cortexbuild_visits', String(visits));

    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
      if (visits >= 2 && !localStorage.getItem('cortexbuild_install_dismissed')) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'dismissed') localStorage.setItem('cortexbuild_install_dismissed', '1');
    setShowBanner(false);
    setPromptEvent(null);
  };

  const dismiss = () => {
    localStorage.setItem('cortexbuild_install_dismissed', '1');
    setShowBanner(false);
  };

  // iOS Safari detection
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const showIosBanner = isIos && !isStandalone && !localStorage.getItem('cortexbuild_install_dismissed');

  return { showBanner: showBanner || showIosBanner, isIos, install, dismiss };
}
