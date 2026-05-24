declare module 'virtual:pwa-register' {
  export type RegisterSWOptions = {
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
  };
  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}
