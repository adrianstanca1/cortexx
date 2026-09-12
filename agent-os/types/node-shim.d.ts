declare const process: { env: Record<string, string | undefined>; cwd(): string };
declare module 'node:crypto' { export function randomUUID(): string; }
declare module 'node:http' { export function createServer(listener: (req: any, res: any) => any): { listen(port: number, cb: () => void): void }; }
declare module 'node:fs/promises' { export function readFile(path: string, encoding: string): Promise<string>; }
declare module 'node:path' { export function join(...parts: string[]): string; }
declare module 'node:test' { const test: (name: string, fn: () => any) => any; export default test; }
declare module 'node:assert/strict' { const assert: { equal(a: unknown, b: unknown): void }; export default assert; }
