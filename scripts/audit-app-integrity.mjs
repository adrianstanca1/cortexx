#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appDir = path.join(root, 'app');
const scanRoots = ['app', 'components', 'lib'].map((dir) => path.join(root, dir));
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const failures = [];
const warnings = [];

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(fullPath);
  }
  return files;
}

function routeFromPage(file) {
  const relative = path.relative(appDir, path.dirname(file));
  const segments = relative
    .split(path.sep)
    .filter(Boolean)
    .filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')))
    .filter((segment) => !segment.startsWith('@'));
  return `/${segments.join('/')}`.replace(/\/$/, '') || '/';
}

function routePattern(route) {
  const escaped = route
    .split('/')
    .map((segment) => {
      if (!segment) return '';
      if (/^\[\.\.\..+\]$/.test(segment)) return '.+';
      if (/^\[\[\.\.\..+\]\]$/.test(segment)) return '.*';
      if (/^\[.+\]$/.test(segment)) return '[^/]+';
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return new RegExp(`^${escaped || '/'}(?:/)?$`);
}

const pages = walk(appDir).filter((file) => path.basename(file) === 'page.tsx' || path.basename(file) === 'page.jsx');
const routes = pages.map(routeFromPage);
const patterns = routes.map((route) => ({ route, regex: routePattern(route) }));

function normaliseInternalTarget(target) {
  const clean = target.split('#')[0].split('?')[0];
  if (!clean) return '/';
  return clean.length > 1 ? clean.replace(/\/$/, '') : clean;
}

function isAllowedTarget(target) {
  if (!target.startsWith('/')) return true;
  if (target.startsWith('/api/')) return true;
  if (/\.[a-z0-9]{2,8}$/i.test(target)) return true;
  const clean = normaliseInternalTarget(target);
  return patterns.some(({ regex }) => regex.test(clean));
}

const files = scanRoots.flatMap(walk);
const linkPatterns = [
  /\bhref\s*=\s*["'`]([^"'`]+)["'`]/g,
  /\b(?:router\.(?:push|replace)|redirect)\(\s*["'`]([^"'`]+)["'`]/g,
];

for (const file of files) {
  const relative = path.relative(root, file);
  const content = fs.readFileSync(file, 'utf8');

  for (const matcher of linkPatterns) {
    matcher.lastIndex = 0;
    for (const match of content.matchAll(matcher)) {
      const target = match[1].trim();
      if (/^(?:https?:|mailto:|tel:|sms:|#|javascript:)/i.test(target)) {
        if (target === '#' || /^javascript:/i.test(target)) {
          failures.push(`${relative}: placeholder or JavaScript link '${target}'`);
        }
        continue;
      }
      if (!isAllowedTarget(target)) {
        failures.push(`${relative}: internal link '${target}' does not match an app page`);
      }
    }
  }

  for (const match of content.matchAll(/<button\b([^>]*)>/g)) {
    const attrs = match[1];
    if (!/\btype\s*=/.test(attrs)) {
      warnings.push(`${relative}: button without an explicit type attribute`);
    }
    if (/\bdisabled\s*=\s*{?false}?/.test(attrs)) {
      warnings.push(`${relative}: button contains redundant disabled={false}`);
    }
  }

  for (const match of content.matchAll(/<a\b([^>]*)>/g)) {
    const attrs = match[1];
    if (/target\s*=\s*["']_blank["']/.test(attrs) && !/rel\s*=\s*["'][^"']*noopener/.test(attrs)) {
      failures.push(`${relative}: target='_blank' link is missing rel='noopener'`);
    }
  }
}

const duplicateRoutes = routes.filter((route, index) => routes.indexOf(route) !== index);
for (const route of new Set(duplicateRoutes)) failures.push(`Duplicate page route detected: ${route}`);

console.log(`Audited ${pages.length} pages and ${files.length} source files.`);
console.log(`Discovered routes: ${routes.length}`);

if (warnings.length) {
  console.log(`\nWarnings (${warnings.length}):`);
  for (const warning of warnings.slice(0, 100)) console.log(`- ${warning}`);
  if (warnings.length > 100) console.log(`- ...and ${warnings.length - 100} more`);
}

if (failures.length) {
  console.error(`\nIntegrity failures (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('\nApplication route, link, and UI integrity audit passed.');
