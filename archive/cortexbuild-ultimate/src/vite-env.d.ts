/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  /** Dev: http://localhost:3001 — OAuth start URL; production: empty (same origin as the SPA). */
  readonly VITE_OAUTH_API_ORIGIN?: string;
  /** Optional WebSocket base (`wss://host`, `ws://host:3001`, or `host:port`); empty = same host as the page. */
  readonly VITE_WS_URL?: string;
  readonly VITE_USE_MOCK_DATA?: string;
  /** Set `true` in `.env.local` to force agent debug POSTs on any host (e.g. tunnel URLs). */
  readonly VITE_AGENT_DEBUG?: string;
  /** Vitest injects this during `vitest run` / watch. */
  readonly VITEST?: string | boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'react-dom/client' {
  interface Root {
    render(children: import('react').ReactNode): void;
    unmount(): void;
  }
  export function createRoot(container: Element | DocumentFragment): Root;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: 'no-speech' | 'aborted' | 'audio-capture' | 'not-allowed' | 'bad-grammar' | 'network' | string;
  message?: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
        confidence: number;
      };
      isFinal: boolean;
      length: number;
    };
    length: number;
  };
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

interface Window {
  SpeechRecognition: SpeechRecognitionConstructor;
  webkitSpeechRecognition: SpeechRecognitionConstructor;
}
