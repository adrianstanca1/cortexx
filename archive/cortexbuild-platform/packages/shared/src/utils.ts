export function formatCurrency(val: number, currency = 'GBP', locale = 'en-GB') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(val);
}
export function formatDate(d: Date | string, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-GB', opts ?? { dateStyle: 'medium' }).format(new Date(d));
}
export function formatDateTime(d: Date | string) { return formatDate(d, { dateStyle: 'medium', timeStyle: 'short' }); }
export function calculateProgressPercent(actual: number, planned: number) {
  if (planned === 0) return 0;
  const pct = (actual / planned) * 100;
  return Math.min(100, Math.round(pct * 10) / 10);
}
export function calculateDaysRemaining(targetDate: Date) {
  const now = new Date();
  const target = new Date(targetDate);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
export function generateRef(prefix: string, num: number) {
  return `${prefix}-${String(num).padStart(6, '0')}`;
}
export function slugify(str: string) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 100);
}
export function toCamelCase(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj && typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), toCamelCase(v)]));
  return obj;
}
export function toSnakeCase(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (obj && typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.replace(/[A-Z]/g, c => '_' + c.toLowerCase()), toSnakeCase(v)]));
  return obj;
}
export function hasPermission(userRole: string, requiredRole: string) {
  const ROLES: Record<string,number> = { viewer:0, worker:1, field_worker:2, supervisor:3, manager:4, project_manager:5, company_admin:6, company_owner:7, admin:8, super_admin:9 };
  return (ROLES[userRole] ?? 0) >= (ROLES[requiredRole] ?? 0);
}
export function clamp(n: number, min: number, max: number) { return Math.min(max, Math.max(min, n)); }
