/**
 * Cortexx — Native Bridge
 *
 * This file is injected into the WKWebView BEFORE the app boots.
 * It wires all Capacitor 6 plugins to the global `window.CortexxNative`
 * object so the React app can call native APIs without importing Capacitor
 * directly (keeping the web build portable).
 *
 * Usage in any screen:
 *   const cam = await window.CortexxNative.camera.takePhoto();
 *   const loc = await window.CortexxNative.geo.getCurrentPosition();
 *   await window.CortexxNative.haptics.impact('medium');
 *   const ok  = await window.CortexxNative.biometric.authenticate('Unlock Cortexx');
 */

(function () {
  'use strict';

  // Guard — only wire up when running inside Capacitor
  if (!window.Capacitor) return;

  const { Plugins } = window.Capacitor;
  const {
    Camera,
    Geolocation,
    Haptics,
    LocalNotifications,
    PushNotifications,
    Share,
    Filesystem,
    Preferences,
    Network,
    Device,
    App,
    SplashScreen,
    StatusBar,
    Keyboard,
    Toast,
    Dialog,
    Clipboard,
    ScreenOrientation,
    // Custom plugins
    CortexxBiometric,
    CortexxSpeech,
    CortexxDeepLink,
    CortexxHaptics,
  } = Plugins;

  // ── Camera ──────────────────────────────────────────────────────
  const camera = {
    takePhoto: async (opts = {}) => {
      const { Camera: CameraResultType, CameraSource } = await import('@capacitor/camera');
      return Camera.getPhoto({
        quality: opts.quality ?? 85,
        allowEditing: opts.allowEditing ?? false,
        resultType: CameraResultType?.DataUrl ?? 'dataUrl',
        source: opts.source ?? (CameraSource?.Camera ?? 'CAMERA'),
        saveToGallery: opts.saveToGallery ?? false,
        width: opts.width ?? 1920,
        height: opts.height ?? 1920,
        correctOrientation: true,
      });
    },
    pickFromGallery: async (opts = {}) => {
      const { Camera: CameraResultType, CameraSource } = await import('@capacitor/camera');
      return Camera.getPhoto({
        quality: opts.quality ?? 85,
        allowEditing: false,
        resultType: CameraResultType?.DataUrl ?? 'dataUrl',
        source: CameraSource?.Photos ?? 'PHOTOS',
      });
    },
  };

  // ── Geolocation ─────────────────────────────────────────────────
  const geo = {
    getCurrentPosition: async (opts = {}) => {
      return Geolocation.getCurrentPosition({
        enableHighAccuracy: opts.highAccuracy ?? true,
        timeout: opts.timeout ?? 10000,
        maximumAge: opts.maximumAge ?? 0,
      });
    },
    watchPosition: (opts = {}, callback) => {
      return Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10000 },
        callback
      );
    },
    clearWatch: (id) => Geolocation.clearWatch({ id }),
  };

  // ── Haptics ─────────────────────────────────────────────────────
  const haptics = {
    impact: async (style = 'medium') => {
      if (CortexxHaptics) return CortexxHaptics.impact({ style });
      return Haptics?.impact({ style: style.toUpperCase() });
    },
    notification: async (type = 'success') => {
      if (CortexxHaptics) return CortexxHaptics.notification({ type });
      return Haptics?.notification({ type: type.toUpperCase() });
    },
    selection: async () => {
      if (CortexxHaptics) return CortexxHaptics.selection();
      return Haptics?.selectionStart();
    },
    pattern: async (name) => {
      if (CortexxHaptics) return CortexxHaptics.pattern({ name });
    },
  };

  // ── Biometrics ──────────────────────────────────────────────────
  const biometric = {
    isAvailable: async () => {
      if (!CortexxBiometric) return { isAvailable: false, biometryType: 'none' };
      return CortexxBiometric.isAvailable();
    },
    authenticate: async (reason = 'Unlock Cortexx') => {
      if (!CortexxBiometric) return { success: false, errorMessage: 'Not available' };
      return CortexxBiometric.authenticate({ reason });
    },
    authenticateWithFallback: async (reason = 'Unlock Cortexx') => {
      if (!CortexxBiometric) return { success: false, errorMessage: 'Not available' };
      return CortexxBiometric.authenticateWithPasscodeFallback({ reason });
    },
  };

  // ── Speech recognition ──────────────────────────────────────────
  const speech = {
    requestPermission: async () => {
      if (!CortexxSpeech) return { granted: false };
      return CortexxSpeech.requestPermission();
    },
    start: async (locale = 'en-GB') => {
      if (!CortexxSpeech) throw new Error('Speech not available');
      return CortexxSpeech.start({ locale });
    },
    stop: async () => {
      if (!CortexxSpeech) return;
      return CortexxSpeech.stop();
    },
    onPartialResult: (cb) => {
      if (!CortexxSpeech) return () => {};
      const handle = CortexxSpeech.addListener('partialResult', cb);
      return () => handle.remove();
    },
    onFinalResult: (cb) => {
      if (!CortexxSpeech) return () => {};
      const handle = CortexxSpeech.addListener('finalResult', cb);
      return () => handle.remove();
    },
  };

  // ── Local notifications ─────────────────────────────────────────
  const notifications = {
    requestPermission: async () => LocalNotifications?.requestPermissions(),
    schedule: async (opts) => {
      return LocalNotifications?.schedule({
        notifications: [{
          id: opts.id ?? Math.floor(Math.random() * 1e9),
          title: opts.title,
          body: opts.body,
          schedule: opts.at ? { at: new Date(opts.at) } : { at: new Date(Date.now() + 5000) },
          sound: opts.sound ?? 'default',
          smallIcon: 'ic_stat_icon',
          iconColor: '#2563eb',
          extra: opts.extra ?? null,
        }],
      });
    },
    cancel: async (id) => LocalNotifications?.cancel({ notifications: [{ id }] }),
  };

  // ── Push notifications ──────────────────────────────────────────
  const push = {
    register: async () => PushNotifications?.register(),
    onToken: (cb) => {
      const handle = PushNotifications?.addListener('registration', cb);
      return () => handle?.remove();
    },
    onNotification: (cb) => {
      const handle = PushNotifications?.addListener('pushNotificationReceived', cb);
      return () => handle?.remove();
    },
    onAction: (cb) => {
      const handle = PushNotifications?.addListener('pushNotificationActionPerformed', cb);
      return () => handle?.remove();
    },
  };

  // ── Share sheet ─────────────────────────────────────────────────
  const share = {
    share: async (opts) => Share?.share(opts),
    canShare: async () => Share?.canShare(),
  };

  // ── Filesystem ──────────────────────────────────────────────────
  const fs = {
    writeFile: async (path, data, opts = {}) => {
      const { Directory } = await import('@capacitor/filesystem');
      return Filesystem?.writeFile({
        path,
        data,
        directory: opts.directory ?? Directory.Documents,
        encoding: opts.encoding ?? 'utf8',
        recursive: opts.recursive ?? true,
      });
    },
    readFile: async (path, opts = {}) => {
      const { Directory } = await import('@capacitor/filesystem');
      return Filesystem?.readFile({
        path,
        directory: opts.directory ?? Directory.Documents,
        encoding: opts.encoding ?? 'utf8',
      });
    },
    deleteFile: async (path, opts = {}) => {
      const { Directory } = await import('@capacitor/filesystem');
      return Filesystem?.deleteFile({ path, directory: opts.directory ?? Directory.Documents });
    },
  };

  // ── Preferences (persistent key-value) ─────────────────────────
  const prefs = {
    set: async (key, value) => Preferences?.set({ key, value: JSON.stringify(value) }),
    get: async (key) => {
      const r = await Preferences?.get({ key });
      try { return JSON.parse(r?.value); } catch { return r?.value; }
    },
    remove: async (key) => Preferences?.remove({ key }),
    clear: async () => Preferences?.clear(),
  };

  // ── Network ─────────────────────────────────────────────────────
  const network = {
    getStatus: async () => Network?.getStatus(),
    onStatusChange: (cb) => {
      const handle = Network?.addListener('networkStatusChange', cb);
      return () => handle?.remove();
    },
  };

  // ── Device info ─────────────────────────────────────────────────
  const device = {
    getInfo: async () => Device?.getInfo(),
    getBatteryInfo: async () => Device?.getBatteryInfo(),
    getId: async () => Device?.getId(),
  };

  // ── App lifecycle ───────────────────────────────────────────────
  const appLifecycle = {
    getState: async () => App?.getState(),
    onStateChange: (cb) => {
      const handle = App?.addListener('appStateChange', cb);
      return () => handle?.remove();
    },
    onUrlOpen: (cb) => {
      const handle = App?.addListener('appUrlOpen', cb);
      return () => handle?.remove();
    },
    exitApp: () => App?.exitApp(),
  };

  // ── Deep links ──────────────────────────────────────────────────
  const deepLink = {
    onDeepLink: (cb) => {
      if (!CortexxDeepLink) return () => {};
      const handle = CortexxDeepLink.addListener('deepLink', cb);
      return () => handle.remove();
    },
    getLastDeepLink: async () => {
      if (!CortexxDeepLink) return null;
      return CortexxDeepLink.getLastDeepLink();
    },
  };

  // ── Status bar ──────────────────────────────────────────────────
  const statusBar = {
    setStyle: async (style = 'DARK') => StatusBar?.setStyle({ style }),
    setBackgroundColor: async (color) => StatusBar?.setBackgroundColor({ color }),
    show: async () => StatusBar?.show(),
    hide: async () => StatusBar?.hide(),
  };

  // ── Keyboard ────────────────────────────────────────────────────
  const keyboard = {
    show: async () => Keyboard?.show(),
    hide: async () => Keyboard?.hide(),
    onWillShow: (cb) => {
      const handle = Keyboard?.addListener('keyboardWillShow', cb);
      return () => handle?.remove();
    },
    onWillHide: (cb) => {
      const handle = Keyboard?.addListener('keyboardWillHide', cb);
      return () => handle?.remove();
    },
  };

  // ── Toast ────────────────────────────────────────────────────────
  const toast = {
    show: async (text, duration = 'short') => Toast?.show({ text, duration }),
  };

  // ── Clipboard ───────────────────────────────────────────────────
  const clipboard = {
    write: async (text) => Clipboard?.write({ string: text }),
    read: async () => Clipboard?.read(),
  };

  // ── Splash screen ───────────────────────────────────────────────
  const splash = {
    hide: async (opts = {}) => SplashScreen?.hide({ fadeOutDuration: opts.fadeOut ?? 300 }),
  };

  // ── Expose on window ────────────────────────────────────────────
  window.CortexxNative = {
    camera,
    geo,
    haptics,
    biometric,
    speech,
    notifications,
    push,
    share,
    fs,
    prefs,
    network,
    device,
    app: appLifecycle,
    deepLink,
    statusBar,
    keyboard,
    toast,
    clipboard,
    splash,
    isNative: true,
    platform: window.Capacitor.getPlatform(),
  };

  // Convenience: hide splash once the app signals it's ready
  document.addEventListener('cortexx:ready', () => {
    window.CortexxNative.splash.hide();
    window.CortexxNative.statusBar.setStyle('DARK');
  });

  console.log('[CortexxNative] Bridge ready — platform:', window.CortexxNative.platform);
})();
