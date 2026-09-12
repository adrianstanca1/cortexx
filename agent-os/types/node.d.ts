declare module "node:http" { export function createServer(handler: any): any; export type IncomingMessage = any; export type ServerResponse = any; }
declare module "node:fs" { export const promises: any; export function existsSync(path: string): boolean; }
declare module "node:path" { const path: any; export default path; export const resolve: any; export const join: any; export const dirname: any; }
declare module "node:crypto" { export function randomUUID(): string; }
declare module "node:events" { export class EventEmitter { on(event: string, listener: (...args:any[])=>void): this; emit(event:string, ...args:any[]): boolean; off(event:string, listener:(...args:any[])=>void): this; } }
declare module "node:test" { const test: any; export default test; }
declare module "node:assert/strict" { const assert: any; export default assert; }
declare var process: any;
declare var Buffer: any;
